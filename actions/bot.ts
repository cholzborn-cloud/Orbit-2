"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { insertBotSchema, botFormSchema } from "@/lib/db/bot-schema";
import { bots, chatMembers, chats } from "@/lib/db/schema";

export type CreateBotResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Setzt isMain zuerst für alle Bots des Nutzers zurück; der Unique-Index erlaubt nur einen.
const clearMain = (userId: string) =>
  db.update(bots).set({ isMain: false }).where(and(eq(bots.userId, userId), eq(bots.isMain, true)));

export async function createBot(input: unknown): Promise<CreateBotResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Bitte melde dich an." };

  const form = botFormSchema.safeParse(input);
  if (!form.success) return { ok: false, error: form.error.issues[0].message };

  const id = nanoid();
  const row = insertBotSchema.safeParse({
    ...form.data,
    id,
    userId,
    thirdPartyId: id, // TODO: durch echte ID des externen Dienstes ersetzen
    instructions: form.data.instructions || null,
  });
  if (!row.success) return { ok: false, error: row.error.issues[0].message };

  const chatId = nanoid();
  const stmts: BatchItem<"pg">[] = [];
  if (row.data.isMain) stmts.push(clearMain(userId));
  stmts.push(
    db.insert(bots).values(row.data),
    db.insert(chats).values({ id: chatId, userId, kind: "direct" }),
    db.insert(chatMembers).values({ chatId, botId: id }),
  );
  await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  revalidatePath("/");
  return { ok: true, id };
}

export async function updateBot(id: string, input: unknown): Promise<CreateBotResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Bitte melde dich an." };

  const form = botFormSchema.safeParse(input);
  if (!form.success) return { ok: false, error: form.error.issues[0].message };

  const values = { ...form.data, instructions: form.data.instructions || null };
  const stmts: BatchItem<"pg">[] = [];
  if (values.isMain) stmts.push(clearMain(userId));
  stmts.push(db.update(bots).set(values).where(and(eq(bots.id, id), eq(bots.userId, userId))));
  await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  revalidatePath("/");
  return { ok: true, id };
}
