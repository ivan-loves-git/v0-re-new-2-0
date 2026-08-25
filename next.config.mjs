import { execFileSync } from "child_process"
import { RELEASE_BUILD_NUMBER } from "./lib/release-build.mjs"

// Vercel builds from a shallow checkout, so the release number is committed
// rather than derived from history depth. The short hash is build provenance.
let gitCommitHash = "dev"
let gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || "dev"

try {
  const gitOptions = { timeout: 300, encoding: "utf8" }
  gitCommitHash = execFileSync(
    "git",
    ["rev-parse", "--short=7", "HEAD"],
    gitOptions,
  ).trim()
  if (gitCommitSha === "dev") {
    gitCommitSha = execFileSync("git", ["rev-parse", "HEAD"], gitOptions).trim()
  }
} catch (e) {
  // Fallback for environments without git
  console.warn("Could not get git info:", e.message)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
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
    NEXT_PUBLIC_BUILD_NUMBER: RELEASE_BUILD_NUMBER,
    NEXT_PUBLIC_BUILD_HASH: gitCommitHash,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "x-renew-deployment-sha", value: gitCommitSha }],
      },
    ]
  },
  // W-108 accepts private External Pursuit attachments up to 20 MiB. Keep a
  // small multipart/server-action envelope above the validated file limit.
  experimental: {
    serverActions: {
      bodySizeLimit: "22mb",
    },
  },
  // The isolated PDF validator dynamically imports the server-resolved PDF.js
  // modules from an eval worker. Keep only those two self-contained server
  // bundles in the trace; they must never become browser static assets.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
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
