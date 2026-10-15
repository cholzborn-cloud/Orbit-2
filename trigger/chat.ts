import { createOpenAI } from "@ai-sdk/openai";
import { chat } from "@trigger.dev/sdk/ai";
import { isStepCount, wrapLanguageModel, type UIMessage } from "ai";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import { CHAT_MODELS, type ChatMetadata } from "@/lib/chat-catalog";
import { describeJob } from "@/lib/job-descriptions";
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
  team: { name: string; job: string }[]; // übrige Orbis des Nutzers, nur für den Hauptbot gefüllt
};

// Mitglieder des Chats; im Gruppenchat spricht der Hauptbot, sonst der zuerst beigetretene.
async function loadChatBots(chatId: string) {
  if (!process.env.DATABASE_URL) return [];
  return (await neon(process.env.DATABASE_URL)`
    select b.id, b.name, b.job, b.instructions, b.is_main, b.sandbox_id,
      case when b.is_main then coalesce(
        (select json_agg(json_build_object('name', o.name, 'job', o.job) order by o.created_at)
         from bots o where o.user_id = b.user_id and o.id <> b.id),
        '[]') else '[]' end as team
    from chat_members m join bots b on b.id = m.bot_id
    where m.chat_id = ${chatId}
    order by b.is_main desc, m.joined_at`) as ChatBot[];
}

function systemPrompt([bot, ...others]: ChatBot[]) {
  if (!bot) return undefined;
  return [
    `You are ${bot.name}, an Orbi: a personal AI assistant in the Orbit app.`,
    `Your job: ${bot.job}.`,
    // Fest im Prompt, damit der Hauptbot seine Rolle auch bei eigenem Verhalten kennt.
    bot.is_main
      ? `IMPORTANT: You are the user's main Orbi (Haupt-Orbi), not a regular Orbi. You mainly coordinate the user's other Orbis and only do small, quick things yourself. ${
          bot.team.length
            ? `The user's other Orbis: ${bot.team.map((o) => `${o.name} (${o.job})`).join(", ")}.`
            : "The user has no other Orbis yet."
        }`
      : "",
    // Verhalten ist mit der Standardbeschreibung vorbelegt; leer = Standard.
    bot.instructions || describeJob(bot.job, bot.is_main),
    others.length
      ? `This is a group chat. Other Orbis in it: ${others.map((o) => `${o.name} (${o.job})`).join(", ")}.`
      : "",
    "IMPORTANT: You have your own isolated sandbox: a private Linux computer in the cloud with its own filesystem. It belongs only to you; it is separate from the user's devices and from every other Orbi's sandbox.",
    bot.sandbox_id
      ? [
          "You operate your sandbox with tools: `bash`, file tools (`read_file`, `write_file`, `list_files`) and computer use on its desktop (mouse, keyboard, screenshots). The desktop is 1024x768 px; screenshot pixels equal click coordinates.",
          "Use `view_screen` whenever YOU need to look at the screen (the user does not see it). Use `show_screen` only when the user wants to see what is on the screen. After GUI actions, check the result with `view_screen` before continuing.",
          "Prefer `bash` and file tools when a task needs no GUI. Work step by step and tell the user briefly what you did.",
          `Files the user attaches are saved in ${UPLOADS_DIR}/ in your sandbox. To send a file to the user, use \`share_file\` (do not paste large file contents into the chat).`,
        ].join("\n")
      : "",
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
    }),
  })
  .agent({
    id: "orbit-chat",
    // Auf der Config, damit toModelOutput (Screenshots) auch in späteren Turns greift.
    tools: async ({ chatId }) => {
      const bots = await loadChatBots(chatId);
      // Gruppenchats bewusst ohne Tools: jeder Orbi hätte eine eigene Sandbox.
      return bots.length === 1 && bots[0].sandbox_id ? sandboxTools(bots[0].sandbox_id) : {};
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
      const all = await loadChatBots(chatId);
      // Gruppe: gewählter Orbi antwortet (ohne Sandbox), die übrigen stehen im Prompt als Mitglieder.
      const picked = all.find((b) => b.id === clientData?.botId) ?? all[0];
      const bots =
        all.length > 1 && picked
          ? [{ ...picked, sandbox_id: null }, ...all.filter((b) => b !== picked)]
          : all;
      const system = systemPrompt(bots);

      // Anhänge der neuen Nachricht auch in die Sandbox legen; Fehler blockieren die Antwort nicht.
      const files = latestUserFiles(messages);
      const sandboxId = bots[0]?.sandbox_id;
      if (sandboxId && files.length) {
        try {
          const sb = await startSandbox(sandboxId);
          await sb.fs.createFolder(UPLOADS_DIR, "755").catch(() => {});
          await sb.fs.uploadFiles(files.map((f) => ({ source: f.bytes, destination: f.path })));
        } catch (e) {
          console.error("Anhänge konnten nicht in die Sandbox geladen werden", e);
        }
      }

      return streamText({
        model: wrapLanguageModel({ model: proxy.chat(model.id), middleware: [attachmentsAsText, imagesToUserMessages] }),
        system,
        tools,
        // Computer Use braucht viele Schritte (ansehen, klicken, prüfen).
        stopWhen: isStepCount(40),
        messages: clientData?.context === false ? messages.slice(-1) : messages,
        abortSignal: signal,
        ...(wantsEffort && { providerOptions: { openai: { reasoningEffort: effort as string } } }),
      });
    },
  });
