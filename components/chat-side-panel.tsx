"use client";

import { MaximizeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePanelRef } from "react-resizable-panels";

import { getBotDesktopUrl } from "@/actions/bot";
import { BotForm, type EditableBot } from "@/components/bot-dialog";
import { CLEAR_EVENT } from "@/components/chat-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ResizablePanel } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

export const PANEL_TOGGLE_EVENT = "orbit-panel-toggle";

// Panel gleitet von rechts ein und aus: Übergang nur für diese Umschaltung, Ziehen bleibt direkt.
export function slidePanels() {
  const group = document.querySelector<HTMLElement>("[data-slot=resizable-panel-group]");
  if (!group || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  group.dataset.sliding = "";
  setTimeout(() => delete group.dataset.sliding, 450);
}

// Breite des Seitenpanels, für alle Chats und Gruppen gleich; wird beim Schließen gemerkt.
const WIDTH_KEY = "orbit-side-panel-width";
const DEFAULT_WIDTH = 380;
// Obergrenze für Chat und Gruppe gleich.
export const PANEL_MAX_WIDTH = 520;

const storedWidth = () => {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w > 0 ? Math.min(w, PANEL_MAX_WIDTH) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

// Header-Pille klappt das Panel auf und zu; gemerkte Breite beim Öffnen, aktuelle beim Schließen sichern.
export function useSidePanelToggle(panel: ReturnType<typeof usePanelRef>) {
  useEffect(() => {
    const toggle = () => {
      const p = panel.current;
      if (!p) return;
      slidePanels();
      if (p.isCollapsed()) {
        p.resize(storedWidth());
      } else {
        try {
          localStorage.setItem(WIDTH_KEY, String(Math.round(p.getSize().inPixels)));
        } catch {}
        p.collapse();
      }
    };
    window.addEventListener(PANEL_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(PANEL_TOGGLE_EVENT, toggle);
  }, [panel]);
}

// Zwei Spalten: bei schmalem Panel bricht keine Schaltfläche einzeln in eine neue Zeile.
const PanelFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

// Rechtes Panel im Chat: startet zugeklappt, der Header klappt es per Ereignis auf und zu.
export function ChatSidePanel({ bot, chatId }: { bot: EditableBot; chatId: string }) {
  const panel = usePanelRef();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("edit");
  const [desktop, setDesktop] = useState<{ url?: string; error?: string }>();
  const [fullscreen, setFullscreen] = useState(false);
  // Zielflächen für das eine iframe: Vorschau im Panel oder Fläche im Dialog.
  const [previewSlot, setPreviewSlot] = useState<HTMLElement | null>(null);
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null);

  useSidePanelToggle(panel);

  // Desktop nur einmal laden, beim ersten Öffnen des Tabs.
  const showDesktop = expanded && tab === "desktop";
  const requested = useRef(false);
  useEffect(() => {
    if (!showDesktop || requested.current) return;
    requested.current = true;
    getBotDesktopUrl(bot.id).then((res) => setDesktop(res.ok ? { url: res.url } : { error: res.error }));
  }, [showDesktop, bot.id]);

  return (
    <ResizablePanel
      id="side"
      panelRef={panel}
      collapsible
      // Ziehen klappt nie ganz zu: nur der Knopf im Header schließt das Panel.
      collapsedThreshold="100%"
      collapsedSize={0}
      defaultSize={0}
      minSize="25"
      maxSize={PANEL_MAX_WIDTH}
      onResize={(size) => setExpanded(size.inPixels > 0)}
      className="flex flex-col items-end overflow-hidden"
    >
      {/* Feste Mindestbreite, rechts verankert: beim Gleiten bricht der Inhalt nicht um, er schiebt sich nur ein. */}
      <div className="flex min-h-0 w-full min-w-60 flex-1 flex-col">
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 p-3">
        {/* Segment-Schalter im Glas-Stil der Header-Pille; die Markierung gleitet zum aktiven Tab. */}
        <TabsList className="relative h-9 w-full shrink-0 rounded-full bg-foreground/[0.06] p-1 ring-1 ring-foreground/10 backdrop-blur-xl contrast-more:bg-background contrast-more:ring-foreground/25">
          <TabsPrimitive.Indicator className="absolute top-1 bottom-1 left-0 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-foreground/15 shadow-sm ring-1 ring-foreground/15 transition-[translate,width] duration-200 ease-out motion-reduce:transition-none [[data-sliding]_&]:transition-none" />
          {["edit", "desktop"].map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="z-10 h-full rounded-full first:-mr-px last:-ml-px not-data-active:hover:bg-foreground/[0.05] data-active:border-transparent data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent"
            >
              {v === "edit" ? "Bearbeiten" : "Computer"}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Innenabstand im Scrollbereich, sonst schneidet er Auswahlringe am Rand ab. */}
        <TabsContent value="edit" className="-mx-3 min-h-0 overflow-y-auto px-3 pt-1">
          <BotForm
            bot={bot}
            onDone={() => {}}
            onClearHistory={() => window.dispatchEvent(new CustomEvent(CLEAR_EVENT, { detail: chatId }))}
            Footer={PanelFooter}
            className="pb-4"
          />
        </TabsContent>
        <TabsContent value="desktop">
          {desktop?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{desktop.error}</AlertDescription>
            </Alert>
          ) : desktop?.url ? (
            <button
              ref={setPreviewSlot}
              type="button"
              aria-label="Computer im Vollbild öffnen"
              onClick={() => setFullscreen(true)}
              className="group relative aspect-video w-full overflow-hidden rounded-lg ring-1 ring-foreground/10"
            >
              {/* Über dem iframe (z-40), damit der Hinweis sichtbar bleibt. */}
              <span className="absolute right-2 bottom-2 z-41 rounded-md bg-background/80 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <MaximizeIcon className="size-4" />
              </span>
            </button>
          ) : (
            <Skeleton className="aspect-video w-full rounded-lg" />
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={fullscreen}
        // Nur der Schließen-Knopf schließt: Escape, Klicks und Fokuswechsel ins iframe nicht.
        onOpenChange={(open, { reason }) => (open || reason === "close-press") && setFullscreen(open)}
        disablePointerDismissal
        // Nicht modal: sonst macht der Dialog das iframe (außerhalb des Popups) inert und fängt den Fokus ab.
        modal={false}
      >
        <DialogContent className="flex h-[90svh] w-[95vw] flex-col p-3 pt-10 sm:max-w-none">
          <DialogTitle className="sr-only">Computer von {bot.name}</DialogTitle>
          <div ref={setDialogSlot} className="min-h-0 flex-1 rounded-lg" />
        </DialogContent>
      </Dialog>

      {desktop?.url && (
        <DesktopFrame
          url={desktop.url}
          target={fullscreen ? dialogSlot : showDesktop ? previewSlot : null}
          interactive={fullscreen}
        />
      )}
    </div>
    </ResizablePanel>
  );
}

// Ein einziges iframe für Vorschau und Vollbild: Umhängen im DOM würde VNC neu laden,
// darum liegt es fest im body und wird nur über die jeweilige Zielfläche gelegt.
export function DesktopFrame({ url, target, interactive }: { url: string; target: HTMLElement | null; interactive: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = frame.current!;
    if (!target) {
      el.style.visibility = "hidden";
      return;
    }
    let raf = 0;
    // Jeden Frame nachführen: folgt Panel-Ziehen, Scrollen und der Dialog-Animation.
    const follow = () => {
      const r = target.getBoundingClientRect();
      Object.assign(el.style, {
        visibility: "visible",
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return createPortal(
    <iframe
      ref={frame}
      src={url}
      title="Computer"
      allow="clipboard-read; clipboard-write"
      // Vorschau: Klicks gehen an die Fläche darunter (öffnet Vollbild). Vollbild: über dem Dialog (z-50).
      className={
        interactive
          ? "fixed z-60 rounded-lg border-0"
          : "pointer-events-none fixed z-40 rounded-lg border-0"
      }
      style={{ visibility: "hidden" }}
      tabIndex={interactive ? 0 : -1}
    />,
    document.body,
  );
}
