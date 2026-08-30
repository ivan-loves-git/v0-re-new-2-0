import { createHmac, timingSafeEqual } from "node:crypto"
import type { PdrScreeningContext, PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"

const domain = "wave-ai-pdr-screening-preview:v1"
type Payload = { v: 1; generationId: string; userId: string; requestId: string; context: PdrScreeningContext; draft: PdrScreeningDraft; exp: number }
function signature(body: string, key: string) { return createHmac("sha256", key).update(`${domain}.${body}`).digest("base64url") }
function key() { return process.env.BETTER_AUTH_SECRET?.trim() || null }
export function createPdrScreeningPreviewToken(input: Omit<Payload, "v" | "exp">, now = Date.now()) {
  const secret = key(); if (!secret) throw new Error("Screening preview correlation unavailable.")
  const body = Buffer.from(JSON.stringify({ ...input, v: 1, exp: now + 10 * 60_000 })).toString("base64url")
  return `${body}.${signature(body, secret)}`
}
export function validatePdrScreeningPreviewToken(token: string, expected: { userId: string; requestId: string }, now = Date.now()): Payload | null {
  const secret = key(); const [body, supplied] = token.split("."); if (!secret || !body || !supplied) return null
  const expectedSignature = signature(body, secret)
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expectedSignature))) return null
  try { const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload
    return payload.v === 1 && payload.exp >= now && payload.userId === expected.userId && payload.requestId === expected.requestId ? payload : null
  } catch { return null }
}
