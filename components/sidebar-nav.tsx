"use client";

import { PlusIcon, StarIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";

import { cn } from "@/lib/utils";

import { BotDialog } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { SidebarSearch } from "@/components/sidebar-search";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Unter einer Minute "gerade eben", sonst relative Zeit; tickt alle 15 s.
function Ago({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const ms = now - new Date(at).getTime();
  if (ms < 60_000) return <>gerade eben</>;
  return <>{formatDistanceToNowStrict(new Date(at), { locale: de })}</>;
}

export type SidebarBot = {
  chatId: string;
  id: string;
  name: string;
  avatar: (typeof import("@/components/chat-avatar").ORBIS)[number];
  color: string | null;
  job: string;
  instructions: string | null;
  isMain: boolean;
  lastMessageAt: string;
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
  "h-14 data-active:font-normal hover:bg-sidebar-accent/60 data-active:hover:bg-sidebar-accent/70 gap-3 rounded-xl group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-full";
// Text blendet aus und klappt zu, damit der Avatar mit der Leiste zur Mitte gleitet.
const LABEL = `flex min-w-0 max-w-full flex-1 flex-col leading-tight transition-[max-width,opacity] ${EASE} group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0`;

export function SidebarNav({
  main,
  bots,
  groups = [],
}: {
  main: SidebarBot | null;
  bots: SidebarBot[];
  groups?: SidebarGroupChat[];
}) {
  const [creatingBot, setCreatingBot] = useState(false);
  // Aktiver Chat aus der Route /chats/:chatId.
  const { chatId: activeChatId } = useParams<{ chatId?: string }>();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (s: string) => s.toLowerCase().includes(q);
  const shownBots = bots.filter((b) => match(b.name) || match(b.job));
  const shownGroups = groups.filter((g) => match(g.name));

  return (
    <>
      <SidebarHeader className="gap-3 p-3 group-data-[collapsible=icon]:items-center">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <span className="text-lg font-semibold animate-in fade-in-0 duration-300 group-data-[collapsible=icon]:hidden">Orbit</span>
          <SidebarTrigger className="rounded-full transition-colors hover:bg-sidebar-accent dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:size-10" />
        </div>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarSearch chats={main ? [main, ...bots] : bots} query={query} onQueryChange={setQuery} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full transition-colors hover:bg-sidebar-accent dark:hover:bg-sidebar-accent group-data-[collapsible=icon]:size-10"
                  aria-label="Neu erstellen"
                >
                  <PlusIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-max">
              <DropdownMenuItem onClick={() => setCreatingBot(true)}>
                <PlusIcon /> Neuen Orbi erstellen
              </DropdownMenuItem>
              {/* Öffnet bewusst nichts. */}
              <DropdownMenuItem>
                <UsersIcon /> Gruppe erstellen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {main && (!q || match(main.name)) && (
          <div className={cn("relative mx-3 flex flex-col items-center overflow-hidden rounded-2xl bg-sidebar-accent/40 p-4 hover:bg-sidebar-accent/70 transition-[padding,background-color] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:hover:bg-transparent group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0", main.chatId === activeChatId && "bg-sidebar-accent group-data-[collapsible=icon]:bg-sidebar-accent group-data-[collapsible=icon]:hover:bg-sidebar-accent")}>
            <div className="relative size-16 transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:size-7">
              <ChatAvatar seed={main.avatar} color={main.color} className="size-full" />
              <span className="absolute right-[4.5%] bottom-[7%] flex size-5 items-center justify-center rounded-full bg-black transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:-right-0.5 group-data-[collapsible=icon]:-bottom-0.5 group-data-[collapsible=icon]:size-3">
                <StarIcon className="size-3 fill-yellow-400 text-yellow-400 group-data-[collapsible=icon]:size-2" />
              </span>
            </div>
            <div className="mt-2 flex max-h-24 w-full flex-col items-center gap-0.5 transition-[max-height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:opacity-0">
              <span className="font-semibold leading-tight">{main.name}</span>
              <div className="mt-1 flex w-full min-w-0 flex-col items-center gap-0.5 text-xs text-muted-foreground">
                <span><Ago at={main.lastMessageAt} /></span>
              </div>
            </div>
            <Link href={`/chats/${main.chatId}`} aria-label={main.name} className="absolute inset-0 rounded-2xl group-data-[collapsible=icon]:rounded-full" />
          </div>
        )}

        {main && (shownBots.length > 0 || shownGroups.length > 0) && (
          <SidebarSeparator className="mx-auto mt-2 mb-1 hidden bg-foreground/20 data-horizontal:w-6 group-data-[collapsible=icon]:block" />
        )}

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="px-2 transition-[height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:overflow-hidden">Chats</SidebarGroupLabel>
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {shownBots.map((b) => (
              <SidebarMenuItem key={b.id}>
                <SidebarMenuButton render={<Link href={`/chats/${b.chatId}`} />} size="lg" className={ROW} tooltip={b.name} isActive={b.chatId === activeChatId}>
                  <ChatAvatar seed={b.avatar} color={b.color} className="size-7 transition-[width,height] duration-300 ease-[cubic-bezier(.32,.72,0,1)]" />
                  <div className={cn(LABEL, "flex-row items-start gap-2")}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{b.name}</span>
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs text-muted-foreground"><Ago at={b.lastMessageAt} /></span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {shownBots.length === 0 && (q || !main) && (
              <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Keine Orbis gefunden.</p>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {shownGroups.length > 0 && (
          <>
          <SidebarSeparator className="mx-auto my-1 hidden bg-foreground/20 data-horizontal:w-6 group-data-[collapsible=icon]:block" />
          <SidebarGroup className="px-3 py-1">
            <SidebarGroupLabel className="px-2 transition-[height,margin,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:overflow-hidden">Gruppen</SidebarGroupLabel>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
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
          </>
        )}
      </SidebarContent>

      <BotDialog open={creatingBot} onOpenChange={setCreatingBot} />
    </>
  );
}
