import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";

export default async function Page() {
  const { isAuthenticated, userId } = await auth();
  const items = isAuthenticated
    ? await db.select().from(bots).where(eq(bots.userId, userId)).orderBy(asc(bots.createdAt))
    : [];

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-xl flex-col px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Bots</h1>
      {isAuthenticated ? (
        <ul className="mt-6 divide-y rounded-xl border">
          {items.length ? items.map((bot) => (
            <li key={bot.id} className="px-4 py-3">
              <p className="text-sm font-medium">{bot.name}</p>
              <p className="text-sm text-muted-foreground">{bot.job}</p>
            </li>
          )) : (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Noch keine Bots.</li>
          )}
        </ul>
      ) : (
        <div className="mt-8 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Melde dich an, um deine Bots zu sehen.</p>
          <SignInButton mode="modal">
            <button className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80" type="button">Anmelden</button>
          </SignInButton>
        </div>
      )}
    </main>
  );
}
