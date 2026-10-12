import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { SidebarNav, type SidebarBot } from "@/components/sidebar-nav";
import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

export async function AppSidebar() {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: { members: { with: { bot: true } } },
  });

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
            {/* div statt button: UserButton rendert selbst einen Button. */}
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="h-14 rounded-xl group-data-[collapsible=icon]:size-12! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    userButtonBox: "flex-row-reverse gap-3",
                    userButtonOuterIdentifier:
                      "text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
