import { execSync } from 'child_process'

// Get git info at build time
let gitCommitCount = '0'
let gitCommitHash = 'dev'

try {
  gitCommitCount = execSync('git rev-list --count HEAD').toString().trim()
  gitCommitHash = execSync('git rev-parse --short=7 HEAD').toString().trim()
} catch (e) {
  // Fallback for environments without git
  console.warn('Could not get git info:', e.message)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_NUMBER: gitCommitCount,
    NEXT_PUBLIC_BUILD_HASH: gitCommitHash,
  },
}

export default nextConfig
