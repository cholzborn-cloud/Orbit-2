import { auth } from "@clerk/nextjs/server";

import { UserMenuButton } from "@/components/user-menu-button";
import { SidebarNav, type SidebarBot } from "@/components/sidebar-nav";
import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getUserChats } from "@/query/bot";

export async function AppSidebar() {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await getUserChats(userId);

  const bots: SidebarBot[] = rows
    .filter((c) => c.kind === "direct" && c.members[0])
    .map(({ members: [{ bot: b }] }) => ({
      id: b.id,
      name: b.name,
      avatar: b.avatar as SidebarBot["avatar"],
      color: b.color,
      job: b.job,
      instructions: b.instructions,
      isMain: b.isMain,
    }));
  const groups = rows
    .filter((c) => c.kind === "group")
    .map((c) => ({
      id: c.id,
      name: c.name ?? "Gruppe",
      members: c.members.map((m) => ({
        avatar: m.bot.avatar as SidebarBot["avatar"],
        color: m.bot.color,
      })),
    }));

  return (
    <Sidebar collapsible="icon">
      <SidebarNav bots={bots} groups={groups} />
      <SidebarFooter className="shrink-0 px-3 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenuButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
