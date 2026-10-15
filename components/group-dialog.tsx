"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createGroup } from "@/actions/chat";
import { ChatAvatar } from "@/components/chat-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SidebarBot } from "@/components/sidebar-nav";

export function GroupDialog({
  bots,
  open,
  onOpenChange,
}: {
  bots: SidebarBot[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await createGroup({ name, botIds: ids });
      if (!res.ok) return setError(res.error);
      onOpenChange(false);
      setName("");
      setIds([]);
      setError(undefined);
      router.push(`/chats/${res.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neue Gruppe</DialogTitle>
          <DialogDescription>Gib der Gruppe einen Namen und wähle ihre Orbis.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="group-name">Name</FieldLabel>
            <Input id="group-name" placeholder="Meine Gruppe" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Orbis</FieldLabel>
            {bots.length === 0 && <p className="text-xs text-muted-foreground">Erstelle zuerst einen Orbi.</p>}
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {bots.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-muted">
                  <Checkbox
                    checked={ids.includes(b.id)}
                    onCheckedChange={(on) => setIds((cur) => (on ? [...cur, b.id] : cur.filter((i) => i !== b.id)))}
                  />
                  <ChatAvatar seed={b.avatar} color={b.color} className="size-7" />
                  <span className="text-sm">{b.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <FieldError>{error}</FieldError>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            Gruppe erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
