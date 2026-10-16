"use client";

import { ChevronRightIcon } from "lucide-react";
import { useImperativeHandle, useLayoutEffect, useRef, type Ref, type RefObject } from "react";
import type { StickToBottomContext } from "use-stick-to-bottom";

import type { EditableBot } from "@/components/bot-dialog";
import { GroupAvatar } from "@/components/group-avatar";
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
    // Panel auf-/zuklappen ändert die Breite, der Text bricht um und der Scroll springt: nicht einrasten.
    let frozenUntil = 0;
    const onPanelToggle = () => {
      frozenUntil = performance.now() + 600;
      lastInput = -Infinity;
      deltas = [];
      cancelAnimationFrame(anim);
      anim = 0;
    };

    // Ziehen am Panel-Griff: Umbruch und Scroll-Feder verschieben scrollTop, der Header darf dem nicht hinterherlaufen.
    let lastW = el.clientWidth;
    let unfreeze: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      frozenUntil = performance.now() + 250;
      lastInput = -Infinity;
      deltas = [];
      cancelAnimationFrame(anim);
      anim = 0;
      clearTimeout(unfreeze);
      unfreeze = setTimeout(() => header.current?.setProgress(reduced.matches ? 1 : headerProgress(el.scrollTop)), 260);
    });
    ro.observe(el);

    // Reduce Motion: Header fix kompakt.
    const update = () => header.current?.setProgress(reduced.matches ? 1 : headerProgress(el.scrollTop));
    const onInput = () => {
      lastInput = performance.now();
      cancelAnimationFrame(anim); // neuer Input bricht das Einrasten sofort ab
      anim = 0;
    };
    const settle = () => {
      const now = performance.now();
      if (reduced.matches || anim || now < frozenUntil || now - lastInput > USER_WINDOW_MS) return;
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
      if (now >= frozenUntil) update();
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
    window.addEventListener(PANEL_TOGGLE_EVENT, onPanelToggle);
    update();
    return () => {
      inputs.forEach((e) => el.removeEventListener(e, onInput));
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
      reduced.removeEventListener("change", update);
      window.removeEventListener(PANEL_TOGGLE_EVENT, onPanelToggle);
      cancelAnimationFrame(anim);
      clearTimeout(timer);
      clearTimeout(unfreeze);
      ro.disconnect();
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
const CHEVRON = 12;
const PAD_X = 14;
const GAP = 7;

export function ChatHeader({
  ref,
  bot,
  dots,
  title,
}: {
  ref: Ref<ChatHeaderHandle>;
  bot: EditableBot;
  dots: Dot[];
  title?: string; // Gruppenname
}) {
  const root = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const avatars = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const state = useRef({ p: 0 });

  // Schreibt nur Styles, kein React-Render: läuft bei jedem Scroll-Ereignis.
  // Breiten-abhängiges (Mitte, Kürzen, Avatar neben der Pille) löst CSS selbst, damit das Ziehen des Panels ohne Verzögerung folgt.
  const render = () => {
    const { p } = state.current;
    // Orbi genau so hoch wie die Namens-Pille.
    const size = AV_BIG - p * (AV_BIG - AV_SMALL);
    const nameH = 44 - p * 8;
    const fs = 24 - p * 8;

    const tx = smooth(clamp01(p * 2));
    const ty = smooth(clamp01((p - 0.5) * 2));
    // Klein: [Avatar][ROW_GAP][Name] mittig, beide vertikal zentriert. Groß: Avatar über Name mit STACK_GAP.
    const ay = 75 - 31 * ty;
    const nyBig = 75 + AV_BIG / 2 + STACK_GAP + 22;
    const ny = nyBig - (nyBig - 44) * ty;

    const h = height(p);
    root.current!.style.height = `${h}px`;
    band.current!.style.height = `${h - 24}px`;

    // Pille: Mitte des Headers, bei klein um die halbe Avatar-Breite nach rechts.
    const n = pill.current!.style;
    n.height = `${nameH}px`;
    n.fontSize = `${fs}px`;
    n.maxWidth = `max(80px, calc(100% - ${size + 48}px))`;
    n.left = `calc(50% + ${((size + ROW_GAP) * tx) / 2}px)`;
    n.transform = `translate(-50%, ${ny - nameH / 2}px)`;

    // Avatar hängt an der Pille: groß mittig darüber, klein links daneben (Prozent = Pillenbreite).
    const a = avatars.current!.style;
    a.setProperty("--s", `${size}px`);
    a.width = `${size}px`;
    a.left = `calc(${(1 - tx) * 50}% - ${tx * (ROW_GAP + size / 2)}px)`;
    a.top = `${ay - size / 2 - (ny - nameH / 2)}px`;
  };

  useImperativeHandle(ref, () => ({
    setProgress: (p) => {
      state.current.p = p;
      render();
    },
  }));

  useLayoutEffect(() => {
    render();
    root.current!.style.visibility = "visible";
  });

  return (
    <div ref={root} className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: 183, visibility: "hidden" }}>
      {/* Hintergrundleiste: voller Hintergrundton, darunter 48 px Verlauf zu transparent. Keine harte Kante. */}
      <div aria-hidden className="absolute inset-x-0 top-0">
        <div ref={band} className="bg-background" style={{ height: 159 }} />
        <div className="h-12 bg-linear-to-b from-background to-transparent" />
      </div>
      <div ref={pill} className="absolute top-0 w-max" style={{ height: 44, fontSize: 24 }}>
      <div
        ref={avatars}
        className="pointer-events-none absolute -translate-x-1/2 flex"
        style={{ height: "var(--s)", ["--s" as string]: `${AV_BIG}px` }}
      >
        {/* Gruppe: alle Mitglieder in einem Avatar gleicher Größe. */}
        <GroupAvatar members={dots} style={{ width: "var(--s)", height: "var(--s)" }} />
      </div>

        {/* Klick klappt das rechte Panel (ChatSidePanel) auf und zu. */}
        <button
          type="button"
          aria-label={title ?? `Kontakt ${bot.name}`}
          onClick={() => window.dispatchEvent(new Event(PANEL_TOGGLE_EVENT))}
          // Glas wie orbitGlass(22, interactive): Blur, heller Schleier, feiner Rand; bei mehr Kontrast deckend.
          className="pointer-events-auto flex h-full max-w-full items-center rounded-[22px] bg-foreground/[0.06] font-semibold shadow-sm ring-1 ring-foreground/10 backdrop-blur-xl transition-colors hover:bg-foreground/10 contrast-more:bg-background contrast-more:ring-foreground/25"
          style={{ paddingInline: PAD_X, gap: GAP }}
        >
          <span className="truncate whitespace-nowrap">
            {title ?? bot.name}
          </span>
          <ChevronRightIcon className="shrink-0" style={{ width: CHEVRON, height: CHEVRON }} />
        </button>
      </div>
    </div>
  );
}
