"use client";

import { ChevronRightIcon } from "lucide-react";
import { useImperativeHandle, useLayoutEffect, useRef, type Ref, type RefObject } from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";

import type { EditableBot } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { PANEL_TOGGLE_EVENT } from "@/components/chat-side-panel";
import { HEADER_SNAP_MS, headerProgress, snapTarget } from "@/lib/header-snap";

// Nur Nutzer-Gesten rasten ein, nicht Autoscroll. Fenster deckt Trackpad-/Touch-Momentum ab.
const USER_WINDOW_MS = 1500;
const DIR_WINDOW_MS = 150;
const DIR_MIN_PX = 4;

// Scroll-Anbindung: p folgt dem Offset live, nach dem Loslassen rastet es auf 0 oder D ein.
export function useHeaderScroll(
  conv: RefObject<StickToBottomContext | null>,
  header: RefObject<ChatHeaderHandle | null>,
  ready: boolean,
) {
  useLayoutEffect(() => {
    const el = conv.current?.scrollRef.current;
    if (!el || !ready) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let lastInput = -Infinity;
    let anim = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let prev = el.scrollTop;
    let deltas: { t: number; d: number }[] = [];

    // Reduce Motion: Header fix kompakt.
    const update = () => header.current?.setProgress(reduced.matches ? 1 : headerProgress(el.scrollTop));
    const onInput = () => {
      lastInput = performance.now();
      cancelAnimationFrame(anim); // neuer Input bricht das Einrasten sofort ab
      anim = 0;
    };
    const settle = () => {
      const now = performance.now();
      if (reduced.matches || anim || now - lastInput > USER_WINDOW_MS) return;
      lastInput = -Infinity;
      const sum = deltas.filter((x) => now - x.t < DIR_WINDOW_MS).reduce((s, x) => s + x.d, 0);
      const dir = Math.abs(sum) >= DIR_MIN_PX ? Math.sign(sum) : 0;
      const target = snapTarget(el.scrollTop, dir, el.scrollHeight - el.clientHeight);
      if (target === null) return;
      const from = el.scrollTop;
      const step = (t: number) => {
        const k = Math.min(1, (t - now) / HEADER_SNAP_MS);
        el.scrollTop = from + (target - from) * (1 - (1 - k) ** 3); // easeOut
        anim = k < 1 ? requestAnimationFrame(step) : 0;
      };
      anim = requestAnimationFrame(step);
    };
    const hasScrollEnd = "onscrollend" in el;
    const onScroll = () => {
      const now = performance.now();
      deltas = deltas.filter((x) => now - x.t < DIR_WINDOW_MS);
      deltas.push({ t: now, d: el.scrollTop - prev });
      prev = el.scrollTop;
      update();
      if (!hasScrollEnd) {
        clearTimeout(timer);
        timer = setTimeout(settle, 120);
      }
    };

    const inputs = ["wheel", "touchstart", "touchend", "pointerdown", "pointerup", "keydown"] as const;
    inputs.forEach((e) => el.addEventListener(e, onInput, { passive: true }));
    el.addEventListener("scroll", onScroll, { passive: true });
    if (hasScrollEnd) el.addEventListener("scrollend", settle);
    reduced.addEventListener("change", update);
    update();
    return () => {
      inputs.forEach((e) => el.removeEventListener(e, onInput));
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
      reduced.removeEventListener("change", update);
      cancelAnimationFrame(anim);
      clearTimeout(timer);
    };
  }, [conv, header, ready]);
}

export const CLEAR_EVENT = "orbit-chat-clear";
// Freifläche oben im Chat, unter dem großen Header.
export const HEADER_SPACER = 170;

// Übernommen aus Orbit 1 (ChatIdentityLayout): erste Hälfte nebeneinander, zweite Hälfte nach oben.
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const height = (p: number) => 183 - 95 * smooth(clamp01((p - 0.5) * 2));

export type ChatHeaderHandle = { setProgress: (p: number) => void };
type Dot = { avatar: string; color: string | null };

// Maße nach Constis Vorlage (13.10.2026): groß Orbi 50 über Pille 44, klein Orbi so hoch wie Pille (36).
const AV_BIG = 50;
const AV_SMALL = 36;
const STACK_GAP = 22;
const ROW_GAP = 8;
const OVERLAP = 0.38;
const CHEVRON = 12;
const PAD_X = 14;
const GAP = 7;

export function ChatHeader({
  ref,
  bot,
  dots: allDots,
}: {
  ref: Ref<ChatHeaderHandle>;
  bot: EditableBot;
  dots: Dot[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const avatars = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const state = useRef({ p: 0, width: 400, text24: 0 });

  const dots = allDots.slice(0, 3);
  const extra = Math.max(0, allDots.length - dots.length);

  // Schreibt nur Styles, kein React-Render: läuft bei jedem Scroll-Ereignis.
  const render = () => {
    const { p, width, text24 } = state.current;
    // Orbi genau so hoch wie die Namens-Pille.
    const size = AV_BIG - p * (AV_BIG - AV_SMALL);
    const nameH = 44 - p * 8;
    const fs = 24 - p * 8;
    const avatarW = size + Math.max(0, dots.length - 1) * size * (1 - OVERLAP) + (extra > 0 ? 30 : 0);
    const maxName = Math.max(80, width - avatarW - 48);
    // Textbreite einmal bei 24 px gemessen, skaliert linear mit der Schrift.
    const nameW = Math.min(maxName, text24 * (fs / 24) + PAD_X * 2 + GAP + CHEVRON);

    const tx = smooth(clamp01(p * 2));
    const ty = smooth(clamp01((p - 0.5) * 2));
    const mid = width / 2;
    // Klein: [Avatar][ROW_GAP][Name] mittig, beide vertikal zentriert. Groß: Avatar über Name mit STACK_GAP.
    const ax = mid - ((nameW + ROW_GAP) * tx) / 2;
    const ay = 75 - 31 * ty;
    const nx = mid + ((avatarW + ROW_GAP) * tx) / 2;
    const nyBig = 75 + AV_BIG / 2 + STACK_GAP + 22;
    const ny = nyBig - (nyBig - 44) * ty;

    const h = height(p);
    root.current!.style.height = `${h}px`;
    band.current!.style.height = `${h - 24}px`;

    const a = avatars.current!.style;
    a.setProperty("--s", `${size}px`);
    a.width = `${avatarW}px`;
    a.transform = `translate(${ax - avatarW / 2}px, ${ay - size / 2}px)`;

    const n = pill.current!.style;
    n.height = `${nameH}px`;
    n.fontSize = `${fs}px`;
    n.maxWidth = `${maxName}px`;
    n.transform = `translate(${nx - nameW / 2}px, ${ny - nameH / 2}px)`;
  };

  useImperativeHandle(ref, () => ({
    setProgress: (p) => {
      state.current.p = p;
      render();
    },
  }));

  useLayoutEffect(() => {
    const measure = () => {
      state.current.width = root.current!.offsetWidth;
      // Ungekürzte Breite bei 24 px (scrollWidth ignoriert das Abschneiden).
      state.current.text24 = (text.current!.scrollWidth * 24) / parseFloat(getComputedStyle(text.current!).fontSize);
      render();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(root.current!);
    measure();
    return () => resize.disconnect();
  });

  return (
    <div ref={root} className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: 183 }}>
      {/* Hintergrundleiste: voller Hintergrundton, darunter 48 px Verlauf zu transparent. Keine harte Kante. */}
      <div aria-hidden className="absolute inset-x-0 top-0">
        <div ref={band} className="bg-background" style={{ height: 159 }} />
        <div className="h-12 bg-linear-to-b from-background to-transparent" />
      </div>
      <div
        ref={avatars}
        className="absolute top-0 left-0 flex"
        style={{ height: "var(--s)", ["--s" as string]: `${AV_BIG}px` }}
      >
        {/* Rahmen = sichtbare Größe, damit Abstände zur Pille stimmen; weitere Dots überlappen. */}
        {dots.map((d, i) => (
          <ChatAvatar
            key={i}
            seed={d.avatar}
            color={d.color}
            className="shrink-0"
            style={{ width: "var(--s)", height: "var(--s)", marginLeft: i ? `calc(var(--s) * -${OVERLAP})` : 0 }}
          />
        ))}
        {extra > 0 && (
          <span className="flex w-[30px] shrink-0 items-center justify-center text-xs font-semibold">+{extra}</span>
        )}
      </div>
      <div ref={pill} className="pointer-events-auto absolute top-0 left-0 w-max" style={{ height: 44, fontSize: 24 }}>
        {/* Klick klappt das rechte Panel (ChatSidePanel) auf und zu. */}
        <button
          type="button"
          aria-label={`Kontakt ${bot.name}`}
          onClick={() => window.dispatchEvent(new Event(PANEL_TOGGLE_EVENT))}
          // Glas wie orbitGlass(22, interactive): Blur, heller Schleier, feiner Rand; bei mehr Kontrast deckend.
          className="flex h-full max-w-full items-center rounded-[22px] bg-foreground/[0.06] font-semibold shadow-sm ring-1 ring-foreground/10 backdrop-blur-xl transition-colors hover:bg-foreground/10 contrast-more:bg-background contrast-more:ring-foreground/25"
          style={{ paddingInline: PAD_X, gap: GAP }}
        >
          <span ref={text} className="truncate whitespace-nowrap">
            {bot.name}
          </span>
          <ChevronRightIcon className="shrink-0" style={{ width: CHEVRON, height: CHEVRON }} />
        </button>
      </div>
    </div>
  );
}
