"use client";

import { getToolName, isToolUIPart, type DynamicToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { ChevronDownIcon } from "lucide-react";

import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChatAvatar } from "@/components/chat-avatar";
import { FileCard, ImagePreview } from "@/components/media";
import type { HandoffOutput } from "@/trigger/chat";
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

// Kurzer Satz zum aktuellen Schritt des Ziel-Orbis.
const STEPS: Record<string, string> = {
  bash: "führt Befehl aus",
  write_file: "schreibt Datei …",
  read_file: "liest Datei …",
  list_files: "sieht Ordner an …",
  handoff: "gibt weiter …",
};
const stepText = (p: UIMessage["parts"][number] | undefined) =>
  !p ? "startet …" : isToolUIPart(p) ? (STEPS[getToolName(p)] ?? "arbeitet …") : "schreibt die Antwort …";

// Übergabe: eine kompakte Zeile, in allen Chats gleich. Zugeklappt: Avatar, Name und ein Satz zum Stand
// (wartet, läuft mit Schimmer, fertig mit Vorschau, fehlgeschlagen mit Grund). Aufgeklappt: Aufgabe, Schritte, Antwort.
function Handoff({ part, live }: { part: Part; live: boolean }) {
  const h = part.output as HandoffOutput | undefined;
  const input = part.input as Input;
  const task = String(h?.task ?? input?.task ?? "");
  const parts = h?.message?.parts ?? [];
  const last = parts.findLast((p) => isToolUIPart(p) || (p.type === "text" && p.text));
  // Vorschau = letzter Text (die Antwort), nicht die Zwischenkommentare.
  const finalText = parts.findLast((p) => p.type === "text" && p.text.trim());
  const answer = cut(finalText?.type === "text" ? finalText.text : "", 80);
  const finished = part.state === "output-available" && part.preliminary !== true;
  // Läuft nur, solange der Turn streamt; sonst fertig oder fehlgeschlagen.
  const running = !finished && part.state !== "output-error" && live;
  const to = h?.to ?? (running ? "Orbi" : "unbekannter Orbi");
  const error =
    h?.error ??
    (part.state === "output-error" ? part.errorText : undefined) ??
    (finished && !answer ? "Keine Antwort erhalten." : undefined) ??
    (!finished && !live ? "Unterbrochen." : undefined);
  const failed = !!error && !running;
  return (
    <Collapsible className="w-full max-w-md rounded-lg border text-left text-sm">
      <CollapsibleTrigger className="group/handoff flex w-full items-center gap-2 px-3 py-2 text-left">
        {h?.avatar ? <ChatAvatar seed={h.avatar} color={h.color} className="size-5 shrink-0" /> : <span className="size-5 shrink-0 rounded-full bg-muted" />}
        <span className="min-w-0 flex-1">
          {failed ? (
            <>
              <span className="block truncate">Übergabe an {to} fehlgeschlagen</span>
              <span className="block truncate text-xs text-destructive">{error}</span>
            </>
          ) : running ? (
            <>
              <span className="block truncate font-medium">{to}</span>
              {h?.waiting ? (
                <span className="block truncate text-xs text-muted-foreground">wartet, bis {to} frei ist</span>
              ) : (
                <Shimmer as="span" className="block truncate text-xs">{stepText(last)}</Shimmer>
              )}
            </>
          ) : (
            <>
              <span className="block truncate">{to} hat das übernommen</span>
              {answer && <span className="block truncate text-xs text-muted-foreground">{answer}</span>}
            </>
          )}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/handoff:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t px-3 py-2">
        <p className="text-xs text-muted-foreground">Aufgabe: {task}</p>
        {parts.map((p, i) => {
          if (isToolUIPart(p)) return <ToolCall key={i} part={p} />;
          if (p.type === "text" && p.text) return <MessageResponse key={i}>{p.text}</MessageResponse>;
          return null;
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Ausgaben mit base64: nie als JSON anzeigen.
const BINARY_TOOLS = new Set(["view_screen", "show_screen", "share_file"]);
const TOOL_CLASS = "mb-0 w-full max-w-md text-left";

// `live`: der Turn dieser Nachricht streamt gerade.
export function ToolCall({ part, live = false }: { part: Part; live?: boolean }) {
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

  if (name === "handoff") return <Handoff part={part} live={live} />;

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
