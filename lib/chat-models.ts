import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

import { CHAT_MODELS, type ChatModel } from "@/lib/chat-catalog";

const PROXY_URL = "http://127.0.0.1:8317/v1";

const proxyKey = () => process.env.CLI_PROXY_API_KEY;

// Alle Modelle laufen über den lokalen CLI Proxy (nur serverseitig, Key bleibt im Server).
export const proxy = createOpenAI({ baseURL: PROXY_URL, apiKey: proxyKey() });

let cache: { at: number; models: ChatModel[] } | undefined;

// Nur Modelle, die der Proxy gerade meldet. Kein Ersatz, keine erfundenen IDs.
export async function getAvailableModels(): Promise<ChatModel[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.models;
  try {
    const res = await fetch(`${PROXY_URL}/models`, {
      headers: { Authorization: `Bearer ${proxyKey()}` },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const { data } = (await res.json()) as { data: { id: string }[] };
    const ids = new Set(data.map((m) => m.id));
    const models = CHAT_MODELS.filter((m) => ids.has(m.id));
    cache = { at: Date.now(), models };
    return models;
  } catch {
    return [];
  }
}
