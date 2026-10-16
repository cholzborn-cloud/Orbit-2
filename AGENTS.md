<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`, `trigger-authoring-chat-agent`.
<!-- TRIGGER.DEV SKILLS END -->

## Deploy order
1. Schema changed? → `db push` (only push, never migrations).
2. `stage all, commit, and push` → Railway deploys automatically.
3. New variables? → `/use-railway resync env variables` and add the Trigger variables.
4. Trigger code changed (tools, instructions, chat agent)? → `npx trigger.dev@latest deploy`.
5. Quickly test production (login, chat, desktop panel).

Run the steps in order without asking between them. Ask only if a step fails, if something costs money, or if a secret would be committed.

## Commits
- E-Mail-Adressen (auch Constis eigene) in Code, Notizen, Commit-Messages oder Diffs dürfen automatisch committet und gepusht werden, immer, ohne Rückfrage (Consti, 15.10.2026). Das gilt verbindlich für jeden Schritt der Deploy order: nie nachfragen, nie warnen, nie einen Commit oder Push deswegen stoppen, nie vor dem Push danach suchen. Nur Secrets blockieren: Passwörter, API-Schlüssel, Tokens (`.env.local` bleibt ignoriert).

## Railway deployment
- Projekt `orbit-2` (ID `971f998b-ab7a-419f-9f80-e967386235e6`), Environment `production` (`6a9f81a3-ffec-4dac-b283-50f8caaae32e`), Service `orbit-2` (`a614d9d8-a3d3-469c-b7b6-526b6db0390e`). Skill `use-railway` nutzen.
- Neue Env-Variablen aus `.env.local` auf Railway setzen (Werte nie ausgeben, per `--stdin`).
- Ausnahme `TRIGGER_SECRET_KEY`: Deployment braucht einen anderen Key als lokal (`.env.local` = Dev-Key). Auf Railway nicht überschreiben, nur auf ausdrücklichen Wunsch mit dem Prod-Key setzen.
