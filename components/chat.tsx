"use client";

import { useChat } from "@ai-sdk/react";
import { useChatActions, useLoadTranscript, useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
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
import { loadTranscript, mintChatAccessToken, startChatSession, touchChat } from "@/actions/chat";
import type { EditableBot } from "@/components/bot-dialog";
import type { orbitChat } from "@/trigger/chat";
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

type ChatProps = {
  chatId: string;
  models: ChatModel[];
  avatar?: string | null;
  color?: string | null;
  bot: EditableBot;
  dots: { avatar: string; color: string | null }[];
};

function readSession(chatId: string) {
  try {
    const raw = localStorage.getItem(`orbit-chat-session:${chatId}`);
    return raw ? { [chatId]: JSON.parse(raw) } : undefined;
  } catch {
    return undefined;
  }
}

// Verlauf liegt im Transcript-Storage des Chat-Agents (je Chat-ID). Erst laden, dann den Chat mounten.
export function Chat(props: ChatProps) {
  const { chatId } = props;
  const transport = useTriggerChatTransport<typeof orbitChat>({
    task: "orbit-chat",
    // Sitzungsstand im Browser halten: nach Reload hängt sich der Chat an die laufende Antwort.
    sessions: readSession(chatId),
    onSessionChange: (id, session) => {
      try {
        const key = `orbit-chat-session:${id}`;
        if (session) localStorage.setItem(key, JSON.stringify(session));
        else localStorage.removeItem(key);
      } catch {}
    },
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) => startChatSession({ chatId, clientData }),
  });
  const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, { transport });
  // Leerer Platz in der Größe des Chats, damit das Layout nicht springt.
  if (isLoading) return <div className="relative flex min-h-0 flex-1 flex-col" />;
  return <ChatBody {...props} transport={transport} initialMessages={messages as UIMessage<ChatMetadata>[]} />;
}

function ChatBody({
  chatId,
  models,
  avatar: avatarProp,
  color,
  bot,
  dots,
  transport,
  initialMessages,
}: ChatProps & {
  transport: ReturnType<typeof useTriggerChatTransport<typeof orbitChat>>;
  initialMessages: UIMessage<ChatMetadata>[];
}) {
  const avatar = avatarProp || "erdi";
  // Zuletzt gewähltes Modell und Stufen je Chat, lokal im Browser.
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`orbit-chat-prefs:${chatId}`) ?? "{}") as {
        modelId?: string;
        efforts?: Record<string, Effort>;
      };
    } catch {
      return {};
    }
  });
  const [modelId, setModelId] = useState(
    models.some((m) => m.id === saved.modelId) || saved.modelId === NO_MODEL
      ? saved.modelId!
      : (models[0]?.id ?? ""),
  );
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
  const [efforts, setEfforts] = useState<Record<string, Effort>>(saved.efforts ?? {});
  useEffect(() => {
    try {
      localStorage.setItem(`orbit-chat-prefs:${chatId}`, JSON.stringify({ modelId, efforts }));
    } catch {}
  }, [chatId, modelId, efforts]);
  const { messages, setMessages, sendMessage, status, stop, resumeStream } = useChat<UIMessage<ChatMetadata>>({
    id: chatId,
    transport,
    messages: initialMessages,
  });

  // Seitenleiste zeigt die Zeit der letzten Nachricht: sobald eine Antwort endet (auch nach Reload), speichern.
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status !== "ready" || (was !== "streaming" && was !== "submitted")) return;
    void touchChat(chatId);
  }, [status, chatId]);

  // Läuft gerade eine Antwort, hängt sich der Chat nach Reload live wieder an den Stream.
  // Nur einmal: ein doppelter Aufruf (Strict Mode) bricht beide Verbindungen ab.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    void resumeStream();
  }, [resumeStream]);

  const { sendAction } = useChatActions({ sendMessage });
  // Gespeicherte Nachrichten erscheinen ohne Einblende-Animation.
  const restoredIds = useRef(new Set(initialMessages.map((m) => m.id)));
  // Beim Öffnen sofort ganz unten, vor dem ersten Zeichnen.
  const conv = useRef<StickToBottomContext>(null);
  useLayoutEffect(() => {
    const el = conv.current?.scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const header = useRef<ChatHeaderHandle>(null);
  useHeaderScroll(conv, header, true);
  // Neue Nachricht (eigene oder Antwort): immer nach unten.
  const count = messages.length;
  useEffect(() => {
    if (count > restoredIds.current.size) void conv.current?.scrollToBottom({ animation: SCROLL_SPRING });
  }, [count]);
  // Verlauf leeren aus dem Orbi-Dialog.
  useEffect(() => {
    const onClear = (e: Event) => {
      if ((e as CustomEvent).detail !== chatId) return;
      setMessages([]);
      restoredIds.current = new Set();
      void sendAction({ type: "clear" });
    };
    window.addEventListener(CLEAR_EVENT, onClear);
    return () => window.removeEventListener(CLEAR_EVENT, onClear);
  }, [chatId, setMessages, sendAction]);
  const model = models.find((m) => m.id === modelId);
  const userColor = color || ORBI_BASE_COLORS[orbiFromSeed(avatar)];
  const levels = model?.efforts ?? [];
  const effort =
    (model && efforts[model.id]) ||
    (levels.includes("medium") ? "medium" : levels[0]);
  // Agent validiert clientData schon beim Boot (auch bei Fortsetzung): Standardwerte am Transport setzen.
  transport.setClientData({ model: modelId, effort, context });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ChatHeader ref={header} bot={bot} dots={dots} chatId={chatId} />
      {/* Schnelle Feder: neue Nachrichten rollen zügig nach unten statt zu springen. */}
      <Conversation resize={SCROLL_SPRING} initial="instant" contextRef={conv}>
        <ConversationContent className="w-full px-3 pt-0">
          {/* Freifläche unter dem großen Header (Orbit 1: 170). */}
          <div aria-hidden className="shrink-0" style={{ height: HEADER_SPACER }} />
          {/* Vor dem Laden nichts zeigen, sonst blitzt kurz der leere Chat auf. */}
          {messages.length === 0 ? (
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
              void touchChat(chatId);
              setMessages((m) => [
                ...m,
                { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: body }] },
              ]);
              return;
            }
            if (text.trim() && model) {
              void touchChat(chatId);
              sendMessage({ text }, { metadata: { model: model.id, effort, context } });
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
