"use server";

import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { insertBotSchema, botFormSchema } from "@/lib/db/bot-schema";
import { bots } from "@/lib/db/schema";

export type CreateBotResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

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

  await db.insert(bots).values(row.data);
  revalidatePath("/");
  return { ok: true, id };
}
