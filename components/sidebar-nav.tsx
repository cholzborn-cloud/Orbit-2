"use client";

import { PencilIcon, PlusIcon, SearchIcon, StarIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { useRef, useState } from "react";

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

export type SidebarGroupChat = { id: string; name: string; members: number };

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
          <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Orbit</span>
          <SidebarTrigger className="rounded-full group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:bg-muted" />
        </div>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarInput
            ref={searchRef}
            placeholder="Orbis finden"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 rounded-full group-data-[collapsible=icon]:hidden"
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
            className="hidden rounded-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10"
          >
            <SearchIcon />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {main && (!q || match(main.name)) && (
          <div className="group/main relative mx-3 flex flex-col items-center gap-1 overflow-hidden rounded-2xl bg-sidebar-accent/40 p-5 transition-[padding,background-color] duration-300 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-1">
            <div className="relative size-20 transition-[width,height] duration-300 group-data-[collapsible=icon]:size-11">
              <ChatAvatar seed={main.avatar} color={main.color} animated className="size-full" />
              <span className="absolute right-[10%] bottom-[10%] flex size-6 items-center justify-center rounded-full bg-black transition-[width,height] duration-300 group-data-[collapsible=icon]:size-4">
                <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400 group-data-[collapsible=icon]:size-2.5" />
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 transition-opacity duration-200 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:opacity-0">
              <span className="font-semibold">{main.name}</span>
              <span className="text-xs text-muted-foreground">Hauptbot</span>
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

        <SidebarGroup>
          <SidebarGroupLabel>Orbis</SidebarGroupLabel>
          <SidebarMenu>
            {shownBots.map((b) => (
              <SidebarMenuItem key={b.id}>
                <SidebarMenuButton size="lg" className="h-12 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full" tooltip={b.name}>
                  <ChatAvatar seed={b.avatar} color={b.color} className="size-8 group-data-[collapsible=icon]:size-9" />
                  <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">
                      {b.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{b.job}</span>
                  </div>
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover className="top-3.5 group-data-[collapsible=icon]:hidden" onClick={() => setEditing(b)} aria-label="Bearbeiten">
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
                  <SidebarMenuButton size="lg" className="h-12 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full" tooltip={g.name}>
                    <UsersIcon className="size-6!" />
                    <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.members} Orbis</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="h-12 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
                  tooltip="Gruppe erstellen"
                  onClick={() => setCreatingGroup(true)}
                >
                  <UserPlusIcon className="size-6!" />
                  <span className="group-data-[collapsible=icon]:hidden">Gruppe erstellen</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
