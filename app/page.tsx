import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { Check, Circle, Trash2 } from "lucide-react";
import { addTodo, deleteTodo, toggleTodo } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { todos } from "@/lib/db/schema";

export default async function Page() {
  const { userId } = await auth();
  const items = userId
    ? await db.select().from(todos).where(eq(todos.userId, userId)).orderBy(asc(todos.id))
    : [];

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-xl flex-col px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">A little at a time</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Today&apos;s todos</h1>
      {userId ? (
        <>
          <form action={addTodo} className="mt-8 flex gap-2">
            <input
              aria-label="New todo"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              name="title"
              placeholder="What needs doing?"
              required
            />
            <Button type="submit" className="h-11 px-5">Add</Button>
          </form>
          <ul className="mt-6 divide-y rounded-xl border">
            {items.length ? items.map((todo) => (
              <li key={todo.id} className="flex items-center gap-3 px-4 py-3">
                <form action={toggleTodo}>
                  <input type="hidden" name="id" value={todo.id} />
                  <button aria-label={todo.completed ? "Mark as incomplete" : "Mark as complete"} className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground" type="submit">
                    {todo.completed ? <Check className="size-5" /> : <Circle className="size-5" />}
                  </button>
                </form>
                <span className={`min-w-0 flex-1 text-sm ${todo.completed ? "text-muted-foreground line-through" : ""}`}>{todo.title}</span>
                <form action={deleteTodo}>
                  <input type="hidden" name="id" value={todo.id} />
                  <button aria-label="Delete todo" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" type="submit">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </li>
            )) : (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing here yet. Add your first todo above.</li>
            )}
          </ul>
        </>
      ) : (
        <div className="mt-8 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Sign in to keep your todo list synced to your account.</p>
          <SignInButton mode="modal">
            <button className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80" type="button">Sign in</button>
          </SignInButton>
        </div>
      )}
    </main>
  );
}
