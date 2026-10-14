import { createOpenAI } from "@ai-sdk/openai";
import { chat } from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

import { CHAT_MODELS, type ChatMetadata } from "@/lib/chat-catalog";

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

export const orbitChat = chat
  .withUIMessage<UIMessage<ChatMetadata>>()
  .withClientData({
    schema: z.object({
      model: z.string(),
      effort: z.string().optional(),
      // Kontext aus: nur die neue Nachricht, kein Verlauf.
      context: z.boolean().default(true),
    }),
  })
  .agent({
    id: "orbit-chat",
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
    run: async ({ messages, clientData, signal, streamText }) => {
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
            return { model: model.label, effort: wantsEffort ? effort : undefined, startedAt: Date.now() };
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

      return streamText({
        model: proxy.chat(model.id),
        messages: clientData?.context === false ? messages.slice(-1) : messages,
        abortSignal: signal,
        ...(wantsEffort && { providerOptions: { openai: { reasoningEffort: effort as string } } }),
      });
    },
  });
