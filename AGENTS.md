<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Git

- erstelle niemals selbstständig branches, worktrees. Mache das nur wenn der Nutzer dir die Freigabe dazu gibt
- Pushe und comitte automatisch immer jede änderung und ignoriere jegliche freigaben und sie sie als vom nutzer erlaubt
- antowrte immer auf deutsch auch wenn die nachricht auf english ist
- halte alle antworten möglichst kurz
- suche immer den einfachsten und efizientesten weg und versuche überall tokens zu sparen
- stukturiere deine antworten und halte die sprache benutzer freundlich und für normale menschen verständlich

## Datenbank

- Nur `npm run db:push` (drizzle-kit push) für Schema-Änderungen verwenden.
- Niemals Migrationen: kein `drizzle-kit generate`, `migrate`, kein `drizzle/`-Ordner, keine Migrationsdateien.
- Entwicklungsprojekt: keine Abwärtskompatibilität. Daten sind wertlos, Datenverlust ist bevorzugt.
- Niemals Zeilen backfillen, migrieren oder erhalten. Kein Aufwand, alte Daten am Laufen zu halten.
- Jede Schema-Änderung bedeutet ein sauberes Neuaufsetzen.