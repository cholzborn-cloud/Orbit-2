"use client"

import { useEffect, useState } from "react"

import { ORBI_BASE_COLORS, type Orbi } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

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
          ? `data:image/svg+xml;utf8,${encodeURIComponent(svg.replaceAll(ORBI_BASE_COLORS[orbi], color))}`
          : url
      }
      alt={orbi}
      width={32}
      height={32}
      className={cn("shrink-0 overflow-visible", className)}
    />
  )
}
