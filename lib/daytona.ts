import "server-only";

import { Daytona } from "@daytona/sdk";

import { MEMORY_PATH } from "@/trigger/attachments";

// apiUrl explizit, sonst bricht das SDK ab, wenn .env.local und Prozess-Umgebung beide den Wert setzen.
const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY, apiUrl: process.env.DAYTONA_API_URL });

export async function createSandbox(botId: string) {
  const sandbox = await daytona.create({ labels: { botId } });
  try {
    await sandbox.fs.uploadFile(Buffer.alloc(0), MEMORY_PATH);
  } catch (e) {
    // Leere Datei ist nur Komfort: der Orbi legt sie beim ersten Schreiben selbst an, Anlegen der Sandbox darf nicht scheitern.
    console.error("MEMORY.md konnte nicht angelegt werden", e);
  }
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
