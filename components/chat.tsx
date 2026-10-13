"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon, HistoryIcon, InfoIcon } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { StickToBottomContext } from "use-stick-to-bottom";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ChatAvatar, ORBI_BASE_COLORS, orbiFromSeed } from "@/components/chat-avatar";
import { updateChatPreview } from "@/actions/chat";
import type { EditableBot } from "@/components/bot-dialog";
import {
  CLEAR_EVENT,
  ChatHeader,
  HEADER_SPACER,
  useHeaderScroll,
  type ChatHeaderHandle,
} from "@/components/chat-header";
import { cn } from "@/lib/utils";
import { CharsPicker, EffortPicker, ModelPicker } from "@/components/model-picker";
import {
  EFFORT_LABELS,
  fillTo,
  NO_MODEL,
  type ChatMetadata,
  type ChatModel,
  type Effort,
} from "@/lib/chat-catalog";

// Bubble-Farbe des Nutzers: Orbi-Farbe, bei Originalfarbe die Grundfarbe des Orbis.
function bubbleStyle(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  return { backgroundColor: color, color: light ? "#111" : "#fff" };
}

// Schnelle, gedämpfte Feder fürs Runterscrollen: kein Nachschwingen.
const SCROLL_SPRING = { damping: 0.9, stiffness: 0.18, mass: 0.8 };

// Neue Zeilen blenden weich ein und gleiten kurz von unten.
const ENTER = "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out";

// Orbis antworten in Grau.
const BUBBLE =
  "group-[.is-assistant]:rounded-2xl group-[.is-assistant]:rounded-tl-md group-[.is-assistant]:bg-secondary group-[.is-assistant]:px-4 group-[.is-assistant]:py-2.5";

// Kleiner Orbi neben der Antwort, auf Höhe der Bubble-Unterkante.
function BotRow({ avatar, color, children }: { avatar: string; color?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <ChatAvatar seed={avatar} color={color} className="mb-0.5 size-6" />
      {children}
    </div>
  );
}

// Schreibt-Animation: drei kleine Punkte in der Bubble.
function TypingBubble({ avatar, color }: { avatar: string; color?: string | null }) {
  return (
    <Message from="assistant" className={ENTER}>
      <BotRow avatar={avatar} color={color}>
        <MessageContent className={BUBBLE}>
          <span className="flex h-4 items-center gap-[3px]" role="status" aria-label="Antwortet">
            {[0, 160, 320].map((d) => (
              <span
                key={d}
                className="typing-dot size-1 rounded-full bg-current"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        </MessageContent>
      </BotRow>
    </Message>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <MessageAction
      label="Antwort kopieren"
      size="icon-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </MessageAction>
  );
}

// Shift+Enter in einer Liste: nächster Punkt "2. " bzw. "- ". Leerer Punkt beendet die Liste.
function continueList(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key !== "Enter" || !e.shiftKey || e.nativeEvent.isComposing) return;
  const ta = e.currentTarget;
  const pos = ta.selectionStart;
  if (pos !== ta.selectionEnd) return;
  const lineStart = ta.value.lastIndexOf("\n", pos - 1) + 1;
  const line = ta.value.slice(lineStart, pos);
  const m = line.match(/^(\s*)(?:(\d+)\.|([-*•]))\s/);
  if (!m) return;
  e.preventDefault();
  if (line.trim() === m[0].trim()) ta.setRangeText("", lineStart, pos, "end");
  else ta.setRangeText(`\n${m[1]}${m[2] ? `${Number(m[2]) + 1}.` : m[3]} `, pos, pos, "end");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}

const fmt = (n?: number) => (n == null ? "–" : n.toLocaleString("de-DE"));

// Info an fertiger Antwort: Tokens rein/raus, Modell, Stufe, Dauer.
function InfoAction({ meta }: { meta?: ChatMetadata }) {
  if (!meta?.finishedAt) return null;
  const secs = meta.startedAt ? ((meta.finishedAt - meta.startedAt) / 1000).toFixed(1) : undefined;
  const rows: [string, string][] = [
    ["Modell", meta.model ?? "–"],
    ["Stufe", meta.effort ? (EFFORT_LABELS[meta.effort as Effort] ?? meta.effort) : "–"],
    ["Tokens rein", fmt(meta.inputTokens)],
    ["Tokens raus", fmt(meta.outputTokens)],
    ...(meta.reasoningTokens ? [["davon Denken", fmt(meta.reasoningTokens)] as [string, string]] : []),
    ["Dauer", secs ? `${secs} s` : "–"],
  ];
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        render={
          <button
            type="button"
            aria-label="Infos zur Antwort"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <InfoIcon className="size-3.5" />
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-52 p-3 text-xs">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right tabular-nums">{v}</dd>
            </Fragment>
          ))}
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

// Nachrichten bleiben im Browser gespeichert (je Chat).
export function Chat({
  chatId,
  models,
  avatar: avatarProp,
  color,
  bot,
  dots,
}: {
  chatId: string;
  models: ChatModel[];
  avatar?: string | null;
  color?: string | null;
  bot: EditableBot;
  dots: { avatar: string; color: string | null }[];
}) {
  const avatar = avatarProp || "erdi";
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  // Stufe je Modell getrennt, Standard Mittel (falls vorhanden).
  const [chars, setChars] = useState(0);
  // Kontext an: ganzer Verlauf geht mit. Aus: nur die neue Nachricht.
  const [context, setContext] = useState(true);
  const [contextHint, setContextHint] = useState(0);
  useEffect(() => {
    if (!contextHint) return;
    const t = setTimeout(() => setContextHint(0), 1500);
    return () => clearTimeout(t);
  }, [contextHint]);
  const [efforts, setEfforts] = useState<Record<string, Effort>>({});
  const { messages, setMessages, sendMessage, status, stop } = useChat<UIMessage<ChatMetadata>>({
    id: chatId,
    // Seitenleiste zeigt die letzte Nachricht: fertige Antwort wird zur Vorschau.
    onFinish: ({ message, isAbort, isError }) => {
      if (isAbort || isError || message.role !== "assistant") return;
      const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      if (text) void updateChatPreview(chatId, text);
    },
  });

  // shortcut: Verlauf nur im localStorage dieses Browsers, für geräteübergreifend in die DB verschieben.
  const storeKey = `orbit-chat:${chatId}`;
  const [loaded, setLoaded] = useState(false);
  // Gespeicherte Nachrichten erscheinen ohne Einblende-Animation.
  const restoredIds = useRef(new Set<string>());
  // Layout-Effekt: Verlauf steht vor dem ersten Zeichnen, kein Aufblitzen des leeren Chats.
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(storeKey);
      if (saved) {
        const restored: typeof messages = JSON.parse(saved);
        restoredIds.current = new Set(restored.map((m) => m.id));
        setMessages(restored);
      }
    } catch {}
    setLoaded(true);
  }, [storeKey, setMessages]);
  // Beim Öffnen sofort ganz unten, vor dem ersten Zeichnen.
  const conv = useRef<StickToBottomContext>(null);
  useLayoutEffect(() => {
    const el = conv.current?.scrollRef.current;
    if (loaded && el) el.scrollTop = el.scrollHeight;
  }, [loaded]);
  const header = useRef<ChatHeaderHandle>(null);
  useHeaderScroll(conv, header, loaded);
  // Neue Nachricht (eigene oder Antwort): immer nach unten.
  const count = messages.length;
  useEffect(() => {
    if (loaded && count > restoredIds.current.size) void conv.current?.scrollToBottom({ animation: SCROLL_SPRING });
  }, [loaded, count]);
  // Verlauf leeren aus dem Orbi-Dialog.
  useEffect(() => {
    const onClear = (e: Event) => {
      if ((e as CustomEvent).detail !== chatId) return;
      setMessages([]);
      restoredIds.current = new Set();
      try {
        localStorage.removeItem(storeKey);
      } catch {}
    };
    window.addEventListener(CLEAR_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_EVENT, onClear);
  }, [chatId, storeKey, setMessages]);
  useEffect(() => {
    // Erst nach dem Laden und nicht mitten im Stream speichern.
    if (!loaded || status === "streaming" || status === "submitted") return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(messages));
    } catch {}
  }, [loaded, status, messages, storeKey]);

  const model = models.find((m) => m.id === modelId);
  const userColor = color || ORBI_BASE_COLORS[orbiFromSeed(avatar)];
  const levels = model?.efforts ?? [];
  const effort =
    (model && efforts[model.id]) ||
    (levels.includes("medium") ? "medium" : levels[0]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatHeader ref={header} bot={bot} dots={dots} chatId={chatId} />
      {/* Schnelle Feder: neue Nachrichten rollen zügig nach unten statt zu springen. */}
      <Conversation resize={SCROLL_SPRING} initial="instant" contextRef={conv}>
        <ConversationContent className="w-full px-3 pt-0">
          {/* Freifläche unter dem großen Header (Orbit 1: 170). */}
          <div aria-hidden className="shrink-0" style={{ height: HEADER_SPACER }} />
          {/* Vor dem Laden nichts zeigen, sonst blitzt kurz der leere Chat auf. */}
          {!loaded ? null : messages.length === 0 ? (
            <ConversationEmptyState
              title="Noch keine Nachrichten"
              description="Stell eine Frage, um zu starten."
            />
          ) : (
            <>
              {messages.map((message) => {
                const text = message.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("");
                const isAssistant = message.role === "assistant";
                // Leere Assistant-Nachricht (Stream läuft, noch kein Text): zeigt die Schreib-Animation.
                if (isAssistant && !text) return null;
                const content = (
                  <MessageContent
                    className={isAssistant ? BUBBLE : undefined}
                    style={isAssistant ? undefined : bubbleStyle(userColor)}
                  >
                    {message.parts.map((part, i) =>
                      part.type === "text" ? (
                        <MessageResponse key={`${message.id}-${i}`}>
                          {part.text}
                        </MessageResponse>
                      ) : null,
                    )}
                  </MessageContent>
                );
                return (
                  <Message
                    from={message.role}
                    key={message.id}
                    // Gleiche Höchstbreite links und rechts: eigene Bubble reicht nie weiter nach links als die Antwort nach rechts.
                    className={cn("max-w-[80%]", !restoredIds.current.has(message.id) && ENTER)}
                  >
                    {isAssistant ? (
                      <BotRow avatar={avatar} color={color}>
                        {content}
                      </BotRow>
                    ) : (
                      content
                    )}
                    {isAssistant && status === "streaming" && message.id === messages.at(-1)?.id && (
                      // shortcut: live nur geschätzt (≈ 4 Zeichen pro Token), echte Zahl kommt am Ende im Info-Knopf.
                      <span className="ml-8 text-[11px] text-muted-foreground tabular-nums">
                        ≈ {Math.ceil(text.length / 4).toLocaleString("de-DE")} Tokens
                      </span>
                    )}
                    {!(isAssistant && status === "streaming") && (
                      <MessageActions className="opacity-0 group-[.is-assistant]:ml-8 group-[.is-user]:ml-auto transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                        <CopyAction text={text} />
                        {isAssistant && <InfoAction meta={message.metadata} />}
                      </MessageActions>
                    )}
                  </Message>
                );
              })}
              {(status === "submitted" ||
                (status === "streaming" &&
                  !messages
                    .at(-1)
                    ?.parts.some((p) => p.type === "text" && p.text))) && (
                <TypingBubble avatar={avatar} color={color} />
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton className="z-20" />
      </Conversation>
      <div className="px-3 pt-2 pb-3">
        <PromptInput
          className="chat-prompt w-full"
          onSubmit={({ text }) => {
            if (modelId === NO_MODEL) {
              // Dev: nur eigene Nachricht anhängen, kein Request.
              const body = fillTo(text, chars);
              if (!body.trim()) return;
              void updateChatPreview(chatId, body);
              setMessages((m) => [
                ...m,
                { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: body }] },
              ]);
              return;
            }
            if (text.trim() && model) {
              void updateChatPreview(chatId, text);
              sendMessage({ text }, { body: { model: model.id, effort, context } });
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Was möchtest du wissen?" className="min-h-10" onKeyDown={continueList} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelPicker models={models} modelId={modelId} onModelChange={setModelId} />
              {modelId === NO_MODEL && <CharsPicker chars={chars} onCharsChange={setChars} />}
              {model && effort && (
                <EffortPicker
                  model={model}
                  effort={effort as Effort}
                  onEffortChange={(e) => setEfforts((s) => ({ ...s, [model.id]: e }))}
                />
              )}
            <div className="group/ctx relative">
              {/* Hinweis beim Hovern und kurz nach dem Klick. */}
              <span
                role="status"
                className={cn(
                  "pointer-events-none absolute left-0 bottom-full mb-2 translate-y-1 rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md ring-1 ring-foreground/10 transition-[opacity,transform] duration-150 group-hover/ctx:translate-y-0 group-hover/ctx:opacity-100",
                  contextHint > 0 && "translate-y-0 opacity-100",
                )}
              >
                {context ? "Kontext an: Verlauf geht mit" : "Kontext aus: nur neue Nachricht"}
              </span>
              <PromptInputButton
                aria-pressed={context}
                aria-label={context ? "Kontext an" : "Kontext aus"}
                onClick={() => {
                  setContext((c) => !c);
                  setContextHint(Date.now());
                }}
                className={cn(!context && "text-muted-foreground opacity-60")}
              >
                <HistoryIcon className="size-4" />
              </PromptInputButton>
            </div>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} disabled={!model && modelId !== NO_MODEL} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
