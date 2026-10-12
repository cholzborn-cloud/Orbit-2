# Next.js template

This is a Next.js template with shadcn/ui.

## Database: Drizzle + Neon

The existing Neon project is linked through `.neon`. Keep credentials in
`.env.local` (ignored by Git):

- `DATABASE_URL`: pooled Neon connection for application queries.
- `DATABASE_URL_UNPOOLED`: direct Neon connection for push and Studio.

Import `db` from `@/lib/db` in Server Components, Server Actions, or Route
Handlers. The client uses the Neon HTTP driver and is protected by `server-only`.
Authorization for user data belongs in the calling server code; the database
client does not enforce Clerk permissions.

Define tables in `lib/db/schema.ts`, then run:

```bash
npm run db:push     # Sync the schema to the configured database
npm run db:studio   # Open the local database browser
```

Drizzle Kit loads `.env*` using Next.js's environment-loading rules.

Reference: [Neon's Drizzle guide](https://neon.com/docs/guides/drizzle).

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
