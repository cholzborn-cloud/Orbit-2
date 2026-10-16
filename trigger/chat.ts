import { createOpenAI } from "@ai-sdk/openai";
import { chat } from "@trigger.dev/sdk/ai";
import { AgentChat } from "@trigger.dev/sdk/chat";
import { isStepCount, readUIMessageStream, tool, wrapLanguageModel, type ToolSet, type UIMessage } from "ai";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import { CHAT_MODELS, type ChatMetadata } from "@/lib/chat-catalog";
import { describeJob, jobExample } from "@/lib/job-descriptions";
import { attachmentsAsText, latestUserFiles, UPLOADS_DIR } from "./attachments";
import { imagesToUserMessages } from "./images-middleware";
import { sandboxTools, startSandbox } from "./sandbox-tools";

// Alle Anbieter (Anthropic, OpenAI, Google) laufen über den lokalen CLI Proxy.
// shortcut: Proxy nur lokal erreichbar, deshalb nur mit `trigger dev`; für Deploy öffentlichen Proxy nutzen.
const proxy = createOpenAI({
  baseURL: "http://127.0.0.1:8317/v1",
  apiKey: process.env.CLI_PROXY_API_KEY,
});

// Zeit der letzten Nachricht für die Seitenleiste, auch ohne offenen Tab.
async function touchChat(chatId: string) {
  if (!process.env.DATABASE_URL) return;
  await neon(process.env.DATABASE_URL)`update chats set last_message_at = now() where id = ${chatId}`;
}

type ChatBot = {
  id: string;
  name: string;
  job: string;
  instructions: string | null;
  is_main: boolean;
  sandbox_id: string | null;
  avatar: string;
  color: string | null;
  member: boolean; // Mitglied dieses Chats
  direct_chat_id: string | null; // eigener 1:1-Chat, dort landen Übergaben
};

type ClientData = { model: string; effort?: string; botId?: string; handoffDepth?: number; handoffFrom?: string; handoffGroup?: string };

// Alles, was ein Orbi in diesem Chat braucht.
type ChatContext = {
  isGroup: boolean;
  // Übergabe aus einer Gruppe: eigene Session ohne Chat-Zeile, Weitergaben bleiben ebenfalls unsichtbar.
  hidden: boolean;
  speaker: ChatBot; // antwortet auf die Nachricht
  members: ChatBot[];
  team: ChatBot[]; // alle Orbis des Nutzers, mögliche Übergabeziele
  from?: ChatBot; // hat diese Aufgabe übergeben
  depth: number; // Übergaben in dieser Kette bisher
  clientData?: ClientData;
  chatName?: string; // Gruppenname
  // Je Ziel-Session nacheinander: eine Session verträgt nur einen Turn gleichzeitig.
  queue: Map<string, Promise<void>>;
};

// Ausgabe von `handoff`; ohne `message` läuft B noch nicht, `preliminary` im UI-Teil = B arbeitet.
export type HandoffOutput = {
  to: string;
  avatar: string;
  color: string | null;
  task: string;
  reason: string;
  waiting?: boolean; // Ziel arbeitet noch an einer anderen Aufgabe
  message?: UIMessage<ChatMetadata>; // bisherige Antwort von B mit Schritten
};

const MAX_HANDOFF_DEPTH = 3;

// Alle Orbis des Nutzers; im Gruppenchat spricht der gewählte, sonst der Hauptbot bzw. der zuerst beigetretene.
async function loadChat(chatId: string, clientData?: ClientData): Promise<ChatContext | undefined> {
  if (!process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  const [chatRow] = (await sql`select kind, user_id, name from chats where id = ${chatId}`) as { kind: string; user_id: string; name: string | null }[];
  const [owner] = chatRow ? [chatRow] : ((await sql`select user_id from bots where id = ${clientData?.botId ?? ""}`) as { user_id: string }[]);
  if (!owner) return;
  const team = (await sql`
    select b.id, b.name, b.job, b.instructions, b.is_main, b.sandbox_id, b.avatar, b.color, m.bot_id is not null as member,
      (select c.id from chats c join chat_members cm on cm.chat_id = c.id
       where c.kind = 'direct' and cm.bot_id = b.id order by c.created_at limit 1) as direct_chat_id
    from bots b left join chat_members m on m.bot_id = b.id and m.chat_id = ${chatId}
    where b.user_id = ${owner.user_id}
    order by b.is_main desc, m.joined_at nulls last, b.created_at`) as ChatBot[];
  const members = chatRow ? team.filter((b) => b.member) : team.filter((b) => b.id === clientData?.botId);
  const speaker = members.find((b) => b.id === clientData?.botId) ?? members[0];
  if (!speaker) return;
  return {
    isGroup: chatRow?.kind === "group" || members.length > 1,
    hidden: !chatRow,
    speaker,
    members,
    team,
    from: team.find((b) => b.id === clientData?.handoffFrom),
    depth: clientData?.handoffDepth ?? 0,
    clientData,
    chatName: chatRow?.name ?? undefined,
    queue: new Map(),
  };
}

// Werkzeuge eines Orbis: eigene Sandbox (nicht im Gruppenchat) und Übergabe, solange die Tiefe reicht.
export function orbiTools(ctx: ChatContext): ToolSet {
  const bot = ctx.speaker;
  return {
    // Gruppenchats bewusst ohne Sandbox: jeder Orbi hätte eine eigene.
    ...(!ctx.isGroup && bot.sandbox_id ? sandboxTools(bot.sandbox_id) : {}),
    ...(ctx.depth < MAX_HANDOFF_DEPTH && ctx.team.length > 1 ? { handoff: handoffTool(ctx) } : {}),
  };
}

const answerText = (m?: UIMessage) => m?.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n").trim() ?? "";

// B läuft als eigener Turn von `orbit-chat` in seinem 1:1-Chat (aus Gruppen: in einer unsichtbaren Session).
// Dort steht die Aufgabe als Nachricht von rechts, B antwortet normal; A sieht B's Schritte live als Vorab-Ergebnis.
function handoffTool(ctx: ChatContext) {
  const bot = ctx.speaker;
  return tool({
    description:
      "Give a task to another of the user's Orbis that fits better. Call it BEFORE you answer whenever the request is clearly in another Orbi's specialty, needs a tool you lack that the other Orbi has, or (as main Orbi) has several parts or needs coordination: then call it once per part. The target works on `task` alone (no chat history) with its own tools; you get its result and then give the user a short summary in your own words. Do NOT use it for trivial things you can answer well yourself, to yourself, or back to the Orbi that handed the task to you.",
    inputSchema: z.object({
      target_orbi: z.string().describe("Id or exact name of the Orbi that should take over"),
      reason: z.string().describe("One short sentence why this Orbi fits better"),
      task: z.string().describe("Concrete, self-contained task for the target, written to it; it does not see the chat history"),
      context: z.string().optional().describe("The few facts from the conversation the target needs"),
    }),
    execute: async function* ({ target_orbi, reason, task, context }, { abortSignal }) {
      const key = target_orbi.trim().toLowerCase();
      const target = ctx.team.find((b) => b.id === target_orbi.trim() || b.name.toLowerCase() === key);
      if (!target)
        throw new Error(`Unknown Orbi "${target_orbi}". Available: ${ctx.team.filter((b) => b.id !== bot.id).map((b) => b.name).join(", ")}.`);
      if (target.id === bot.id) throw new Error("You cannot hand off to yourself. Answer yourself.");
      if (target.id === ctx.from?.id) throw new Error(`${target.name} just handed this to you. Do not hand it back; answer yourself.`);

      const base: HandoffOutput = { to: target.name, avatar: target.avatar, color: target.color, task, reason };
      yield base;
      // Aus Gruppen: ebenfalls der 1:1-Chat des Ziels (Label nennt die Gruppe); Weitergaben aus so einer Übergabe bleiben unsichtbar.
      const group = ctx.isGroup ? ctx.chatName : ctx.clientData?.handoffGroup;
      const hidden = ctx.hidden || !target.direct_chat_id || (ctx.depth > 0 && !!ctx.clientData?.handoffGroup);
      const id = hidden ? `handoff-${crypto.randomUUID()}` : target.direct_chat_id!;
      const prev = ctx.queue.get(id);
      let release = () => {};
      const mine = new Promise<void>((r) => (release = r));
      ctx.queue.set(id, mine);
      if (prev) yield { ...base, waiting: true };
      await prev;
      try {
        const agent = new AgentChat({
          agent: "orbit-chat",
          id,
          clientData: { ...ctx.clientData, context: true, botId: target.id, handoffDepth: ctx.depth + 1, handoffFrom: bot.id, handoffGroup: group },
          streamTimeoutSeconds: 240,
        });
        const stream = await agent.sendRaw(
          [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: [task, context && `Kontext: ${context}`].filter(Boolean).join("\n\n") }],
              metadata: { handoffFrom: bot.name, handoffGroup: ctx.isGroup ? group : undefined },
            },
          ],
          { abortSignal },
        );
        // Höchstens alle 400 ms ein Zwischenstand; jeder ist die ganze bisherige Nachricht.
        let last: UIMessage<ChatMetadata> | undefined;
        let sentAt = 0;
        for await (const message of readUIMessageStream<UIMessage<ChatMetadata>>({ stream })) {
          last = message;
          if (Date.now() - sentAt < 400) continue;
          sentAt = Date.now();
          yield { ...base, message };
        }
        if (!answerText(last)) throw new Error(`${target.name} returned no answer.`);
        yield { ...base, message: last };
      } finally {
        release();
        if (ctx.queue.get(id) === mine) ctx.queue.delete(id);
      }
    },
    // A braucht nur B's Antworttext, nicht alle Schritte.
    toModelOutput: ({ output }) => ({ type: "text", value: `Result from ${output.to}:\n${answerText(output.message) || "(no answer)"}` }),
  });
}

const line = (b: ChatBot) => `${b.name} (id ${b.id}): ${b.job}${b.is_main ? ", main Orbi" : ""}`;

// Pro Chat aus der echten Tool-Liste gebaut, damit der Prompt nie veraltet.
export function systemPrompt(ctx: ChatContext, tools: ToolSet) {
  const { speaker: bot, from } = ctx;
  const others = ctx.team.filter((o) => o.id !== bot.id && o.id !== from?.id);
  const groupOthers = ctx.members.filter((o) => o.id !== bot.id);
  const names = Object.keys(tools);
  const canHandOff = "handoff" in tools;
  const chatType = ctx.isGroup ? "a group chat" : bot.is_main ? "a 1:1 chat; you are the user's main Orbi (Hauptorbi)" : "a 1:1 chat with the user";
  return [
    `You are ${bot.name}, an Orbi: a personal AI assistant in the Orbit app.`,
    `Your job: ${bot.job}.`,
    `Chat type: ${chatType}.`,
    // Verhalten ist mit der Standardbeschreibung vorbelegt; leer = Standard.
    bot.instructions || describeJob(bot.job, bot.is_main),
    from
      ? `The latest message is a task that ${from.name} (another Orbi of the user) handed to you. Do it fully and answer directly with the result; ${from.name} gets your answer and passes it on to the user.`
      : "",
    ctx.isGroup
      ? `This is a group chat with the user and several Orbis: ${groupOthers.map(line).join("; ")}. Messages may not be addressed to you. The user picked YOU (${bot.name}) to reply to this message: reply as ${bot.name} only, never on behalf of another Orbi. Keep replies short, do not repeat what others said and do not talk over another Orbi. Earlier replies of other Orbis are marked "[Name]:" in the history; do not write that marker yourself.`
      : "",
    bot.is_main
      ? "You are the main Orbi: you coordinate the user's other Orbis. Do small, quick things and general questions yourself. When a request has several parts or needs specialised work, split it and delegate each part to the fitting Orbi, then give the user ONE combined answer."
      : "",
    others.length ? `The user's other Orbis: ${others.map(line).join("; ")}.` : "The user has no other Orbis.",
    names.length
      ? `Your tools (only these): ${names.map((n) => `\`${n}\``).join(", ")}. Each tool's description says what it does and when to use it. Use a tool instead of guessing. If you lack a tool for something, say so honestly${canHandOff ? " or hand the task to an Orbi that has it" : ""}.`
      : "You have no tools in this chat. If something needs a tool, say so honestly.",
    canHandOff
      ? [
          "Handing off (`handoff`), decide this FIRST, before you write anything:",
          "- Hand off on your own, without being asked, when the task clearly fits another Orbi's specialty or tools better than yours, when you lack a tool it needs and another Orbi has it, or (as main Orbi) when it has several parts or needs coordination.",
          "- Do not start with a weak answer, do not ask the user for permission, and do not talk about handoffs or tools in your text. Just call the tool.",
          `- Never for trivial things you can answer well yourself, never to yourself${from ? `, never back to ${from.name}` : ""}. If no Orbi fits better, answer yourself.`,
          "- After the result arrives, give the user the result as your own answer, summarised in your own words; at most name the other Orbi in passing, do not explain who did what. If the handoff failed, tell the user briefly and answer yourself if you can.",
          others.length ? `Examples: ${others.map((o) => `"${jobExample(o.job)}" -> ${o.name}`).join("; ")}.` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "IMPORTANT: You have your own isolated sandbox: a private Linux computer in the cloud with its own filesystem. It belongs only to you; it is separate from the user's devices and from every other Orbi's sandbox.",
    "bash" in tools
      ? [
          "You operate your sandbox with tools: `bash`, file tools (`read_file`, `write_file`, `list_files`) and computer use on its desktop (mouse, keyboard, screenshots). The desktop is 1024x768 px; screenshot pixels equal click coordinates.",
          "Use `view_screen` whenever YOU need to look at the screen (the user does not see it). Use `show_screen` only when the user wants to see what is on the screen. After GUI actions, check the result with `view_screen` before continuing.",
          "Prefer `bash` and file tools when a task needs no GUI. Work step by step and tell the user briefly what you did.",
          `Files the user attaches are saved in ${UPLOADS_DIR}/ in your sandbox. To send a file to the user, use \`share_file\` (do not paste large file contents into the chat).`,
        ].join("\n")
      : "Your sandbox is not available in this chat.",
    "Reply in the language the user writes in.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const orbitChat = chat
  .withUIMessage<UIMessage<ChatMetadata>>()
  .withClientData({
    schema: z.object({
      model: z.string(),
      effort: z.string().optional(),
      // Kontext aus: nur die neue Nachricht, kein Verlauf.
      context: z.boolean().default(true),
      // Gruppenchat: Orbi, der diesen Turn beantwortet (aus der Auswahl im Composer).
      botId: z.string().optional(),
      // Nur bei Übergaben (AgentChat aus dem `handoff`-Tool): Tiefe der Kette und übergebender Orbi.
      handoffDepth: z.number().int().optional(),
      handoffFrom: z.string().optional(),
      handoffGroup: z.string().optional(),
    }),
  })
  .agent({
    id: "orbit-chat",
    // Auf der Config, damit toModelOutput (Screenshots) auch in späteren Turns greift.
    tools: async ({ chatId, clientData }) => {
      const ctx = await loadChat(chatId, clientData);
      return ctx ? orbiTools(ctx) : {};
    },
    turnTimeout: "5m",
    actionSchema: z.object({ type: z.literal("clear") }),
    onAction: () => {
      chat.history.set([]);
    },
    onTurnStart: async ({ chatId }) => {
      await touchChat(chatId);
    },
    onTurnComplete: async ({ chatId }) => {
      await touchChat(chatId);
    },
    run: async ({ chatId, messages, clientData, tools, signal, streamText }) => {
      const model = CHAT_MODELS.find((m) => m.id === clientData?.model);
      if (!model) throw new Error("Unbekanntes Modell");
      const effort = clientData?.effort;
      const wantsEffort = model.efforts.length > 0;
      if (wantsEffort && !model.efforts.some((e) => e === effort)) {
        throw new Error(`Stufe "${effort}" wird von ${model.label} nicht unterstützt`);
      }

      // Für den Info-Knopf an der Antwort: Modell, Stufe, Dauer und Tokenverbrauch.
      chat.setUIMessageStreamOptions({
        messageMetadata: ({ part }): ChatMetadata | undefined => {
          if (part.type === "start")
            return { botId: clientData?.botId, model: model.label, effort: wantsEffort ? effort : undefined, startedAt: Date.now() };
          if (part.type === "finish")
            return {
              inputTokens: part.totalUsage.inputTokens,
              outputTokens: part.totalUsage.outputTokens,
              reasoningTokens: part.totalUsage.outputTokenDetails?.reasoningTokens,
              finishedAt: Date.now(),
            };
        },
      });

      // Run endet nach dem Turn; sonst bleibt er idle/suspendiert und wirkt unendlich offen.
      // Nächste Nachricht startet einen Continuation-Run auf derselben Session.
      chat.endRun();

      // Pro Turn neu geladen, damit Änderungen am Orbi sofort gelten.
      const ctx = await loadChat(chatId, clientData);
      const speaker = ctx?.speaker;

      // Anhänge der neuen Nachricht auch in die Sandbox legen; Fehler blockieren die Antwort nicht.
      const files = latestUserFiles(messages);
      const sandboxId = ctx && !ctx.isGroup ? speaker?.sandbox_id : undefined;
      if (sandboxId && files.length) {
        try {
          const sb = await startSandbox(sandboxId);
          await sb.fs.createFolder(UPLOADS_DIR, "755").catch(() => {});
          await sb.fs.uploadFiles(files.map((f) => ({ source: f.bytes, destination: f.path })));
        } catch (e) {
          console.error("Anhänge konnten nicht in die Sandbox geladen werden", e);
        }
      }

      // Gruppe: Antworten im Verlauf mit dem Absender markieren, sonst hält das Modell sie für eigene.
      // Eine Antwort (UI-Nachricht) = alle Assistenten-/Tool-Nachrichten zwischen zwei Nutzernachrichten; markiert wird der erste Text.
      const names = new Map(ctx?.team.map((b) => [b.id, b.name]));
      const senders = chat.history.all().filter((m) => m.role === "assistant").map((m) => names.get((m.metadata as ChatMetadata | undefined)?.botId ?? ""));
      let n = -1;
      let afterUser = true;
      let tagged = false;
      const history = ctx?.isGroup
        ? messages.map((m) => {
            if (m.role === "user") {
              afterUser = true;
              return m;
            }
            if (afterUser) [afterUser, tagged, n] = [false, false, n + 1];
            const who = senders[n];
            if (!who || tagged || m.role !== "assistant") return m;
            if (typeof m.content === "string") return (tagged = true), { ...m, content: `[${who}]: ${m.content}` };
            return {
              ...m,
              content: m.content.map((p) =>
                !tagged && p.type === "text" ? ((tagged = true), { ...p, text: `[${who}]: ${p.text}` }) : p,
              ),
            };
          })
        : messages;

      return streamText({
        model: wrapLanguageModel({ model: proxy.chat(model.id), middleware: [attachmentsAsText, imagesToUserMessages] }),
        system: ctx ? systemPrompt(ctx, tools) : undefined,
        tools,
        // Computer Use braucht viele Schritte (ansehen, klicken, prüfen).
        stopWhen: isStepCount(40),
        messages: clientData?.context === false ? history.slice(-1) : history,
        abortSignal: signal,
        ...(wantsEffort && { providerOptions: { openai: { reasoningEffort: effort as string } } }),
      });
    },
  });
