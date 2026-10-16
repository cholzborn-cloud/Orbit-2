"use client";

import { BanIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { createBot, deleteBot, updateBot } from "@/actions/bot";
import { ChatAvatar, ORBIS, ORBI_BASE_COLORS } from "@/components/chat-avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { botFormSchema, type BotFormValues } from "@/lib/db/bot-schema";
import { describeJob } from "@/lib/job-descriptions";
import { cn } from "@/lib/utils";

// Verhalten wird mit der Standardbeschreibung der Aufgabe vorbelegt.
const PRESETS = ["Begleiter", "Recherche", "Programmieren", "Code-Review", "Texte", "Lernen", "Übersetzen", "Ideen", "Planen"].map(
  (job) => ({ job, label: job, instructions: describeJob(job, false) }),
);
const CUSTOM = { job: "", label: "Eigener", instructions: "" };

const MAIN_JOB = "Hauptorbi";
// Ältere Hauptorbis tragen noch die frühere Aufgabe.
const isMainJob = (job: string) => job === MAIN_JOB || job === "Koordinator";

const COLORS = ["#ef4444", "#f97316", "#facc15", "#84cc16", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
const DOT_SELECTED = "ring-2 ring-white ring-offset-2 ring-offset-popover";

const orbiName = (orbi: string) => orbi[0].toUpperCase() + orbi.slice(1);

export type EditableBot = BotFormValues & { id: string };

export function BotDialog({
  trigger,
  bot,
  open: openProp,
  onOpenChange,
  onClearHistory,
}: {
  trigger?: React.ReactElement;
  bot?: EditableBot;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Nur im Chat gesetzt: leert den Verlauf, der Orbi bleibt.
  onClearHistory?: () => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bot ? "Orbi bearbeiten" : "Neuer Orbi"}</DialogTitle>
          <DialogDescription>Gib ihm ein Gesicht, einen Namen und eine Aufgabe.</DialogDescription>
        </DialogHeader>
        <BotForm
          bot={bot}
          onClearHistory={onClearHistory}
          onDone={() => setOpen(false)}
          Footer={DialogFooter}
          className="-mx-2 max-h-[60svh] overflow-y-auto px-2 py-1"
        />
      </DialogContent>
    </Dialog>
  );
}

// Formular ohne Dialog: im Dialog oben und im Seitenpanel des Chats.
export function BotForm({
  bot,
  onDone,
  onClearHistory,
  Footer,
  className,
}: {
  bot?: EditableBot;
  // Nach Speichern, Löschen, Abbrechen und Verlauf leeren.
  onDone: () => void;
  onClearHistory?: () => void;
  Footer: React.ComponentType<{ children: React.ReactNode }>;
  className?: string;
}) {
  const formId = useId();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: bot ?? { avatar: "erdi", color: null, isMain: false, name: orbiName("erdi"), ...PRESETS[0] },
  });
  const { errors } = form.formState;
  const job = form.watch("job");
  const avatar = form.watch("avatar");
  const color = form.watch("color");
  const isMain = !!form.watch("isMain");
  const isCustom = !isMain && !PRESETS.some((p) => p.job === job);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = bot ? await updateBot(bot.id, values) : await createBot(values);
      if (!res.ok) return form.setError("root", { message: res.error });
      onDone();
      form.reset(bot ? values : undefined);
      router.refresh();
    }),
  );

  const onDelete = () =>
    startTransition(async () => {
      if (!bot) return;
      const res = await deleteBot(bot.id);
      setConfirmingDelete(false);
      if (!res.ok) return form.setError("root", { message: res.error });
      onDone();
      router.push("/");
      router.refresh();
    });

  return (
    <>
        <form id={formId} onSubmit={onSubmit} className={className}>
          <FieldGroup>
            <Field>
              <FieldLabel>Planet</FieldLabel>
              <Controller
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <div className="grid grid-cols-5 gap-2">
                    {ORBIS.map((orbi) => (
                      <button
                        key={orbi}
                        type="button"
                        aria-pressed={field.value === orbi}
                        aria-label={orbi}
                        onClick={() => {
                          const name = form.getValues("name");
                          if (!name || name === orbiName(field.value)) {
                            form.setValue("name", orbiName(orbi), { shouldValidate: true });
                          }
                          field.onChange(orbi);
                        }}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-lg bg-muted/50 ring-1 ring-foreground/10 transition hover:bg-muted",
                          field.value === orbi && "bg-primary/20 ring-2 ring-primary",
                        )}
                      >
                        <ChatAvatar seed={orbi} color={field.value === orbi ? color : null} className="aspect-square w-[68%]" />
                      </button>
                    ))}
                  </div>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Farbe</FieldLabel>
              <div className="grid grid-cols-12 gap-2">
                <button
                  type="button"
                  aria-label="Originalfarbe"
                  aria-pressed={!color}
                  onClick={() => form.setValue("color", null)}
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-full border border-dashed border-foreground/40 text-muted-foreground",
                    !color && DOT_SELECTED,
                  )}
                >
                  <BanIcon className="size-1/2" />
                </button>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={color === c}
                    onClick={() => form.setValue("color", c)}
                    style={{ backgroundColor: c }}
                    className={cn("aspect-square w-full rounded-full", color === c && DOT_SELECTED)}
                  />
                ))}
                <label
                  aria-label="Eigene Farbe wählen"
                  className={cn(
                    "relative aspect-square w-full cursor-pointer rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]",
                    color && !COLORS.includes(color) && DOT_SELECTED,
                  )}
                >
                  <input
                    type="color"
                    value={color ?? ORBI_BASE_COLORS[avatar]}
                    onChange={(e) => form.setValue("color", e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </Field>

            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="bot-name">Name</FieldLabel>
              <Input id="bot-name" placeholder="Dein Orbi" aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="isMain"
                render={({ field }) => (
                  <Switch
                    id="bot-main"
                    checked={!!field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // Hauptorbi hat eine feste Aufgabe, keine frei wählbare Profession.
                      if (checked) {
                        form.setValue("job", MAIN_JOB, { shouldValidate: true });
                        form.setValue("instructions", describeJob(MAIN_JOB, true));
                      } else if (isMainJob(form.getValues("job"))) {
                        form.setValue("job", PRESETS[0].job);
                        form.setValue("instructions", PRESETS[0].instructions);
                      }
                    }}
                  />
                )}
              />
              <FieldLabel htmlFor="bot-main">Hauptorbi</FieldLabel>
            </Field>

            <Field data-invalid={!!errors.job}>
              <FieldLabel htmlFor="bot-job">Aufgabe</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {[...PRESETS, CUSTOM].map((p) => {
                  const selected = p === CUSTOM ? isCustom : job === p.job;
                  return (
                  <Button
                    key={p.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isMain}
                    aria-pressed={selected}
                    className={cn(
                      "rounded-full",
                      selected
                        ? "border-white bg-white text-black hover:bg-white hover:text-black active:bg-white dark:bg-white dark:hover:bg-white dark:active:bg-white"
                        : "dark:bg-transparent dark:hover:bg-white/10 active:bg-white/15",
                    )}
                    onClick={() => {
                      // Eigener Orbi: Aufgabe und Verhalten leer, Nutzer füllt beides selbst.
                      form.setValue("job", p.job, { shouldValidate: p !== CUSTOM });
                      form.setValue("instructions", p.instructions);
                      if (p === CUSTOM) form.setFocus("job");
                    }}
                  >
                    {p.label}
                  </Button>
                  );
                })}
              </div>
              <Input id="bot-job" placeholder="Begleiter" readOnly={isMain} aria-invalid={!!errors.job} {...form.register("job")} />
              <FieldError errors={[errors.job]} />
            </Field>

            <Field data-invalid={!!errors.instructions}>
              <FieldLabel htmlFor="bot-instructions">Verhalten</FieldLabel>
              <Textarea
                id="bot-instructions"
                rows={4}
                className="resize-none"
                placeholder={describeJob(job ?? "", isMain)}
                {...form.register("instructions")}
              />
              <FieldError errors={[errors.instructions]} />
            </Field>
            <FieldError>{errors.root?.message}</FieldError>
          </FieldGroup>
        </form>
        <Footer>
          {bot && (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              className="sm:mr-auto"
              onClick={() => setConfirmingDelete(true)}
            >
              Löschen
            </Button>
          )}
          {onClearHistory && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmingClear(true)}>
              Verlauf leeren
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              onDone();
            }}
          >
            Abbrechen
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {bot ? "Speichern" : "Orbi erstellen"}
          </Button>
        </Footer>
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bot?.name} wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Orbi und sein Chat werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
              Endgültig löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmingClear} onOpenChange={setConfirmingClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlauf mit {bot?.name} leeren?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Nachrichten dieses Chats werden gelöscht. Der Orbi bleibt erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onClearHistory?.();
                setConfirmingClear(false);
                onDone();
              }}
            >
              Verlauf leeren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
