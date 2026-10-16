import { createOpenAI } from "@ai-sdk/openai";
import { chat } from "@trigger.dev/sdk/ai";
import { AgentChat } from "@trigger.dev/sdk/chat";
import { isStepCount, readUIMessageStream, tool, wrapLanguageModel, type StreamTextTransform, type ToolSet, type UIMessage } from "ai";
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

type ClientData = { model: string; effort?: string; botId?: string; handoffDepth?: number; handoffFrom?: string; handoffGroup?: string; handoffId?: string };

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
  error?: string; // Übergabe gescheitert, kurzer deutscher Grund
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
      "Hand a task to another of the user's Orbis. The target works on `task` alone (no chat history) with its own tools and returns its result. Several calls in the same step run in parallel. When to use it: see your instructions.",
    inputSchema: z.object({
      target_orbi: z.string().describe("Id or exact name of the Orbi that should take over"),
      reason: z.string().describe("One short sentence why this Orbi fits better"),
      task: z.string().describe("Concrete, self-contained task for the target, written to it; it does not see the chat history"),
      context: z.string().optional().describe("The few facts from the conversation the target needs"),
    }),
    execute: async function* ({ target_orbi, reason, task, context }, { abortSignal }) {
      const key = target_orbi.trim().toLowerCase();
      const target = ctx.team.find((b) => b.id === target_orbi.trim() || b.name.toLowerCase() === key);
      // Fehler als Ergebnis statt als Wurf: so bleiben Name und Avatar der Karte erhalten (ein Wurf verliert die Ausgabe).
      const fail = (error: string, b = target): HandoffOutput => ({
        to: b?.name ?? "unbekannter Orbi",
        avatar: b?.avatar ?? "",
        color: b?.color ?? null,
        task,
        reason,
        error,
      });
      if (!target) {
        yield fail(`Orbi „${target_orbi}“ gibt es nicht. Verfügbar: ${ctx.team.filter((b) => b.id !== bot.id).map((b) => b.name).join(", ")}.`);
        return;
      }
      if (target.id === bot.id) {
        yield fail("Übergabe an sich selbst nicht möglich.");
        return;
      }
      if (target.id === ctx.from?.id) {
        yield fail(`${target.name} hat das gerade übergeben, nicht zurückgeben.`);
        return;
      }

      const handoffId = crypto.randomUUID();
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
          // context: false = Modell sieht nur die Aufgabe; die Nachrichten landen trotzdem im Chat des Ziels.
          clientData: { ...ctx.clientData, context: false, handoffId, botId: target.id, handoffDepth: ctx.depth + 1, handoffFrom: bot.id, handoffGroup: group },
          streamTimeoutSeconds: 240,
        });
        // Ein neuer AgentChat liest die Session ab Anfang und träfe zuerst alte Turns. Erst bis zum aktuellen Ende lesen,
        // dann senden. Reicht das nicht, trägt jeder Turn die handoffId, fremde Turns werden übersprungen.
        if (!hidden) {
          await agent.preload();
          const settled = await agent.reconnect(abortSignal);
          await settled?.pipeTo(new WritableStream());
        }
        let stream = await agent.sendRaw(
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
        const deadline = Date.now() + 240_000;
        while (!abortSignal?.aborted && Date.now() < deadline) {
          for await (const message of readUIMessageStream<UIMessage<ChatMetadata>>({ stream })) {
            if (message.metadata?.handoffId !== handoffId) continue;
            last = message;
            if (Date.now() - sentAt < 400) continue;
            sentAt = Date.now();
            yield { ...base, message };
          }
          if (last) break;
          // shortcut: privater SDK-Aufruf, nächster Turn derselben Session; bei SDK-Update prüfen.
          stream = await (agent as unknown as { subscribeToSessionStream(s?: AbortSignal, o?: object): Promise<typeof stream> }).subscribeToSessionStream(abortSignal, { resumeAfterEof: true });
        }
        yield answerText(last) ? { ...base, message: last } : { ...base, message: last, error: `${target.name} hat keine Antwort geliefert.` };
      } catch (e) {
        if (abortSignal?.aborted) throw e;
        console.error(`handoff to ${target.name} failed`, e);
        const msg = e instanceof Error ? e.message : String(e);
        yield {
          ...base,
          error: /timeout|timed out/i.test(msg)
            ? `${target.name} hat nicht rechtzeitig geantwortet (Zeitüberschreitung).`
            : `${target.name} nicht erreichbar: ${msg.slice(0, 120)}`,
        };
      } finally {
        release();
        if (ctx.queue.get(id) === mine) ctx.queue.delete(id);
      }
    },
    // A braucht nur B's Antworttext, nicht alle Schritte.
    toModelOutput: ({ output }) => ({
      type: "text",
      value: output.error ? `Handoff failed: ${output.error}` : `Result from ${output.to}:\n${answerText(output.message)}`,
    }),
  });
}

// Das Modell ahmt gern die Absender-Marker aus dem Gruppenverlauf nach ("[Name]: ..."). Vorn abschneiden, auch beim Streaming:
// der Anfang jedes Textblocks wird gehalten, bis klar ist, ob er ein Marker ist.
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function stripSenderTag(names: string[]): StreamTextTransform<ToolSet> {
  const tag = new RegExp(`^\\s*\\[(?:${names.map(escapeRe).join("|")})\\]:\\s*`);
  const maybeTag = /^\s*(\[[^\]\n]{0,40}(\]:?)?)?$/;
  return () => {
    const held = new Map<string, string>(); // Textblock -> bisheriger, noch unentschiedener Anfang
    const trim = new Set<string>(); // Marker ist weg, folgende Leerzeichen auch
    return new TransformStream({
      transform(part, controller) {
        if (part.type === "text-start") held.set(part.id, "");
        else if (part.type === "text-delta") {
          let text = part.text;
          const before = held.get(part.id);
          if (before !== undefined) {
            const all = before + text;
            const m = tag.exec(all);
            if (m) {
              held.delete(part.id);
              trim.add(part.id);
              text = all.slice(m[0].length);
            } else if (maybeTag.test(all)) {
              held.set(part.id, all);
              return;
            } else {
              held.delete(part.id);
              text = all;
            }
          }
          if (trim.has(part.id)) {
            text = text.trimStart();
            if (text) trim.delete(part.id);
          }
          if (text) controller.enqueue({ ...part, text });
          return;
        } else if (part.type === "text-end") {
          const rest = held.get(part.id);
          if (rest) controller.enqueue({ type: "text-delta", id: part.id, text: rest });
          held.delete(part.id);
          trim.delete(part.id);
        }
        controller.enqueue(part);
      },
    });
  };
}

const line = (b: ChatBot) =>
  `${b.name} (id ${b.id}): ${b.is_main ? "main Orbi, coordinates the user's Orbis: splits tasks and delegates the parts" : b.job}`;

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
      ? `This is a group chat with the user and several Orbis: ${groupOthers.map(line).join("; ")}. Messages may not be addressed to you. The user picked YOU (${bot.name}) to reply to this message: reply as ${bot.name} only, never on behalf of another Orbi. Keep replies short, do not repeat what others said and do not talk over another Orbi. Earlier replies of other Orbis are marked "[Name]:" in the history; NEVER start your reply with such a marker or any "[Name]:" prefix, not even your own name.`
      : "",
    bot.is_main
      ? "You are the main Orbi: coordinating is your specialty. Do small, quick things and your own parts yourself; delegate everything else as described under handoff."
      : "",
    others.length ? `The user's other Orbis: ${others.map(line).join("; ")}.` : "The user has no other Orbis.",
    names.length
      ? `Your tools (only these): ${names.map((n) => `\`${n}\``).join(", ")}. Each tool's description says what it does and when to use it. Use a tool instead of guessing. If you lack a tool for something, say so honestly${canHandOff ? " or hand the task to an Orbi that has it" : ""}.`
      : "You have no tools in this chat. If something needs a tool, say so honestly.",
    canHandOff
      ? [
          "Handoff (`handoff`): before you write anything, decide silently, in this order:",
          "1. Small or quick, or you are unsure: do it yourself. This saves the user's usage.",
          "2. One other Orbi clearly fits better, or you lack a tool it has: hand off the whole task to it.",
          "3. Several parts: split it. Parts that do not depend on each other: call `handoff` for all of them in the same step, they run in parallel. A part that needs another part's result: wait for that result, then continue or hand off again. Do your own parts yourself.",
          "Never narrate the plan, never ask permission for an ordinary handoff, never mention handoff mechanics in your text. Just call the tool. Once the results are in, give the user ONE combined answer in your own words; name another Orbi at most in passing.",
          `Guards: never to yourself${from ? `, never back to ${from.name}` : ""}, never for trivial things. Handoffs chain at most ${MAX_HANDOFF_DEPTH} deep.`,
          "If a handoff failed, tell the user briefly and answer yourself if you can. For a follow-up about a result you already have, answer from it; hand off again only if you cannot.",
          others.length ? `Examples: ${others.map((o) => `"${jobExample(o.job, o.is_main)}" -> ${o.name}`).join("; ")}.` : "",
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
      handoffId: z.string().optional(), // kennzeichnet den Turn einer Übergabe im Stream
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
        // Standard maskiert Fehler als "An error occurred."
        onError: (error) => (error instanceof Error ? error.message : String(error)),
        messageMetadata: ({ part }): ChatMetadata | undefined => {
          if (part.type === "start")
            return { botId: clientData?.botId, handoffId: clientData?.handoffId, model: model.label, effort: wantsEffort ? effort : undefined, startedAt: Date.now() };
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
        ...(ctx?.isGroup && { experimental_transform: stripSenderTag(ctx.team.map((b) => b.name)) }),
        messages: clientData?.context === false ? history.slice(-1) : history,
        abortSignal: signal,
        ...(wantsEffort && { providerOptions: { openai: { reasoningEffort: effort as string } } }),
      });
    },
  });
