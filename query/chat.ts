import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chats } from "@/lib/db/schema";

// Ein Chat des Clerk-Nutzers samt Mitgliedern und ihren Bots. Fremde Chat-IDs liefern undefined.
export const getChat = (userId: string, chatId: string) =>
  db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: { members: { with: { bot: true } } },
  });
