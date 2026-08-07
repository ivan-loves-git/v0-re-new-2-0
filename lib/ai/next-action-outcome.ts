import { createHmac, timingSafeEqual } from "node:crypto"

export type ConfirmableWaveAiAction = "resolve_source_review" | "complete_opportunity_profile"
type TokenPayload = { v: 1; generationId: string; userId: string; opportunityId: string; action: ConfirmableWaveAiAction; exp: number }
const domain = "wave-ai-next-action-outcome-v1"

function secret() { return process.env.BETTER_AUTH_SECRET?.trim() || null }
function encode(value: TokenPayload) { return Buffer.from(JSON.stringify(value)).toString("base64url") }
function signature(body: string, key: string) { return createHmac("sha256", key).update(`${domain}.${body}`).digest("base64url") }

export function createWaveAiOutcomeToken(input: Omit<TokenPayload, "v" | "exp">, now = Date.now()) {
  const key = secret(); if (!key) throw new Error("WAVE AI outcome correlation is unavailable.")
  const body = encode({ ...input, v: 1, exp: now + 15 * 60_000 })
  return `${body}.${signature(body, key)}`
}

export function validateWaveAiOutcomeToken(token: string | null | undefined, expected: Omit<TokenPayload, "v" | "generationId" | "exp">, now = Date.now()) {
  const key = secret(); if (!key || !token) return null
  const [body, supplied] = token.split("."); if (!body || !supplied) return null
  const expectedSignature = signature(body, key)
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expectedSignature))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload
    if (payload.v !== 1 || !Number.isFinite(payload.exp) || payload.exp < now || payload.userId !== expected.userId || payload.opportunityId !== expected.opportunityId || payload.action !== expected.action) return null
    return payload.generationId
  } catch { return null }
}

/** Logging is evidence only. A failed append never changes a successful mutation result. */
export async function appendConfirmedWaveAiOutcome(input: { token?: string | null; userId: string; opportunityId: string; action: ConfirmableWaveAiAction }) {
  const generationId = validateWaveAiOutcomeToken(input.token, input)
  if (!generationId) return false
  try { const { recordWaveAiGenerationEvent } = await import("@/lib/ai/ledger"); await recordWaveAiGenerationEvent({ actorUserId: input.userId, generationId, eventType: "workflow_action_confirmed", actionKey: input.action }); return true } catch { return false }
}
