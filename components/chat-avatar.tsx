import Image from "next/image"

import { TintedAvatar } from "@/components/tinted-avatar"
import { cn } from "@/lib/utils"

export const ORBIS = [
  "erdi",
  "marsi",
  "sati",
  "jupi",
  "mondi",
  "veni",
  "nepi",
  "urani",
  "pluti",
  "universi",
] as const

// Körperfarbe je Planet im SVG; wird beim Einfärben ersetzt.
export const ORBI_BASE_COLORS: Record<(typeof ORBIS)[number], string> = {
  erdi: "#6d9ee3",
  marsi: "#e3896d",
  sati: "#e3c66d",
  jupi: "#e3a06d",
  mondi: "#94a8bd",
  veni: "#e36d9e",
  nepi: "#6d6de3",
  urani: "#6de3df",
  pluti: "#b26de3",
  universi: "#6f6ae0",
}

export type Orbi = (typeof ORBIS)[number]

function orbiFromSeed(seed: string): Orbi {
  const name = seed.toLowerCase()
  const exact = ORBIS.find((orbi) => orbi === name)
  if (exact) return exact
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return ORBIS[hash % ORBIS.length]
}

export function ChatAvatar({
  seed,
  animated = false,
  color,
  className,
}: {
  seed: string
  animated?: boolean
  color?: string | null
  className?: string
}) {
  const orbi = orbiFromSeed(seed)
  if (color) {
    return <TintedAvatar orbi={orbi} animated={animated} color={color} className={className} />
  }
  return (
    <Image
      src={`/orbis/${orbi}${animated ? "" : "-static"}.svg`}
      alt={orbi}
      width={32}
      height={32}
      unoptimized
      className={cn("shrink-0 overflow-visible", className)}
    />
  )
}
