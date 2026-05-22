import { execFileSync } from "child_process"

// Get git info at build time
let gitCommitCount = "0"
let gitCommitHash = "dev"

try {
  const gitOptions = { timeout: 300, encoding: "utf8" }
  gitCommitCount = execFileSync(
    "git",
    ["rev-list", "--count", "HEAD"],
    gitOptions,
  ).trim()
  gitCommitHash = execFileSync(
    "git",
    ["rev-parse", "--short=7", "HEAD"],
    gitOptions,
  ).trim()
} catch (e) {
  // Fallback for environments without git
  console.warn("Could not get git info:", e.message)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: gitCommitCount,
    NEXT_PUBLIC_BUILD_HASH: gitCommitHash,
  },
  // Allow file uploads up to 10MB (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Redirect old intake form to v2
  async redirects() {
    return [
      {
        source: "/intake",
        destination: "/intake-v2",
        permanent: false, // Temporary until v2 is stable
      },
    ]
  },
}

export default nextConfig
