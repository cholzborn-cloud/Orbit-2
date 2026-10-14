"use server";

import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
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

// Nur die Zeit der letzten Nachricht für die Seitenleiste.
export async function touchChat(chatId: string) {
  const { userId } = await auth();
  if (!userId) return;

  await db
    .update(chats)
    .set({ lastMessageAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  revalidatePath("/", "layout");
}

// Chat-Agent (Trigger.dev): jeder Zugriff nur auf eigene Chats.
async function ownChat(chatId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Nicht angemeldet");
  const [row] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  if (!row) throw new Error("Unbekannter Chat");
}

const startSession = chat.createStartSessionAction("orbit-chat");
export async function startChatSession(params: Parameters<typeof startSession>[0]) {
  await ownChat(params.chatId);
  return startSession(params);
}

export async function mintChatAccessToken(chatId: string) {
  await ownChat(chatId);
  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  });
}

const loadTranscriptAction = chat.createLoadTranscriptAction(defaultStorage);
export async function loadTranscript(params: Parameters<typeof loadTranscriptAction>[0]) {
  await ownChat(params.chatId);
  return loadTranscriptAction(params);
}
