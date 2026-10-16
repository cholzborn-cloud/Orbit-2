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

// Nur fürs Development: "Kein Modell" sendet ins Leere, ohne Antwort.
// Zum Entfernen DEV_NO_MODEL auf false setzen; Stufen der Zeichenzahl hier ändern (0 = nur getippter Text).
export const DEV_NO_MODEL = true;
export const NO_MODEL = "none";
export const DEV_CHAR_STEPS = [0, 100, 1000, 10000, 50000];

const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ";
// Getippter Text, mit Fülltext auf genau n Zeichen aufgefüllt.
export const fillTo = (text: string, n: number) =>
  text.length >= n ? text : (text + LOREM.repeat(Math.ceil(n / LOREM.length))).slice(0, n);

// Metadaten einer Antwort (Start und Ende werden zusammengeführt).
export type ChatMetadata = {
  botId?: string; // antwortender Orbi (Gruppenchat)
  handoffFrom?: string; // Nutzernachricht kam per Übergabe von diesem Orbi
  handoffGroup?: string; // Übergabe stammt aus dieser Gruppe
  handoffId?: string; // Turn gehört zu dieser Übergabe (Zuordnung im Session-Stream)
  model?: string;
  effort?: string;
  startedAt?: number;
  finishedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
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
