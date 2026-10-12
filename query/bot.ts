import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

// Alle Chats des Clerk-Nutzers, neueste zuerst, jeweils mit Mitglieder-Bots.
// Der Bot eines Direktchats ist das erste Mitglied.
export const getUserChats = (userId: string) =>
  db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: { members: { with: { bot: true } } },
  });
