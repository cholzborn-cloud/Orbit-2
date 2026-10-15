"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { defaultComponents, type Components, type StreamdownTranslations } from "streamdown";

import { ImagePreview } from "@/components/media";

// Link mit kleinem Kopieren-Knopf beim Hovern.
function LinkWithCopy(props: React.ComponentProps<typeof defaultComponents.a>) {
  const [done, setDone] = useState(false);
  const DefaultLink = defaultComponents.a;
  return (
    <span className="group/link inline">
      <DefaultLink {...props} />
      {props.href && (
        <button
          type="button"
          aria-label="Link kopieren"
          title="Link kopieren"
          className="ml-0.5 inline-grid size-4 translate-y-0.5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100 hover:text-foreground focus-visible:opacity-100"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(props.href!);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {}
          }}
        >
          {done ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
        </button>
      )}
    </span>
  );
}

function MarkdownImage(props: React.ComponentProps<typeof defaultComponents.img>) {
  if (typeof props.src !== "string") return <defaultComponents.img {...props} />;
  const filename = props.src.startsWith("data:") ? "bild" : (props.src.split("/").pop()?.split("?")[0] ?? "bild");
  return <ImagePreview src={props.src} alt={props.alt || "Bild"} filename={filename} className="my-2 max-w-sm" />;
}

// Auf Modulebene: MessageResponse vergleicht im memo nur children/isAnimating.
export const markdownComponents: Components = { a: LinkWithCopy, img: MarkdownImage };

export const markdownTranslations: Partial<StreamdownTranslations> = {
  close: "Schließen",
  copied: "Kopiert",
  copyCode: "Code kopieren",
  copyLink: "Link kopieren",
  copyTable: "Tabelle kopieren",
  copyTableAsCsv: "Als CSV kopieren",
  copyTableAsMarkdown: "Als Markdown kopieren",
  copyTableAsTsv: "Als TSV kopieren",
  downloadDiagram: "Diagramm herunterladen",
  downloadDiagramAsMmd: "Als MMD herunterladen",
  downloadDiagramAsPng: "Als PNG herunterladen",
  downloadDiagramAsSvg: "Als SVG herunterladen",
  downloadFile: "Datei herunterladen",
  downloadImage: "Bild herunterladen",
  downloadTable: "Tabelle herunterladen",
  downloadTableAsCsv: "Als CSV herunterladen",
  downloadTableAsMarkdown: "Als Markdown herunterladen",
  exitFullscreen: "Vollbild beenden",
  externalLinkWarning: "Du verlässt Orbit und öffnest eine externe Seite.",
  imageNotAvailable: "Bild nicht verfügbar",
  openExternalLink: "Externen Link öffnen",
  openLink: "Link öffnen",
  resetView: "Ansicht zurücksetzen",
  viewFullscreen: "Vollbild",
  zoomIn: "Vergrößern",
  zoomOut: "Verkleinern",
};
