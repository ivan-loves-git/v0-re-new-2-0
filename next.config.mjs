import { execSync } from 'child_process'
import { existsSync } from 'fs'

// Get git info at build time
let gitCommitCount = '0'
let gitCommitHash = 'dev'

try {
  // Only attempt git commands if we're in a git repository
  if (existsSync('.git')) {
    gitCommitCount = execSync('git rev-list --count HEAD').toString().trim()
    gitCommitHash = execSync('git rev-parse --short=7 HEAD').toString().trim()
  }
} catch (e) {
  // Fallback for environments without git
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
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
      bodySizeLimit: '10mb',
    },
  },
  // Redirect old intake form to v2
  async redirects() {
    return [
      {
        source: '/intake',
        destination: '/intake-v2',
        permanent: false, // Temporary until v2 is stable
      },
    ]
  },
}

export default nextConfig
