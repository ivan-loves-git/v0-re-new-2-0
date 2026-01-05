// Build version - update this with each significant release
// Format: major.minor.patch
export const APP_VERSION = "0.8.50"

// This will be replaced at build time with git commit hash
export const BUILD_HASH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev"

// Combined version string for display
export const BUILD_VERSION = `v${APP_VERSION}.${BUILD_HASH}`
