import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { task } from "@trigger.dev/sdk";
import { generateText } from "ai";

export const openrouterTask = task({
  id: "openrouter-hello",
  run: async (payload: { prompt?: string; model?: string }) => {
    const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    const { text } = await generateText({
      model: openrouter(payload.model ?? "openai/gpt-4o-mini"),
      prompt: payload.prompt ?? "Sag Hallo in einem Satz.",
    });
    return { text };
  },
});
