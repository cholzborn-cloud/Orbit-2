"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { groupFormSchema } from "@/lib/db/chat-schema";
import { bots, chatMembers, chats } from "@/lib/db/schema";

export async function createGroup(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Bitte melde dich an." };

  const form = groupFormSchema.safeParse(input);
  if (!form.success) return { ok: false, error: form.error.issues[0].message };

  // Nur eigene Bots zulassen.
  const own = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, form.data.botIds)));
  if (own.length !== form.data.botIds.length) return { ok: false, error: "Unbekannter Orbi." };

  const id = nanoid();
  await db.batch([
    db.insert(chats).values({ id, userId, kind: "group", name: form.data.name }),
    db.insert(chatMembers).values(own.map((b) => ({ chatId: id, botId: b.id }))),
  ]);
  revalidatePath("/");
  return { ok: true, id };
}

// Nur die Vorschau (letzte Nachricht) für die Seitenleiste, nicht den Verlauf.
export async function updateChatPreview(chatId: string, text: string) {
  const { userId } = await auth();
  if (!userId) return;

  const preview = text.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!preview) return;

  await db
    .update(chats)
    .set({ lastMessagePreview: preview, lastMessageAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  revalidatePath("/", "layout");
}
