"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  XIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SharedFile = { url: string; mediaType: string; filename?: string; size?: number };

// data:- und blob:-URLs lassen sich beide per fetch in einen Blob verwandeln.
const toBlob = async (url: string) => (await fetch(url)).blob();

export function downloadFile(url: string, filename = "datei") {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

// Chrome blockiert data:-URLs in neuen Tabs, deshalb über eine blob:-URL öffnen.
export async function openFile(url: string) {
  const href = URL.createObjectURL(await toBlob(url));
  window.open(href, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

// Zwischenablage nimmt nur PNG sicher an: andere Formate über ein Canvas umwandeln.
async function copyImage(url: string) {
  let blob = await toBlob(url);
  if (blob.type !== "image/png") {
    const bitmap = await createImageBitmap(blob);
    const canvas = Object.assign(document.createElement("canvas"), { width: bitmap.width, height: bitmap.height });
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG fehlgeschlagen"))), "image/png"));
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export const formatBytes = (n?: number) =>
  n == null ? "" : n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

// Größe einer data:-URL ohne Dekodieren schätzen.
export const dataUrlBytes = (url: string) => {
  const i = url.indexOf(",");
  return url.startsWith("data:") && i > 0 ? Math.floor(((url.length - i - 1) * 3) / 4) : undefined;
};

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

function CopyImageButton({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label="Bild kopieren"
      onClick={async () => {
        try {
          await copyImage(url);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? <CheckIcon /> : <CopyIcon />}
    </IconButton>
  );
}

// Vorschaubild; Klick öffnet Vollbild mit Kopieren, Öffnen und Herunterladen oben rechts.
export function ImagePreview({
  src,
  alt,
  filename = "bild.png",
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  filename?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} vergrößern`}
        className={cn(
          "block cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data:/blob:-URLs, kein Optimieren möglich */}
        <img src={src} alt={alt} width={width} height={height} className="h-auto w-full" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-2 bg-black/95 p-2 text-white ring-white/10 sm:max-w-[96vw]"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="flex items-center justify-between gap-2 [&_button]:text-white [&_button:hover]:bg-white/15 [&_button:hover]:text-white">
            <span className="truncate pl-2 text-xs text-white/70">{filename}</span>
            <div className="flex shrink-0 items-center gap-1">
              <CopyImageButton url={src} />
              <IconButton label="In neuem Tab öffnen" onClick={() => void openFile(src)}>
                <ExternalLinkIcon />
              </IconButton>
              <IconButton label="Herunterladen" onClick={() => downloadFile(src, filename)}>
                <DownloadIcon />
              </IconButton>
              <DialogClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Schließen" />}>
                <XIcon />
              </DialogClose>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data:/blob:-URLs, kein Optimieren möglich */}
          <img src={src} alt={alt} className="min-h-0 flex-1 object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

const CODE = /\.(js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|cs|php|sh|json|ya?ml|toml|html|css|sql|md)$/i;

function FileTypeIcon({ mediaType, filename = "" }: SharedFile) {
  const className = "size-4 text-muted-foreground";
  if (/zip|tar|gzip|compressed|7z|rar/.test(mediaType)) return <FileArchiveIcon className={className} />;
  if (CODE.test(filename) || /json|javascript|typescript|xml|x-sh/.test(mediaType)) return <FileCodeIcon className={className} />;
  if (mediaType.startsWith("text/") || mediaType === "application/pdf") return <FileTextIcon className={className} />;
  return <FileIcon className={className} />;
}

// Datei-Karte: Bilder als Vorschau, sonst Name, Größe, Öffnen und Herunterladen.
export function FileCard({ file, className }: { file: SharedFile; className?: string }) {
  const name = file.filename || "Datei";
  if (file.mediaType.startsWith("image/"))
    return <ImagePreview src={file.url} alt={name} filename={name} className={cn("w-full max-w-xs", className)} />;
  const size = formatBytes(file.size ?? dataUrlBytes(file.url));
  return (
    <div className={cn("flex w-full max-w-xs items-center gap-2 rounded-md border bg-background p-2 text-foreground", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded bg-muted">
        <FileTypeIcon {...file} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{[file.mediaType, size].filter(Boolean).join(" · ")}</span>
      </span>
      <IconButton label="Öffnen" onClick={() => void openFile(file.url)}>
        <ExternalLinkIcon />
      </IconButton>
      <IconButton label="Herunterladen" onClick={() => downloadFile(file.url, name)}>
        <DownloadIcon />
      </IconButton>
    </div>
  );
}

// Große Fotos vor dem Senden verkleinern (längste Seite 1600 px, JPEG): spart Upload und Tokens.
const MAX_SIDE = 1600;
export async function shrinkImage<T extends SharedFile>(file: T): Promise<T> {
  if (!/^image\/(png|jpe?g|webp|heic|heif|bmp)$/.test(file.mediaType)) return file;
  try {
    const bitmap = await createImageBitmap(await toBlob(file.url));
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const bytes = dataUrlBytes(file.url) ?? 0;
    if (scale === 1 && bytes < 500_000) return file;
    const canvas = Object.assign(document.createElement("canvas"), {
      width: Math.round(bitmap.width * scale),
      height: Math.round(bitmap.height * scale),
    });
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // JPEG kennt keine Transparenz
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const filename = `${(file.filename ?? "bild").replace(/\.[^.]+$/, "")}.jpg`;
    return { ...file, url: canvas.toDataURL("image/jpeg", 0.85), mediaType: "image/jpeg", filename };
  } catch {
    return file;
  }
}
