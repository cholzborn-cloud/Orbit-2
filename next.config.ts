import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // iPad/Handy im LAN: sonst blockt Next.js Dev-Assets (weiße Seite)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
}

export default nextConfig
