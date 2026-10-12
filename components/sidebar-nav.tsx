"use client";

import { PencilIcon, PlusIcon, StarIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { BotDialog } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { GroupDialog } from "@/components/group-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export type SidebarBot = {
  id: string;
  name: string;
  avatar: (typeof import("@/components/chat-avatar").ORBIS)[number];
  color: string | null;
  job: string;
  instructions: string | null;
  isMain: boolean;
};

export type SidebarGroupChat = { id: string; name: string; members: number };

export function SidebarNav({ bots, groups }: { bots: SidebarBot[]; groups: SidebarGroupChat[] }) {
  const [query, setQuery] = useState("");
  const [creatingBot, setCreatingBot] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editing, setEditing] = useState<SidebarBot | null>(null);

  const q = query.trim().toLowerCase();
  const match = (s: string) => s.toLowerCase().includes(q);
  const shownBots = bots.filter((b) => !b.isMain && (match(b.name) || match(b.job)));
  const shownGroups = groups.filter((g) => match(g.name));
  const main = bots.find((b) => b.isMain);

  return (
    <>
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Orbit</span>
          <SidebarTrigger />
        </div>
        <div className="flex items-center gap-2">
          <SidebarInput
            placeholder="Orbis finden"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-full"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="icon" variant="outline" className="rounded-full" aria-label="Neu erstellen">
                  <PlusIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreatingBot(true)}>
                <PlusIcon /> Neuer Orbi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreatingGroup(true)}>
                <UsersIcon /> Neue Gruppe
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {main && (!q || match(main.name)) && (
          <div className="group/main relative mx-3 flex flex-col items-center gap-1 rounded-2xl bg-sidebar-accent/40 p-5">
            <div className="relative">
              <ChatAvatar seed={main.avatar} color={main.color} animated className="size-20" />
              <span className="absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-full bg-black">
                <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
              </span>
            </div>
            <span className="font-semibold">{main.name}</span>
            <span className="text-xs text-muted-foreground">Hauptbot</span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Hauptbot bearbeiten"
              className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/main:opacity-100 focus-visible:opacity-100"
              onClick={() => setEditing(main)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Orbis</SidebarGroupLabel>
          <SidebarMenu>
            {shownBots.map((b) => (
              <SidebarMenuItem key={b.id}>
                <SidebarMenuButton size="lg" className="h-12">
                  <ChatAvatar seed={b.avatar} color={b.color} className="size-8" />
                  <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate font-medium">
                      {b.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{b.job}</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover className="top-3.5" onClick={() => setEditing(b)} aria-label="Bearbeiten">
                  <PencilIcon />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
            {shownBots.length === 0 && (q || !main) && <p className="px-2 text-xs text-muted-foreground">Keine Orbis gefunden.</p>}
          </SidebarMenu>
        </SidebarGroup>

        {(shownGroups.length > 0 || !q) && (
          <SidebarGroup>
            <SidebarGroupLabel>Gruppen</SidebarGroupLabel>
            <SidebarMenu>
              {shownGroups.map((g) => (
                <SidebarMenuItem key={g.id}>
                  <SidebarMenuButton size="lg" className="h-12">
                    <UsersIcon className="size-8 p-1.5" />
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.members} Orbis</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {groups.length === 0 && <p className="px-2 text-xs text-muted-foreground">Noch keine Gruppen.</p>}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <BotDialog open={creatingBot} onOpenChange={setCreatingBot} />
      {editing && (
        <BotDialog
          key={editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          bot={{ ...editing, instructions: editing.instructions ?? "" }}
        />
      )}
      <GroupDialog bots={bots} open={creatingGroup} onOpenChange={setCreatingGroup} />
    </>
  );
}
