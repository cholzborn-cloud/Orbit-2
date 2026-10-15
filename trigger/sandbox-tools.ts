import { Daytona, type Sandbox } from "@daytona/sdk";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

// Eigener Client im Worker: lib/daytona.ts ist server-only.
// apiUrl explizit, sonst bricht das SDK ab, wenn .env.local und Prozess-Umgebung beide den Wert setzen.
const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY, apiUrl: process.env.DAYTONA_API_URL });

const MAX_OUTPUT = 10_000;
const tail = (s: string) => (s.length > MAX_OUTPUT ? `…(gekürzt)\n${s.slice(-MAX_OUTPUT)}` : s);

// Sandbox holen und ggf. starten (stoppt nach 15 Min Leerlauf).
export async function startSandbox(sandboxId: string) {
  const sb = await daytona.get(sandboxId);
  if (sb.state !== "started") await sb.start();
  return sb;
}

export type SharedFileOutput = { filename: string; mediaType: string; size: number; data: string };
const MAX_SHARE = 5 * 1024 * 1024;
const MEDIA_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  pdf: "application/pdf", zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
  json: "application/json", csv: "text/csv", md: "text/markdown", html: "text/html", txt: "text/plain",
  mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav",
};
const mediaTypeOf = (name: string) => MEDIA_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "text/plain";

export type Screenshot = { image: string; mediaType: "image/jpeg"; width: number; height: number };

// Screenshot als Bild für das Modell; die Middleware in chat.ts reicht es als Bild weiter.
const screenshotForModel = ({ output }: { output: Screenshot }) => ({
  type: "content" as const,
  value: [
    { type: "text" as const, text: `Screenshot ${output.width}x${output.height} px.` },
    { type: "file" as const, data: { type: "data" as const, data: output.image }, mediaType: output.mediaType },
  ],
});

const point = { x: z.number().int().min(0).describe("X in Pixeln"), y: z.number().int().min(0).describe("Y in Pixeln") };

export function sandboxTools(sandboxId: string) {
  // Einmal pro Run: Sandbox ggf. starten (stoppt nach 15 Min Leerlauf), Desktop nur für GUI-Tools.
  let ready: Promise<Sandbox> | undefined;
  let desktop: Promise<Sandbox> | undefined;
  const sandbox = () =>
    (ready ??= startSandbox(sandboxId).catch((e) => {
      ready = undefined;
      throw e;
    }));
  const gui = () =>
    (desktop ??= (async () => {
      const sb = await sandbox();
      await sb.computerUse.start();
      return sb;
    })().catch((e) => {
      desktop = undefined;
      throw e;
    }));

  const screenshot = async (): Promise<Screenshot> => {
    const sb = await gui();
    const [shot, info] = await Promise.all([
      // Ohne scale: Bildpixel = Klickkoordinaten.
      sb.computerUse.screenshot.takeCompressed({ format: "jpeg", quality: 70, showCursor: true }),
      sb.computerUse.display.getInfo(),
    ]);
    const d = info.displays?.[0];
    return { image: shot.screenshot ?? "", mediaType: "image/jpeg", width: d?.width ?? 0, height: d?.height ?? 0 };
  };

  return {
    bash: tool({
      description:
        "Run a shell command in your sandbox (bash, user `daytona`, home /home/daytona). Returns exit code and combined output (last 10k chars). For GUI apps started from bash, use `DISPLAY=:0 nohup <app> >/dev/null 2>&1 &` (installed e.g. `chromium`, `xfce4-terminal`).",
      inputSchema: z.object({
        command: z.string(),
        cwd: z.string().optional().describe("Working directory, default home"),
        timeout: z.number().int().min(1).max(600).optional().describe("Seconds, default 60"),
      }),
      execute: async ({ command, cwd, timeout }) => {
        const sb = await sandbox();
        const r = await sb.process.executeCommand(command, cwd, undefined, timeout ?? 60);
        return { exitCode: r.exitCode, output: tail(r.result ?? "") };
      },
    }),

    read_file: tool({
      description: "Read a text file from your sandbox (first 10k chars).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        const content = (await (await sandbox()).fs.downloadFile(path)).toString("utf8");
        return { path, content: content.length > MAX_OUTPUT ? `${content.slice(0, MAX_OUTPUT)}\n…(gekürzt)` : content };
      },
    }),

    write_file: tool({
      description: "Create or overwrite a text file in your sandbox. Parent folders must exist (create them with bash `mkdir -p`).",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        await (await sandbox()).fs.uploadFile(Buffer.from(content, "utf8"), path);
        return { path, bytes: Buffer.byteLength(content) };
      },
    }),

    list_files: tool({
      description: "List files and folders in a directory of your sandbox.",
      inputSchema: z.object({ path: z.string().default(".").describe("Default: home") }),
      execute: async ({ path }) => {
        const files = await (await sandbox()).fs.listFiles(path);
        return files.map((f) => ({ name: f.name, isDir: f.isDir, size: f.size }));
      },
    }),

    share_file: tool({
      description:
        "Send a file from your sandbox to the user in the chat (they can preview and download it). Max 5 MB. Use whenever the user should receive a file you created or found.",
      inputSchema: z.object({ path: z.string().describe("Absolute path or relative to home") }),
      execute: async ({ path }): Promise<SharedFileOutput> => {
        const sb = await sandbox();
        const info = await sb.fs.getFileDetails(path);
        if (info.isDir) throw new Error("Das ist ein Ordner. Packe ihn zuerst, z. B. mit `zip -r`.");
        if (info.size > MAX_SHARE) throw new Error(`Datei ist ${Math.round(info.size / 1024 / 1024)} MB groß, erlaubt sind 5 MB.`);
        const bytes = await sb.fs.downloadFile(path);
        const filename = path.split("/").pop() || "datei";
        return { filename, mediaType: mediaTypeOf(filename), size: bytes.length, data: bytes.toString("base64") };
      },
      // Nur Bestätigung ans Modell, nie die Bytes.
      toModelOutput: ({ output }) => ({ type: "text", value: `Shared ${output.filename} (${output.size} bytes) with the user.` }),
    }),

    view_screen: tool({
      description:
        "Take a screenshot of your sandbox desktop so YOU can see it. Not shown to the user. Use before and after GUI actions to check what happened.",
      inputSchema: z.object({}),
      execute: screenshot,
      toModelOutput: screenshotForModel,
    }),

    show_screen: tool({
      description:
        "Take a screenshot of your sandbox desktop and show it to the user in the chat. Use only when the user wants to see the screen.",
      inputSchema: z.object({}),
      execute: screenshot,
      toModelOutput: screenshotForModel,
    }),

    mouse_click: tool({
      description: "Click at a screen position.",
      inputSchema: z.object({
        ...point,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false),
      }),
      execute: async ({ x, y, button, double }) => {
        await (await gui()).computerUse.mouse.click(x, y, button, double);
        return { ok: true };
      },
    }),

    mouse_move: tool({
      description: "Move the mouse to a screen position (e.g. to hover).",
      inputSchema: z.object(point),
      execute: async ({ x, y }) => {
        await (await gui()).computerUse.mouse.move(x, y);
        return { ok: true };
      },
    }),

    mouse_scroll: tool({
      description: "Scroll the mouse wheel at a screen position.",
      inputSchema: z.object({
        ...point,
        direction: z.enum(["up", "down"]),
        amount: z.number().int().min(1).max(30).default(3).describe("Wheel ticks"),
      }),
      execute: async ({ x, y, direction, amount }) => {
        await (await gui()).computerUse.mouse.scroll(x, y, direction, amount);
        return { ok: true };
      },
    }),

    mouse_drag: tool({
      description: "Drag with the left mouse button from one position to another.",
      inputSchema: z.object({
        startX: z.number().int().min(0),
        startY: z.number().int().min(0),
        endX: z.number().int().min(0),
        endY: z.number().int().min(0),
      }),
      execute: async ({ startX, startY, endX, endY }) => {
        await (await gui()).computerUse.mouse.drag(startX, startY, endX, endY);
        return { ok: true };
      },
    }),

    keyboard_type: tool({
      description: "Type text at the current keyboard focus.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        await (await gui()).computerUse.keyboard.type(text);
        return { ok: true };
      },
    }),

    keyboard_press: tool({
      description: "Press one key, optionally with modifiers. Keys like 'Return', 'Escape', 'Tab', 'BackSpace', 'Up', 'F5', 'a'.",
      inputSchema: z.object({
        key: z.string(),
        modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd"])).optional(),
      }),
      execute: async ({ key, modifiers }) => {
        await (await gui()).computerUse.keyboard.press(key, modifiers);
        return { ok: true };
      },
    }),

    keyboard_hotkey: tool({
      description: "Press a key combination, e.g. 'ctrl+c', 'ctrl+shift+t', 'alt+tab'.",
      inputSchema: z.object({ keys: z.string() }),
      execute: async ({ keys }) => {
        await (await gui()).computerUse.keyboard.hotkey(keys);
        return { ok: true };
      },
    }),

    wait: tool({
      description: "Wait a few seconds, e.g. for a page or app to load.",
      inputSchema: z.object({ seconds: z.number().min(0.5).max(30) }),
      execute: async ({ seconds }, { abortSignal }) => {
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, seconds * 1000);
          abortSignal?.addEventListener("abort", () => (clearTimeout(t), resolve()));
        });
        return { ok: true };
      },
    }),
  } satisfies ToolSet;
}

export type SandboxTools = ReturnType<typeof sandboxTools>;
