"use client";

import { ArrowUpIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Einfache Eingabeleiste, sendet vorerst nichts.
export function ChatComposer() {
  const [value, setValue] = useState("");
  return (
    <div className="sticky bottom-0 bg-background px-4 pt-2 pb-4">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto flex w-full max-w-3xl flex-col gap-1 rounded-2xl border border-input bg-input/30 p-2"
      >
        <Textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Was möchtest du wissen?"
          className="min-h-9 resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between">
          <Button type="button" size="icon-sm" variant="ghost" className="rounded-full" aria-label="Hinzufügen">
            <PlusIcon />
          </Button>
          <Button
            type="submit"
            size="icon-sm"
            disabled={!value.trim()}
            className="rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label="Senden"
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </form>
    </div>
  );
}
