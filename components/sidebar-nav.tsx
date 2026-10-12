"use client";

import { PencilIcon, PlusIcon, SearchIcon, StarIcon, UsersIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

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
  useSidebar,
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

export type SidebarGroupChat = {
  id: string;
  name: string;
  members: { avatar: SidebarBot["avatar"]; color: string | null }[];
};

// Position und Größe (in % der Fläche) der Mitglieder-Avatare, je nach Anzahl.
const CLUSTER: Record<1 | 2 | 3 | 4 | 5, { size: number; at: [number, number][] }> = {
  1: { size: 100, at: [[0, 0]] },
  2: { size: 72, at: [[0, 0], [28, 28]] },
  3: { size: 62, at: [[19, 0], [0, 38], [38, 38]] },
  4: { size: 58, at: [[0, 0], [42, 0], [0, 42], [42, 42]] },
  5: { size: 42, at: [[8, 0], [50, 0], [0, 54], [29, 54], [58, 54]] },
};

function GroupAvatar({ members, className }: { members: SidebarGroupChat["members"]; className?: string }) {
  // Ab 6 Mitgliedern: 4 Avatare und ein "+N".
  const extra = members.length > 5 ? members.length - 4 : 0;
  const shown = members.slice(0, extra ? 4 : 5);
  const layout = CLUSTER[Math.max(1, extra ? 5 : shown.length) as 1 | 2 | 3 | 4 | 5];
  const box = (i: number) => ({
    width: `${layout.size}%`,
    height: `${layout.size}%`,
    left: `${layout.at[i][0]}%`,
    top: `${layout.at[i][1]}%`,
  });
  return (
    <span className={cn("relative block shrink-0", className)}>
      {shown.map((m, i) => (
        <ChatAvatar key={i} seed={m.avatar} color={m.color} className="absolute" style={box(i)} />
      ))}
      {extra > 0 && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-muted text-[0.5rem] font-semibold leading-none text-muted-foreground"
          style={box(4)}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

const EASE = "duration-300 ease-[cubic-bezier(.32,.72,0,1)]";
const ROW =
  "h-14 gap-3 rounded-xl group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-full";
// Text blendet aus und klappt zu, damit der Avatar mit der Leiste zur Mitte gleitet.
const LABEL = `flex min-w-0 max-w-40 flex-col leading-tight transition-[max-width,opacity] ${EASE} group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0`;

export function SidebarNav({ bots, groups }: { bots: SidebarBot[]; groups: SidebarGroupChat[] }) {
  const [query, setQuery] = useState("");
  const [creatingBot, setCreatingBot] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editing, setEditing] = useState<SidebarBot | null>(null);
  const { setOpen } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);
  const openSearch = () => {
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 320);
  };

  const q = query.trim().toLowerCase();
  const match = (s: string) => s.toLowerCase().includes(q);
  const shownBots = bots.filter((b) => !b.isMain && (match(b.name) || match(b.job)));
  const shownGroups = groups.filter((g) => match(g.name));
  const main = bots.find((b) => b.isMain);

  return (
    <>
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <span className="text-lg font-semibold animate-in fade-in-0 duration-300 group-data-[collapsible=icon]:hidden">Orbit</span>
          <SidebarTrigger className="rounded-full group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:bg-muted" />
        </div>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarInput
            ref={searchRef}
            placeholder="Orbis finden"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-full animate-in fade-in-0 slide-in-from-left-2 duration-300 group-data-[collapsible=icon]:hidden"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-full group-data-[collapsible=icon]:size-10"
                  aria-label="Neu erstellen"
                >
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
          <Button
            size="icon"
            variant="outline"
            aria-label="Orbis finden"
            onClick={openSearch}
            className="hidden rounded-full animate-in fade-in-0 zoom-in-90 duration-300 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10"
          >
            <SearchIcon />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {main && (!q || match(main.name)) && (
          <div className="group/main relative mx-3 flex flex-col items-center overflow-hidden rounded-2xl bg-sidebar-accent/40 p-4 transition-[padding,background-color] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0.5">
            <div className="relative size-20 transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:size-11">
              <ChatAvatar seed={main.avatar} color={main.color} className="size-full" />
              <span className="absolute right-[5%] bottom-[5%] flex size-6 items-center justify-center rounded-full bg-black transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:size-4">
                <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400 group-data-[collapsible=icon]:size-2.5" />
              </span>
            </div>
            <div className="mt-2 flex max-h-12 flex-col items-center gap-0.5 transition-[max-height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:opacity-0">
              <span className="font-semibold leading-tight">{main.name}</span>
              <span className="text-xs leading-tight text-muted-foreground">Hauptbot</span>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Hauptbot bearbeiten"
              className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/main:opacity-100 focus-visible:opacity-100 group-data-[collapsible=icon]:hidden"
              onClick={() => setEditing(main)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}

        <SidebarGroup className="px-3 py-1">
          <SidebarGroupLabel className="px-2 transition-[height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:overflow-hidden">Chats</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {shownBots.map((b) => (
              <SidebarMenuItem key={b.id}>
                <SidebarMenuButton size="lg" className={ROW} tooltip={b.name}>
                  <ChatAvatar seed={b.avatar} color={b.color} className="size-10 transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)]" />
                  <div className={LABEL}>
                    <span className="truncate font-medium">{b.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{b.job}</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuAction
                  showOnHover
                  className="top-1/2! -translate-y-1/2 group-data-[collapsible=icon]:hidden"
                  onClick={() => setEditing(b)}
                  aria-label="Bearbeiten"
                >
                  <PencilIcon />
                </SidebarMenuAction>
              </SidebarMenuItem>
            ))}
            {shownBots.length === 0 && (q || !main) && (
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Keine Orbis gefunden.</p>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {shownGroups.length > 0 && (
          <SidebarGroup className="px-3 py-1">
            <SidebarGroupLabel className="px-2 transition-[height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:overflow-hidden">Gruppen</SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {shownGroups.map((g) => (
                <SidebarMenuItem key={g.id}>
                  <SidebarMenuButton size="lg" className={ROW} tooltip={g.name}>
                    <GroupAvatar members={g.members} className="size-10 transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)]" />
                    <div className={LABEL}>
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.members.length} Orbis</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
