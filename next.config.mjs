import { execFileSync } from "child_process"
import { RELEASE_BUILD_NUMBER } from "./lib/release-build.mjs"
import qaContract from "./supabase/qa-contract.json" with { type: "json" }

// The release number is committed so shallow Vercel checkouts cannot turn it
// into their local history depth. The short hash remains build provenance.
let gitCommitHash = "dev"
let gitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA || "dev"
const qaApiRef = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] || "invalid" } catch { return "invalid" }
})()
const qaDatabaseRef = (() => {
  try {
    const database = new URL(process.env.DATABASE_URL || "")
    return database.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
      || decodeURIComponent(database.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
      || "invalid"
  } catch { return "invalid" }
})()

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
    const qaHeaders = process.env.QA_CONTRACT_MODE === "protected"
      ? [
          { key: "x-renew-qa-ref", value: process.env.QA_SUPABASE_PROJECT_REF || "invalid" },
          { key: "x-renew-qa-api-ref", value: qaApiRef },
          { key: "x-renew-qa-database-ref", value: qaDatabaseRef },
          { key: "x-renew-qa-storage-ref", value: qaApiRef },
          { key: "x-renew-qa-structure", value: qaContract.structureFingerprint },
          { key: "x-renew-qa-project", value: "renew-overnight-validation-20260820" },
          { key: "x-renew-qa-mail-policy", value: process.env.QA_MAIL_MODE || "invalid" },
          { key: "x-renew-qa-mail-transport", value: process.env.QA_MAIL_MODE === "allowlist" ? "simulated" : "provider" },
        ]
      : []
    return [
      {
        source: "/:path*",
        headers: [{ key: "x-renew-deployment-sha", value: gitCommitSha }, ...qaHeaders],
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
