import Image from "next/image"

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
  "sunny",
  "pluti",
] as const

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
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const orbi = orbiFromSeed(seed)
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
