import { desc, eq } from "drizzle-orm";

import type { SidebarBot } from "@/components/sidebar-nav";
import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

// Direktchats des Clerk-Nutzers, neueste zuerst. Gruppenchats werden vorerst ignoriert.
// Der Bot eines Direktchats ist das erste Mitglied. Der Hauptbot wird hier abgetrennt.
export async function getSidebarBots(userId: string) {
  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: { members: { with: { bot: true } } },
  });

  const all: SidebarBot[] = rows
    .filter((c) => c.kind === "direct" && c.members[0])
    .map(({ id: chatId, members: [{ bot: b }], lastMessageAt }) => ({
      chatId,
      id: b.id,
      name: b.name,
      avatar: b.avatar as SidebarBot["avatar"],
      color: b.color,
      job: b.job,
      instructions: b.instructions,
      isMain: b.isMain,
      lastMessageAt: lastMessageAt.toISOString(),
    }));

  return {
    main: all.find((b) => b.isMain) ?? null,
    bots: all.filter((b) => !b.isMain),
  };
}
