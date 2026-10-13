import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { CHAT_MODELS, type ChatMetadata } from "@/lib/chat-catalog";
import { proxy } from "@/lib/chat-models";

export async function POST(req: Request) {
  const {
    messages,
    model: modelId,
    effort,
    context = true,
  }: { messages: UIMessage[]; model?: string; effort?: string; context?: boolean } = await req.json();

  const model = CHAT_MODELS.find((m) => m.id === modelId);
  if (!model) return Response.json({ error: "Unbekanntes Modell" }, { status: 400 });
  const wantsEffort = model.efforts.length > 0;
  if (wantsEffort && !model.efforts.some((e) => e === effort)) {
    return Response.json(
      { error: `Stufe "${effort}" wird von ${model.label} nicht unterstützt` },
      { status: 400 },
    );
  }

  const result = streamText({
    model: proxy.chat(model.id),
    // Kontext aus: nur die neue Nachricht, kein Verlauf. CLAUDE.md/AGENTS.md lädt der CLI-Proxy selbst.
    messages: await convertToModelMessages(context ? messages : messages.slice(-1)),
    ...(wantsEffort && {
      providerOptions: { openai: { reasoningEffort: effort as string } },
    }),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // Für den Info-Knopf an der Antwort: Modell, Stufe, Dauer und Tokenverbrauch.
      messageMetadata: ({ part }): ChatMetadata | undefined => {
        if (part.type === "start") return { model: model.label, effort: wantsEffort ? effort : undefined, startedAt: Date.now() };
        if (part.type === "finish")
          return {
            inputTokens: part.totalUsage.inputTokens,
            outputTokens: part.totalUsage.outputTokens,
            reasoningTokens: part.totalUsage.outputTokenDetails?.reasoningTokens,
            finishedAt: Date.now(),
          };
      },
    }),
  });
}
