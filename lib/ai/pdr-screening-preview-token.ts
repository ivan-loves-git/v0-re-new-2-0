import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { PdrScreeningContext, PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"

const domain = "wave-ai-pdr-screening-preview:v2"
type Payload = { v: 2; generationId: string; requestId: string; context: PdrScreeningContext; draftDigest: string; exp: number }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`; return JSON.stringify(value) }
export function pdrScreeningDraftDigest(draft: PdrScreeningDraft) { return createHash("sha256").update(stable(draft)).digest("hex") }
function signature(body: string, actor: string, key: string) { return createHmac("sha256", key).update(`${domain}.${actor}.${body}`).digest("base64url") }
function key() { return process.env.BETTER_AUTH_SECRET?.trim() || null }
export function createPdrScreeningPreviewToken(input: Omit<Payload, "v" | "exp">, actor: string, now = Date.now()) {
  const secret = key(); if (!secret) throw new Error("Screening preview correlation unavailable.")
  const body = Buffer.from(JSON.stringify({ ...input, v: 1, exp: now + 10 * 60_000 })).toString("base64url")
  return `${body}.${signature(body, actor, secret)}`
}
export function validatePdrScreeningPreviewToken(token: string, expected: { actor: string; requestId: string; draftDigest: string }, now = Date.now()): Payload | null {
  const secret = key(); const [body, supplied] = token.split("."); if (!secret || !body || !supplied) return null
  const expectedSignature = signature(body, expected.actor, secret)
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expectedSignature))) return null
  try { const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload
    return payload.v === 2 && typeof payload.generationId === "string" && typeof payload.requestId === "string" && typeof payload.draftDigest === "string" && /^[a-f0-9]{64}$/.test(payload.draftDigest) && payload.exp >= now && payload.requestId === expected.requestId && payload.draftDigest === expected.draftDigest ? payload : null
  } catch { return null }
}
