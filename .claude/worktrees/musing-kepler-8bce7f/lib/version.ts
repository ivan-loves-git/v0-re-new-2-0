// Build info injected at build time from next.config.mjs
// BUILD_NUMBER = git commit count (progressive: 847, 848, 849...)
// BUILD_HASH = git short hash (unique: 2c617f1)

export const BUILD_NUMBER = process.env.NEXT_PUBLIC_BUILD_NUMBER || "0"
export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH || "dev"

// Combined version string for display: "build 849.2c617f1"
export const BUILD_VERSION = `build ${BUILD_NUMBER}.${BUILD_HASH}`
