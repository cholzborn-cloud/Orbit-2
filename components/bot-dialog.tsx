"use client";

import { BanIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { createBot } from "@/actions/bot";
import { ChatAvatar, ORBIS, ORBI_BASE_COLORS } from "@/components/chat-avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { botFormSchema, type BotFormValues } from "@/lib/db/bot-schema";
import { cn } from "@/lib/utils";

const PRESETS = [
  { job: "Begleiter", instructions: "Antworte freundlich und kurz." },
  { job: "Recherche", instructions: "Antworte kurz, nenne Quellen und frage nach, bevor du etwas Destruktives tust." },
  { job: "Programmieren", instructions: "Schreibe sauberen, einfachen Code. Erkläre kurz, was du änderst." },
  { job: "Code-Review", instructions: "Prüfe Code auf Fehler, Lesbarkeit und Sicherheit. Sei konkret." },
  { job: "Texte", instructions: "Verbessere Texte, ohne den Stil des Autors zu ändern." },
  { job: "Lernen", instructions: "Erkläre Schritt für Schritt und prüfe das Verständnis mit kurzen Fragen." },
  { job: "Übersetzen", instructions: "Übersetze natürlich und treffend. Frage bei Mehrdeutigkeit nach." },
  { job: "Ideen", instructions: "Liefere viele kreative Ideen, kurz und konkret. Dann die beste empfehlen." },
  { job: "Planen", instructions: "Teile Aufgaben in kleine Schritte und setze klare Prioritäten." },
];

const COLORS = ["#ef4444", "#f97316", "#facc15", "#84cc16", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
const DOT_SELECTED = "ring-2 ring-white ring-offset-2 ring-offset-popover";

const orbiName = (orbi: string) => orbi[0].toUpperCase() + orbi.slice(1);

export function BotDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { avatar: "erdi", color: null, name: orbiName("erdi"), ...PRESETS[0] },
  });
  const { errors } = form.formState;
  const job = form.watch("job");
  const avatar = form.watch("avatar");
  const color = form.watch("color");

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await createBot(values);
      if (!res.ok) return form.setError("root", { message: res.error });
      setOpen(false);
      form.reset();
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Orbi</DialogTitle>
          <DialogDescription>Gib ihm ein Gesicht, einen Namen und eine Aufgabe.</DialogDescription>
        </DialogHeader>
        <form id="bot-form" onSubmit={onSubmit} className="-mx-2 max-h-[60svh] overflow-y-auto px-2 py-1">
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
                        <ChatAvatar seed={orbi} color={field.value === orbi ? color : null} className="size-9" />
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

            <Field data-invalid={!!errors.job}>
              <FieldLabel htmlFor="bot-job">Aufgabe</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Button
                    key={p.job}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={job === p.job}
                    className={cn(
                      "rounded-full",
                      job === p.job
                        ? "border-white bg-white text-black hover:bg-white hover:text-black active:bg-white dark:bg-white dark:hover:bg-white dark:active:bg-white"
                        : "dark:bg-transparent dark:hover:bg-white/10 active:bg-white/15",
                    )}
                    onClick={() => {
                      form.setValue("job", p.job, { shouldValidate: true });
                      form.setValue("instructions", p.instructions);
                    }}
                  >
                    {p.job}
                  </Button>
                ))}
              </div>
              <Input id="bot-job" placeholder="Begleiter" aria-invalid={!!errors.job} {...form.register("job")} />
              <FieldError errors={[errors.job]} />
            </Field>

            <Field data-invalid={!!errors.instructions}>
              <FieldLabel htmlFor="bot-instructions">Verhalten</FieldLabel>
              <Textarea
                id="bot-instructions"
                rows={4}
                className="resize-none"
                placeholder="Antworte kurz, nenne Quellen und frage nach, bevor du etwas Destruktives tust."
                {...form.register("instructions")}
              />
              <FieldError errors={[errors.instructions]} />
            </Field>
            <FieldError>{errors.root?.message}</FieldError>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="submit" form="bot-form" disabled={pending}>
            Orbi erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
