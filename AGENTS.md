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

## Formulare

- Schema: Insert-Schema per `createInsertSchema` (drizzle-zod) in `lib/db/<name>-schema.ts`. Formular-Schema per `.pick()` nur auf die Felder, die der Nutzer ausfüllt.
- Server Action in `actions/<name>.ts`: `"use server"`, `userId` immer per Clerk `auth()` holen, nie aus dem Client. Eingabe mit `safeParse` prüfen. Rückgabe als `{ ok: true, ... } | { ok: false, error }`.
- Client: `react-hook-form` mit `zodResolver`. Server-Fehler über `form.setError("root", ...)` anzeigen.
- Felder: `Field`, `FieldLabel`, `FieldError` aus `components/ui/field`. Deutsche Labels und Fehlermeldungen direkt im Schema.
- Textareas: `resize-none`, damit das Feld nicht verzerrt wird.
- Auswahl-Knöpfe (Chips, Planeten): ausgewählt nur per Farbe. Keine Größen-, Rahmen- oder Icon-Änderung, sonst verschieben sich die Knöpfe.
- Chip-Reihen: `flex flex-wrap gap-1.5`, natürliche Breite, gleicher Abstand. Kein `justify-between`, kein `w-full`.
- Ausgewählter Chip: Hintergrund komplett `bg-white` inkl. Hover, Active und `dark:`-Varianten überschreiben. Outline-Hover (`dark:hover:bg-input/50`) sonst wirkt beim Drücken schwarz.
- Vorbelegung: sinnvolle Defaults setzen. Ein Auto-Name (z. B. Planet-Name) nur ersetzen, solange der Nutzer das Feld nicht selbst geändert hat.
- Install: `npm i <pkg> --legacy-peer-deps` (Peer-Konflikt von `@hookform/resolvers` mit zod).
- Commits: keine E-Mail-Adresse in der Commit-Nachricht. Der `rulebook-guard`-Hook blockiert sie.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
