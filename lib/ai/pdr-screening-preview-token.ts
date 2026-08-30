import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import type { PdrScreeningContext, PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"

const domain = "wave-ai-pdr-screening-preview:v3"
type Payload = { v: 3; generationId: string; requestId: string; context: PdrScreeningContext; draftDigest: string; exp: number }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`; return JSON.stringify(value) }
export function pdrScreeningDraftDigest(draft: PdrScreeningDraft) { return createHash("sha256").update(stable(draft)).digest("hex") }
function key() { return process.env.BETTER_AUTH_SECRET?.trim() || null }
function encryptionKey(secret: string) { return createHash("sha256").update(`${domain}\u0000${secret}`).digest() }
function aad(actor: string) { return Buffer.from(`${domain}\u0000${actor}`, "utf8") }
export function createPdrScreeningPreviewToken(input: Omit<Payload, "v" | "exp">, actor: string, now = Date.now()) {
  const secret = key(); if (!secret) throw new Error("Screening preview correlation unavailable.")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv)
  cipher.setAAD(aad(actor))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify({ ...input, v: 3, exp: now + 10 * 60_000 }), "utf8"), cipher.final()])
  return `v3.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`
}
export function validatePdrScreeningPreviewToken(token: string, expected: { actor: string; requestId: string; draftDigest: string }, now = Date.now()): Payload | null {
  const secret = key(); const [version, ivPart, tagPart, ciphertextPart] = token.split("."); if (!secret || version !== "v3" || !ivPart || !tagPart || !ciphertextPart || token.split(".").length !== 4) return null
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivPart, "base64url"))
    decipher.setAAD(aad(expected.actor))
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8")) as Payload
    return payload.v === 3 && typeof payload.generationId === "string" && /^[0-9a-f-]{36}$/i.test(payload.generationId) && typeof payload.requestId === "string" && typeof payload.draftDigest === "string" && /^[a-f0-9]{64}$/.test(payload.draftDigest) && payload.context && typeof payload.context.snapshotId === "string" && typeof payload.context.digest === "string" && typeof payload.context.registryRevision === "string" && typeof payload.context.snapshotAt === "string" && (payload.context.freshness === "fresh" || payload.context.freshness === "stale") && Number.isSafeInteger(payload.exp) && payload.exp >= now && payload.requestId === expected.requestId && payload.draftDigest === expected.draftDigest ? payload : null
  } catch { return null }
}
