import { dirname } from "path"
import { fileURLToPath } from "url"

const appDir = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT || "3001"
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || `http://localhost:${backendPort}`).replace(/\/$/, "")

const nextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: {
    root: appDir,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
    ],
  },
}

export default nextConfig
