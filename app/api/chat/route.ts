import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { CHAT_MODELS } from "@/lib/chat-catalog";
import { proxy } from "@/lib/chat-models";

export async function POST(req: Request) {
  const {
    messages,
    model: modelId,
    effort,
  }: { messages: UIMessage[]; model?: string; effort?: string } = await req.json();

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
    messages: await convertToModelMessages(messages),
    ...(wantsEffort && {
      providerOptions: { openai: { reasoningEffort: effort as string } },
    }),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
