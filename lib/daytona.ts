import "server-only";

import { Daytona } from "@daytona/sdk";

// apiUrl explizit, sonst bricht das SDK ab, wenn .env.local und Prozess-Umgebung beide den Wert setzen.
const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY, apiUrl: process.env.DAYTONA_API_URL });

export async function createSandbox(botId: string) {
  const sandbox = await daytona.create({ labels: { botId } });
  return sandbox.id;
}

export async function deleteSandbox(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId);
  await sandbox.delete();
}
