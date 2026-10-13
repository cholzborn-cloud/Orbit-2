"use client";

import { BrainIcon, CheckIcon, ChevronDownIcon, CircleOffIcon } from "lucide-react";
import { useState } from "react";

import { ProviderIcon } from "@/components/provider-icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  DEV_CHAR_STEPS,
  DEV_NO_MODEL,
  EFFORT_LABELS,
  NO_MODEL,
  type ChatModel,
  type Effort,
} from "@/lib/chat-catalog";

const NO_MODEL_OPTION: ChatModel = {
  id: NO_MODEL,
  label: "Kein Modell",
  description: "Dev: sendet ohne Antwort",
  provider: "anthropic", // ungenutzt, Icon wird ersetzt
  efforts: [],
};

// *:py-2.5 vergrößert die klickbare Fläche der Leiste (Control), nicht nur die 3-px-Schiene.
const SLIDER =
  "*:py-2.5 **:data-[slot=slider-track]:h-[3px] **:data-[slot=slider-track]:bg-foreground/10 **:data-[slot=slider-range]:transition-[width] **:data-[slot=slider-range]:duration-150 **:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:shadow-sm **:data-[slot=slider-thumb]:transition-[left,box-shadow]";

// Position eines Einrastpunkts: Thumb (14 px) sitzt an den Rändern bündig.
const stepLeft = (i: number, count: number) => `calc(7px + (100% - 14px) * ${i / (count - 1)})`;

// Punkte an jedem Einrastpunkt, im gefüllten Teil weiß wie die Schiene.
// Klicks gehen durch auf die Leiste: die rastet selbst beim nächsten Punkt ein.
function SliderDots({ count, index }: { count: number; index: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{ left: stepLeft(i, count) }}
          className={cn(
            "absolute top-1/2 z-10 size-1 -translate-1/2 rounded-full transition-colors duration-150",
            i <= index ? "bg-primary" : "bg-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

const charLabel = (n: number) => (n === 0 ? "Aus" : n >= 1000 ? `${n / 1000}k` : String(n));

// Dev: Zeichenzahl, auf die eine Nachricht ohne Modell aufgefüllt wird.
export function CharsPicker({ chars, onCharsChange }: { chars: number; onCharsChange: (n: number) => void }) {
  const index = Math.max(0, DEV_CHAR_STEPS.indexOf(chars));
  const count = DEV_CHAR_STEPS.length;
  return (
    <Popover>
      <PopoverTrigger className={TRIGGER} aria-label="Zeichenzahl wählen">
        <span className="tabular-nums">{chars ? `${charLabel(chars)} Zeichen` : "Text"}</span>
        <ChevronDownIcon className={CHEVRON} />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className={cn(PANEL, "w-64 p-3")}>
        <div className="flex items-center justify-between gap-3 text-[13px] font-medium">
          <span>Zeichen senden</span>
          <span className="tabular-nums">{chars.toLocaleString("de-DE")}</span>
        </div>
        <div className="relative mt-3.5">
          <Slider
            min={0}
            max={count - 1}
            step={1}
            value={[index]}
            onValueChange={(v) => onCharsChange(DEV_CHAR_STEPS[Array.isArray(v) ? v[0] : v] ?? 0)}
            aria-label="Zeichenzahl"
            className={SLIDER}
          />
          <SliderDots count={count} index={index} />
        </div>
        <div className="relative mt-2 h-4">
          {DEV_CHAR_STEPS.map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => onCharsChange(n)}
              style={{ left: stepLeft(i, count) }}
              className={cn(
                "absolute top-0 -translate-x-1/2 rounded px-0.5 text-[11px] leading-4 tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                i === index ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {charLabel(n)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Gemeinsames Material für beide Popovers.
// Ein-/Ausblenden per Transition (base-ui setzt data-starting-style/-ending-style), Standard-Animation aus.
const PANEL =
  "gap-0 rounded-xl bg-popover p-1 shadow-lg ring-1 ring-foreground/10 data-open:animate-none data-closed:animate-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-starting-style:translate-y-1.5 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:translate-y-1.5 data-ending-style:scale-95 data-ending-style:opacity-0";
const TRIGGER =
  "group/trigger flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground";
const CHEVRON = "size-3 opacity-60 transition-transform group-data-popup-open/trigger:rotate-180";

export function ModelPicker({
  models,
  modelId,
  onModelChange,
}: {
  models: ChatModel[];
  modelId: string;
  onModelChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = DEV_NO_MODEL ? [...models, NO_MODEL_OPTION] : models;
  const current = options.find((m) => m.id === modelId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={TRIGGER} aria-label="Modell wählen">
        {current && current.id !== NO_MODEL && (
          <ProviderIcon provider={current.provider} className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{current?.label ?? "Kein Modell"}</span>
        <ChevronDownIcon className={CHEVRON} />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className={cn(PANEL, "w-60")}>
        <div role="listbox" aria-label="Modell" className="relative flex flex-col gap-0.5">
          {/* Gleitender Hintergrund: wandert beim Wechsel zwischen den Zeilen. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-lg bg-muted transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateY(${Math.max(0, options.findIndex((m) => m.id === modelId)) * 42}px)` }}
          />
          {options.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m.id === modelId}
              onClick={() => {
                onModelChange(m.id);
              }}
              className="relative flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-foreground transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
            >
              {m.id === NO_MODEL ? (
                <CircleOffIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ProviderIcon provider={m.provider} className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate leading-4">{m.label}</span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">{m.description}</span>
              </span>
              <CheckIcon
                className={cn(
                  "size-3.5 shrink-0 transition-opacity duration-150",
                  m.id === modelId ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EffortPicker({
  model,
  effort,
  onEffortChange,
}: {
  model: ChatModel;
  effort: Effort;
  onEffortChange: (effort: Effort) => void;
}) {
  const levels = model.efforts;
  if (levels.length === 0) return null;

  const index = Math.max(0, levels.indexOf(effort));
  const isMax = levels.length > 1 && index === levels.length - 1;

  return (
    <Popover>
      {/* Gehirn plus Stufe; bei Max leuchten beide golden. */}
      <PopoverTrigger className={TRIGGER} aria-label={`Denktiefe: ${EFFORT_LABELS[effort]}`}>
        <BrainIcon
          className={cn(
            "size-4 shrink-0 transition-[color,filter] duration-200",
            isMax && "text-[#e8c77a] drop-shadow-[0_0_6px_rgb(232_199_122/0.7)]",
          )}
        />
        <span className={cn(isMax && "effort-gold effort-gold-text")}>{EFFORT_LABELS[effort]}</span>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className={cn(PANEL, "w-60 p-3 duration-[400ms]")}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
            <ProviderIcon provider={model.provider} className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{model.label}</span>
          </span>
          <span
            className={cn(
              "shrink-0 text-[13px] font-medium tabular-nums",
              isMax && "effort-gold effort-gold-text",
            )}
          >
            {EFFORT_LABELS[effort]}
          </span>
        </div>
        {levels.length > 1 ? (
          <div className="mt-3.5">
            <div className="relative">
            <Slider
              min={0}
              max={levels.length - 1}
              step={1}
              value={[index]}
              onValueChange={(v) => {
                const i = Array.isArray(v) ? v[0] : v;
                if (levels[i]) onEffortChange(levels[i]);
              }}
              aria-label="Denktiefe"
              className={cn(SLIDER, isMax && "effort-max")}
            />
            <SliderDots count={levels.length} index={index} />
            </div>
            <div className="relative mt-2 h-4">
              {levels.map((l, i) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onEffortChange(l)}
                  style={{ left: stepLeft(i, levels.length) }}
                  className={cn(
                    "absolute top-0 -translate-x-1/2 rounded px-0.5 text-[11px] leading-4 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    i === index ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                    i === index && i === levels.length - 1 && "effort-gold effort-gold-text",
                  )}
                >
                  {EFFORT_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Dieses Modell hat keine einstellbare Denktiefe.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
