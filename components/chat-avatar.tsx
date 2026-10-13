import { TintedAvatar } from "@/components/tinted-avatar"

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

export function orbiFromSeed(seed: string): Orbi {
  const name = seed.toLowerCase()
  const exact = ORBIS.find((orbi) => orbi === name)
  if (exact) return exact
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return ORBIS[hash % ORBIS.length]
}

export function ChatAvatar({
  seed,
  color,
  className,
  style,
}: {
  seed: string
  color?: string | null
  className?: string
  style?: React.CSSProperties
}) {
  return <TintedAvatar orbi={orbiFromSeed(seed)} color={color} className={className} style={style} />
}
