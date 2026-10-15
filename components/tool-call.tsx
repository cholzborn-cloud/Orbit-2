"use client";

import { getToolName, type DynamicToolUIPart, type ToolUIPart } from "ai";

import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { FileCard, ImagePreview } from "@/components/media";
import type { Screenshot, SharedFileOutput } from "@/trigger/sandbox-tools";

type Part = ToolUIPart | DynamicToolUIPart;
type Input = Record<string, unknown> | undefined;

const cut = (s: unknown, n = 48) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// Kurzer, deutscher Titel je Tool, mit dem Wichtigsten aus der Eingabe.
const TITLES: Record<string, (i: Input) => string> = {
  bash: (i) => `Befehl: ${cut(i?.command)}`,
  read_file: (i) => `Datei lesen: ${cut(i?.path)}`,
  write_file: (i) => `Datei schreiben: ${cut(i?.path)}`,
  list_files: (i) => `Ordner ansehen: ${cut(i?.path ?? ".")}`,
  view_screen: () => "Bildschirm angesehen",
  show_screen: () => "Bildschirm",
  mouse_click: (i) => `${i?.double ? "Doppelklick" : "Klick"} bei ${i?.x}, ${i?.y}`,
  mouse_move: (i) => `Maus zu ${i?.x}, ${i?.y}`,
  mouse_scroll: (i) => `Scrollen ${i?.direction === "up" ? "nach oben" : "nach unten"}`,
  mouse_drag: (i) => `Ziehen ${i?.startX}, ${i?.startY} → ${i?.endX}, ${i?.endY}`,
  keyboard_type: (i) => `Tippen: ${cut(i?.text)}`,
  keyboard_press: (i) => `Taste: ${[...((i?.modifiers as string[]) ?? []), i?.key].join("+")}`,
  keyboard_hotkey: (i) => `Tasten: ${i?.keys}`,
  wait: (i) => `Warten: ${i?.seconds} s`,
  share_file: (i) => `Datei senden: ${cut(i?.path)}`,
};

// Ausgaben mit base64: nie als JSON anzeigen.
const BINARY_TOOLS = new Set(["view_screen", "show_screen", "share_file"]);
const TOOL_CLASS = "mb-0 w-full max-w-md text-left";

export function ToolCall({ part }: { part: Part }) {
  const name = getToolName(part);
  const title = TITLES[name]?.(part.input as Input) ?? name;
  const header = (
    <ToolHeader
      {...(part.type === "dynamic-tool"
        ? { type: part.type, state: part.state, toolName: part.toolName }
        : { type: part.type, state: part.state })}
      title={title}
      className="p-2"
    />
  );

  // Nur für den Nutzer angefordert: Screenshot direkt sichtbar, Klick öffnet Vollbild.
  if (name === "show_screen" && part.state === "output-available") {
    const shot = part.output as Screenshot;
    return (
      <ImagePreview
        src={`data:${shot.mediaType};base64,${shot.image}`}
        alt="Bildschirm der Sandbox"
        filename="bildschirm.jpg"
        width={shot.width}
        height={shot.height}
        className="w-full max-w-md"
      />
    );
  }

  // Vom Orbi gesendete Datei: Vorschau bzw. Karte mit Öffnen und Herunterladen.
  if (name === "share_file" && part.state === "output-available") {
    const f = part.output as SharedFileOutput;
    return <FileCard file={{ url: `data:${f.mediaType};base64,${f.data}`, mediaType: f.mediaType, filename: f.filename, size: f.size }} />;
  }

  // Screenshots fürs Modell (und laufende/fehlgeschlagene Binär-Tools): nur die Zeile, Fehler als Text.
  if (BINARY_TOOLS.has(name)) {
    return (
      <Tool className={TOOL_CLASS} disabled>
        {header}
        {part.errorText && <p className="px-2 pb-2 text-xs text-destructive">{part.errorText}</p>}
      </Tool>
    );
  }

  return (
    <Tool className={TOOL_CLASS}>
      {header}
      <ToolContent className="space-y-3 p-2 pt-0">
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={part.errorText} />
      </ToolContent>
    </Tool>
  );
}
