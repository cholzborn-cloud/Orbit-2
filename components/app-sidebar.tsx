import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

import { SidebarNav, type SidebarBot } from "@/components/sidebar-nav";
import { Sidebar, SidebarFooter } from "@/components/ui/sidebar";
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
    .map((c) => ({ id: c.id, name: c.name ?? "Gruppe", members: c.members.length }));

  return (
    <Sidebar>
      <SidebarNav bots={bots} groups={groups} />
      <SidebarFooter className="p-3">
        <UserButton showName appearance={{ elements: { userButtonBox: "flex-row-reverse" } }} />
      </SidebarFooter>
    </Sidebar>
  );
}
