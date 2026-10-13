"use client";

import { ChevronRightIcon } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { BotDialog, type EditableBot } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";

// Scroll-Strecke, auf der die Kopfzeile zusammenfährt; davor bleibt sie groß.
const START = 48;
const RANGE = 140;
const H_BIG = 158;
const H_SMALL = 56;
const AV_BIG = 64;
const AV_SMALL = 32;
const GAP = 12;
const PILL_SCALE = 0.75;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - (1 - t) ** 3;

// Groß oben (Avatar über Name). Beim Scrollen schrumpft der Avatar, wandert wie auf einer
// Schiene nach links und der Name rückt erst danach nach oben. So kreuzen sie sich nie.
export function ChatHeader({ bot }: { bot: EditableBot }) {
  const header = useRef<HTMLElement>(null);
  const avatarEl = useRef<HTMLDivElement>(null);
  const pillEl = useRef<HTMLDivElement>(null);
  const labelEl = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const pill = pillEl.current;
    if (!pill) return;
    const render = () => {
      const p = clamp((window.scrollY - START) / RANGE);
      const tAvatar = ease(clamp(p / 0.6)); // Avatar zuerst ...
      const tPill = ease(clamp((p - 0.5) / 0.5)); // ... dann der Name

      const w = pill.offsetWidth; // unskalierte Größe
      const h = pill.offsetHeight;
      const wSmall = w * PILL_SCALE;

      const size = lerp(AV_BIG, AV_SMALL, tAvatar);
      // Endzustand: [Avatar][Lücke][Name] als Zeile mittig.
      const total = AV_SMALL + GAP + wSmall;
      const avatarX = lerp(0, -total / 2 + AV_SMALL / 2, tAvatar);
      const avatarY = lerp(16 + AV_BIG / 2, H_SMALL / 2, tAvatar);

      const scale = lerp(1, PILL_SCALE, tPill);
      const pillX = lerp(0, (AV_SMALL + GAP) / 2, clamp(tPill * 1.6));
      const pillY = lerp(16 + AV_BIG + GAP + h / 2, H_SMALL / 2, tPill);

      header.current!.style.height = `${lerp(H_BIG, H_SMALL, p)}px`;

      const a = avatarEl.current!.style;
      a.width = a.height = `${size}px`;
      a.transform = `translate(calc(-50% + ${avatarX}px), ${avatarY - size / 2}px)`;

      pill.style.transform = `translate(calc(-50% + ${pillX}px), ${pillY - h / 2}px) scale(${scale})`;

      const label = labelEl.current!.style;
      label.opacity = String(1 - clamp(p / 0.35));
    };

    // Schreibt nur Styles direkt, kein React-Render: pro Scroll-Ereignis billig genug.
    const onScroll = render;
    const resize = new ResizeObserver(onScroll);
    resize.observe(pill);

    render();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      resize.disconnect();
    };
  }, []);

  return (
    <header
      ref={header}
      style={{ height: H_BIG }}
      className="sticky top-0 z-10 bg-background/80 backdrop-blur"
    >
      <div
        ref={avatarEl}
        className="absolute top-0 left-1/2"
        style={{ width: AV_BIG, height: AV_BIG, transform: `translate(-50%, 16px)` }}
      >
        <ChatAvatar seed={bot.avatar} color={bot.color} className="size-full" />
      </div>
      <div ref={pillEl} className="absolute top-0 left-1/2 w-max">
        {/* Klick öffnet den Dialog zum Bearbeiten des Bots. */}
        <BotDialog
          bot={bot}
          trigger={
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-xl font-semibold whitespace-nowrap transition-colors hover:bg-muted/70"
            >
              {bot.name}
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          }
        />
      </div>
      <span
        ref={labelEl}
        style={{ top: 16 + AV_BIG + GAP + 40 + 8 }}
        className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-muted-foreground"
      >
        Gespräch
      </span>
    </header>
  );
}
