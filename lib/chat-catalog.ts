// Client-sicher: nur Katalog und Beschriftungen, keine Keys.
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const EFFORT_LABELS: Record<Effort, string> = {
  low: "Min",
  medium: "Mid",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

export type ChatModel = {
  id: string; // exakte ID des Proxys
  label: string; // nur Anzeige, ohne Anbieter-Präfix
  description: string; // Kurzbeschreibung unter dem Namen
  provider: "anthropic" | "openai" | "google";
  efforts: Effort[]; // nur vom Proxy bestätigte Stufen, leer = nicht einstellbar
};

const FULL: Effort[] = ["low", "medium", "high", "xhigh", "max"];

// Stufen am 13.10.2026 per Proxy-Test geprüft ("valid levels" der Proxy-Registry).
// Nicht aufgenommen, weil der Proxy keine ID liefert: Gemini 3.1 Pro, Google Argon 4.
export const CHAT_MODELS: ChatModel[] = [
  { id: "claude-haiku-5-5", description: "Schnell und günstig", label: "Haiku 5.5", provider: "anthropic", efforts: FULL },
  { id: "claude-sonnet-5-5", description: "Ausgewogen für den Alltag", label: "Sonnet 5.5", provider: "anthropic", efforts: FULL },
  { id: "claude-opus-5-5", description: "Stärkstes Claude, für Schweres", label: "Opus 5.5", provider: "anthropic", efforts: FULL },
  { id: "gpt-6-luna", description: "Leicht und schnell", label: "Luna 6", provider: "openai", efforts: FULL },
  { id: "gpt-6.1-sol", description: "Starkes Allround-Modell", label: "Sol 6.1", provider: "openai", efforts: FULL },
  // Der Proxy kappt hier xhigh/max still auf high, deshalb nur drei Stufen.
  { id: "gemini-3.8-flash-high", description: "Schnell, mit tiefem Denken", label: "3.8 Flash High", provider: "google", efforts: ["low", "medium", "high"] },
];
