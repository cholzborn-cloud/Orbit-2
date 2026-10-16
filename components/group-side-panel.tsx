"use client";

import { MaximizeIcon, MessageCircleIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePanelRef } from "react-resizable-panels";

import { getBotDesktopUrl } from "@/actions/bot";
import { deleteGroup, updateGroup } from "@/actions/chat";
import { BotDialog, type EditableBot } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { CLEAR_EVENT } from "@/components/chat-header";
import { DesktopFrame, PANEL_MAX_WIDTH, useSidePanelToggle } from "@/components/chat-side-panel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ResizablePanel } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PanelBot = EditableBot & { chatId: string | null };

// Rechtes Panel im Gruppenchat: Name, Mitglieder, Verlauf leeren, Gruppe löschen.
export function GroupSidePanel({
  chatId,
  name: initialName,
  memberIds,
  allBots,
}: {
  chatId: string;
  name: string;
  memberIds: string[];
  allBots: PanelBot[];
}) {
  const router = useRouter();
  const panel = usePanelRef();
  const [name, setName] = useState(initialName);
  const [ids, setIds] = useState(memberIds);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState<"clear" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<EditableBot | null>(null);
  const [tab, setTab] = useState("group");
  // Computer: ein Orbi gleichzeitig; URLs je Orbi einmal laden.
  const [shown, setShown] = useState(memberIds[0]);
  const [desktops, setDesktops] = useState<
    Record<string, { url?: string; error?: string }>
  >({});
  const [fullscreen, setFullscreen] = useState(false);
  const [previewSlot, setPreviewSlot] = useState<HTMLElement | null>(null);
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null);
  const members = allBots.filter((b) => memberIds.includes(b.id));
  const current = members.find((b) => b.id === shown) ?? members[0];
  const showDesktop = expanded && tab === "computer";
  const currentId = current?.id;
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!showDesktop || !currentId || requested.current.has(currentId)) return;
    requested.current.add(currentId);
    getBotDesktopUrl(currentId).then((res) =>
      setDesktops((d) => ({
        ...d,
        [currentId]: res.ok ? { url: res.url } : { error: res.error },
      }))
    );
  }, [showDesktop, currentId]);
  const desktop = currentId ? desktops[currentId] : undefined;

  useSidePanelToggle(panel);

  const dirty =
    name !== initialName ||
    ids.length !== memberIds.length ||
    ids.some((i) => !memberIds.includes(i));

  const save = () =>
    startTransition(async () => {
      const res = await updateGroup(chatId, { name, botIds: ids });
      if (!res.ok) return setError(res.error);
      setError(undefined);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteGroup(chatId);
      if (!res.ok) return setError(res.error);
      router.push("/");
    });

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
        <TabsList className="relative h-9 w-full shrink-0 rounded-full bg-foreground/[0.06] p-1 ring-1 ring-foreground/10 backdrop-blur-xl contrast-more:bg-background contrast-more:ring-foreground/25">
          <TabsPrimitive.Indicator className="absolute top-1 bottom-1 left-0 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-foreground/15 shadow-sm ring-1 ring-foreground/15 transition-[translate,width] duration-200 ease-out motion-reduce:transition-none [[data-sliding]_&]:transition-none" />
          {["group", "computer"].map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="z-10 h-full rounded-full first:-mr-px last:-ml-px not-data-active:hover:bg-foreground/[0.05] data-active:border-transparent data-active:bg-transparent data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent"
            >
              {v === "group" ? "Gruppe" : "Computer"}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value="computer"
          className="flex min-h-0 flex-col gap-2 overflow-y-auto pt-1"
        >
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
            {members.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setShown(b.id)}
                className={cn(
                  "flex h-9 w-max shrink-0 items-center gap-2 rounded-full pr-4 pl-1 whitespace-nowrap text-sm font-medium ring-1 ring-foreground/10 backdrop-blur-xl transition-colors contrast-more:ring-foreground/25",
                  b.id === current?.id
                    ? "bg-foreground/15"
                    : "bg-foreground/[0.06] hover:bg-foreground/10"
                )}
              >
                <ChatAvatar
                  seed={b.avatar}
                  color={b.color}
                  className="size-7 shrink-0"
                />
                <span className="whitespace-nowrap">{b.name}</span>
              </button>
            ))}
          </div>
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
              <span className="absolute right-2 bottom-2 z-41 rounded-md bg-background/80 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <MaximizeIcon className="size-4" />
              </span>
            </button>
          ) : (
            <Skeleton className="aspect-video w-full rounded-lg" />
          )}
        </TabsContent>
        <TabsContent
          value="group"
          className="-mx-3 min-h-0 overflow-y-auto px-3 pt-1"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="group-panel-name">Name</FieldLabel>
              <Input
                id="group-panel-name"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Orbis</FieldLabel>
              <div className="flex flex-col gap-1">
                {allBots.map((b) => (
                  <div
                    key={b.id}
                    className="group/row flex items-center gap-1 rounded-lg p-1.5 hover:bg-muted"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={ids.includes(b.id)}
                        onCheckedChange={(on) =>
                          setIds((cur) =>
                            on ? [...cur, b.id] : cur.filter((i) => i !== b.id)
                          )
                        }
                      />
                      <ChatAvatar
                        seed={b.avatar}
                        color={b.color}
                        className="size-7 shrink-0"
                      />
                      <span className="truncate text-sm">{b.name}</span>
                    </label>
                    {b.chatId && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Chat mit ${b.name}`}
                        className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                        nativeButton={false}
                      render={<Link href={`/chats/${b.chatId}`} />}
                      >
                        <MessageCircleIcon />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${b.name} bearbeiten`}
                      className="opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                      onClick={() => setEditing(b)}
                    >
                      <PencilIcon />
                    </Button>
                  </div>
                ))}
              </div>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                disabled={pending || !dirty}
                onClick={save}
                className="col-span-2"
              >
                Speichern
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirm("clear")}
              >
                Verlauf leeren
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => setConfirm("delete")}
              >
                Gruppe löschen
              </Button>
            </div>
          </FieldGroup>
        </TabsContent>
      </Tabs>

      <Dialog
        open={fullscreen}
        onOpenChange={(open, { reason }) =>
          (open || reason === "close-press") && setFullscreen(open)
        }
        disablePointerDismissal
        modal={false}
      >
        <DialogContent className="flex h-[90svh] w-[95vw] flex-col p-3 pt-10 sm:max-w-none">
          <DialogTitle className="sr-only">
            Computer von {current?.name}
          </DialogTitle>
          <div ref={setDialogSlot} className="min-h-0 flex-1 rounded-lg" />
        </DialogContent>
      </Dialog>
      {desktop?.url && (
        <DesktopFrame
          key={currentId}
          url={desktop.url}
          target={fullscreen ? dialogSlot : showDesktop ? previewSlot : null}
          interactive={fullscreen}
        />
      )}

      <BotDialog
        bot={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete"
                ? `Gruppe ${initialName} löschen?`
                : "Verlauf leeren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? "Die Gruppe und ihr Verlauf werden gelöscht. Die Orbis bleiben erhalten."
                : "Alle Nachrichten dieser Gruppe werden gelöscht. Die Gruppe bleibt erhalten."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (confirm === "delete") remove();
                else
                  window.dispatchEvent(
                    new CustomEvent(CLEAR_EVENT, { detail: chatId })
                  );
                setConfirm(null);
              }}
            >
              {confirm === "delete" ? "Löschen" : "Verlauf leeren"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </ResizablePanel>
  );
}
