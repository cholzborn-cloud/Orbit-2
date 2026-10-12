"use client"

import { useEffect, useState } from "react"

import { ORBI_BASE_COLORS, type Orbi } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

function toHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

function fromHsl({ h, s, l }: { h: number; s: number; l: number }) {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const dist = (a: string, b: string) =>
  Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)))

// Akzente je Planet: Flecken behalten ihre Farbe, solange sie sich vom Körper abheben;
// Ringe sind immer eine dunklere (bei dunklem Körper hellere) Variante des Körpers.
const ACCENTS: Partial<Record<Orbi, { hex: string; ring: boolean }>> = {
  erdi: { hex: "#4fae6a", ring: false },
  jupi: { hex: "#d9534f", ring: false },
  sati: { hex: "#a68930", ring: true },
  urani: { hex: "#30a6a2", ring: true },
}

function tint(svg: string, orbi: Orbi, color: string) {
  const body = toHsl(color)
  let out = svg.replaceAll(ORBI_BASE_COLORS[orbi], color)
  const accent = ACCENTS[orbi]
  if (accent && (accent.ring || dist(accent.hex, color) < 110)) {
    const l = body.l > 0.3 ? body.l - 0.2 : body.l + 0.25
    out = out.replaceAll(accent.hex, fromHsl({ ...body, l: Math.min(0.9, Math.max(0.1, l)) }))
  }
  // Helle Körper: weiße Tupfer würden verschwinden, also dunkle Tupfer.
  if (body.l > 0.78) out = out.replace(/fill="#fff" opacity="([.\d]+)"/g, 'fill="#000" opacity=".18"')
  return out
}

const cache = new Map<string, Promise<string>>()

function loadSvg(url: string) {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url).then((r) => r.text())
    cache.set(url, p)
  }
  return p
}

export function TintedAvatar({
  orbi,
  animated,
  color,
  className,
}: {
  orbi: Orbi
  animated: boolean
  color: string
  className?: string
}) {
  const url = `/orbis/${orbi}${animated ? "" : "-static"}.svg`
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadSvg(url).then((t) => alive && setSvg(t))
    return () => {
      alive = false
    }
  }, [url])

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={
        svg
          ? `data:image/svg+xml;utf8,${encodeURIComponent(tint(svg, orbi, color))}`
          : url
      }
      alt={orbi}
      width={32}
      height={32}
      className={cn("shrink-0 overflow-visible", className)}
    />
  )
}
