"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/chat-avatar";
import type { SidebarBot } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";

// Gruppenchats werden vorerst ignoriert: je Chat zählt der Avatar des ersten Bots.
export function SidebarSearch({
  chats,
  query,
  onQueryChange,
}: {
  chats: SidebarBot[];
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const router = useRouter();
  const { setOpen: setSidebarOpen } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyK" || !(e.metaKey || e.ctrlKey) || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen((o) => !o);
    };
    // Capture-Phase: kommt vor Handlern, die das Ereignis sonst abfangen (Eingabefelder, Dialoge).
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <>
      {/* Eingabefeld filtert die Liste direkt; Cmd/Ctrl+K öffnet zusätzlich die Palette. */}
      <div className="relative min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Suche"
          className="h-9 rounded-full pr-11 pl-9 transition-colors hover:bg-muted dark:hover:bg-input/50"
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">⌘K</Kbd>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Suche"
        onClick={() => {
          // Eingeklappt: Leiste öffnen und ins Feld springen.
          setSidebarOpen(true);
          setTimeout(() => inputRef.current?.focus(), 320);
        }}
        className="hidden rounded-full transition-colors hover:bg-sidebar-accent dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10"
      >
        <SearchIcon />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Suche" description="Chats durchsuchen">
        {/* cmdk braucht den Command-Kontext, CommandDialog liefert ihn hier nicht. */}
        <Command>
        <CommandInput placeholder="Suche…" />
        <CommandList>
          <CommandEmpty>Keine Chats gefunden.</CommandEmpty>
          <CommandGroup heading="Chats">
            {chats.map((c) => (
              <CommandItem
                key={c.chatId}
                value={`${c.name} ${c.lastMessagePreview ?? ""} ${c.chatId}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(`/chats/${c.chatId}`);
                }}
              >
                <ChatAvatar seed={c.avatar} color={c.color} className="size-6" />
                <span className="shrink-0 font-medium">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.lastMessagePreview ?? "Noch keine Nachrichten"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
