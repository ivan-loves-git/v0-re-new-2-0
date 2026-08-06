import { createHash } from "node:crypto"

const TELEMETRY_IDENTITY_DOMAIN = "wave-telemetry-user:v1"

/**
 * Derive a stable analytics-only UUID without exposing the authentication ID.
 */
export function getOpaqueTelemetryUserId(userId: string) {
  const normalized = userId.trim()
  if (!normalized) throw new Error("Telemetry identity requires a user ID.")

  const bytes = createHash("sha256")
    .update(TELEMETRY_IDENTITY_DOMAIN)
    .update("\0")
    .update(normalized)
    .digest()
    .subarray(0, 16)

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = bytes.toString("hex")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")
}
