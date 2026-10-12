"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { todos } from "@/lib/db/schema";

async function currentUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

export async function addTodo(formData: FormData) {
  const userId = await currentUserId();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await db.insert(todos).values({ userId, title });
  revalidatePath("/");
}

export async function toggleTodo(formData: FormData) {
  const userId = await currentUserId();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return;
  const [todo] = await db.select({ completed: todos.completed }).from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, userId))).limit(1);
  if (!todo) return;
  await db.update(todos).set({ completed: !todo.completed })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)));
  revalidatePath("/");
}

export async function deleteTodo(formData: FormData) {
  const userId = await currentUserId();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) return;
  await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  revalidatePath("/");
}
