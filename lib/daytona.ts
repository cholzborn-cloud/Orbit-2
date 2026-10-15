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

// noVNC des Desktops als signierte URL (iframe ohne Header). Startet Sandbox und Desktop bei Bedarf.
export async function getDesktopUrl(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId);
  if (sandbox.state !== "started") await sandbox.start();
  const { status } = await sandbox.computerUse.getStatus();
  if (status !== "active") await sandbox.computerUse.start();
  // shortcut: Link gilt 1 h; ein offenes iframe bleibt verbunden, erst ein Neuladen danach scheitert.
  const { url } = await sandbox.getSignedPreviewUrl(6080, 3600);
  return `${url}/vnc.html?autoconnect=true&resize=scale&reconnect=true`;
}
