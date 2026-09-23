import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/lib/env"
import { isUuid } from "@/lib/uuid"

type Selection = { ownerId: string; staffUserId: string; expiresAt: number }

function signature(payload: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update("staff-portal-selection:v1:").update(payload).digest("base64url")
}

/** Bound to the logged-in staff actor, one selected owner and a short session. */
export function issueStaffPortalSelection(ownerId: string, staffUserId: string) {
  if (!isUuid(ownerId) || !staffUserId) throw new Error("Invalid staff portal selection")
  const payload = Buffer.from(JSON.stringify({ ownerId, staffUserId, expiresAt: Date.now() + 30 * 60_000 } satisfies Selection)).toString("base64url")
  return `${payload}.${signature(payload)}`
}

export function verifyStaffPortalSelection(token: string, ownerId: string, staffUserId: string) {
  const [payload, mac, extra] = token.split(".")
  if (!payload || !mac || extra || payload.length > 1024 || mac.length > 128) return false
  const expected = signature(payload)
  const actualBytes = Buffer.from(mac)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return false
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Selection
    return value.ownerId === ownerId && value.staffUserId === staffUserId
      && Number.isSafeInteger(value.expiresAt) && value.expiresAt > Date.now()
  } catch { return false }
}
