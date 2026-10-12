"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { createBot } from "@/actions/bot";
import { ChatAvatar, ORBIS } from "@/components/chat-avatar";
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
  {
    job: "Recherche-Assistent",
    instructions: "Antworte kurz, nenne Quellen und frage nach, bevor du etwas Destruktives tust.",
  },
  { job: "Code-Reviewer", instructions: "Prüfe Code auf Fehler, Lesbarkeit und Sicherheit. Sei konkret." },
  { job: "Schreib-Lektor", instructions: "Verbessere Texte, ohne den Stil des Autors zu ändern." },
  { job: "Tutor", instructions: "Erkläre Schritt für Schritt und prüfe das Verständnis mit kurzen Fragen." },
];

export function BotDialog({ trigger }: { trigger: React.ReactElement }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { avatar: "erdi", name: "", ...PRESETS[0] },
  });
  const { errors } = form.formState;

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
                        onClick={() => field.onChange(orbi)}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-lg bg-muted/50 ring-1 ring-foreground/10 transition hover:bg-muted",
                          field.value === orbi && "bg-primary/10 ring-2 ring-primary",
                        )}
                      >
                        <ChatAvatar seed={orbi} className="size-9" />
                      </button>
                    ))}
                  </div>
                )}
              />
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
                    className="rounded-full"
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
