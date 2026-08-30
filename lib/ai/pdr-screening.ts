import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseUsage } from "openai/resources/responses/responses"
import { isGovernanceProjectionStale } from "@/lib/governance-projection/freshness"
import type { CurrentGovernanceProjection } from "@/lib/governance-projection/server"
import { WAVE_AI_MODEL, WAVE_AI_REASONING_EFFORT } from "@/lib/ai/config"
import { getWaveAiOpenAiClient } from "@/lib/ai/openai-client"
import { PDR_CAPABILITY_CATALOGUE, PDR_CAPABILITY_CATALOGUE_VERSION } from "@/lib/ai/pdr-capability-catalogue"
import { PDR_SCREENING_OUTPUT_SCHEMA_VERSION, PDR_SCREENING_PROMPT_VERSION, pdrScreeningDraftSchema, type PdrScreeningContext, type PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"
import { PdrScreeningOutputError } from "@/lib/ai/pdr-screening-output-error"

type RequestSource = { id: string; title: string; originalText: string }

const MAX_CONTEXT_BYTES = 24_000
// The structured preview can contain five clarifications plus several bounded
// advisory fields. 2,400 tokens was observed to truncate a valid live request;
// 4,800 keeps the single-attempt contract while leaving enough room to complete
// the strict schema. This is intentionally scoped to PDR screening.
export const PDR_SCREENING_MAX_OUTPUT_TOKENS = 4_800
const cap = (value: string, max: number) => value.trim().slice(0, max)

function allowedContext(current: Extract<CurrentGovernanceProjection, { state: "available" }>) {
  const { projection } = current
  const activeMilestones = projection.registry.milestones.filter((item) => item.lifecycle === "active")
  const activeGuardrails = projection.registry.guardrails.filter((item) => item.lifecycle === "active")
  const productChanges = projection.issues.filter((item) => item.kind === "Product Change")
  if (projection.registry.goals.length > 30 || activeMilestones.length > 60 || activeGuardrails.length > 40 || productChanges.length > 80) throw new Error("The governance context cannot be compacted safely.")
  return {
    registryRevision: projection.registryRevision,
    goals: projection.registry.goals.slice(0, 30).map(({ id, title, statement }) => ({ id, title: cap(title, 160), statement: cap(statement, 700) })),
    milestones: activeMilestones.map(({ id, goalId, title, outcome }) => ({ id, goalId, title: cap(title, 160), outcome: cap(outcome, 700) })),
    guardrails: activeGuardrails.map(({ id, title, rule }) => ({ id, title: cap(title, 160), rule: cap(rule, 700) })),
    productChanges: productChanges.map((item) => ({
      number: item.number, title: cap(item.title, 200), status: item.projectStatus,
      goalId: item.placement.goalId, milestoneId: item.placement.milestoneId,
      provenance: item.provenance?.state ?? "unverified",
    })),
    capabilityCatalogue: { version: PDR_CAPABILITY_CATALOGUE_VERSION, entries: PDR_CAPABILITY_CATALOGUE },
  } as const
}

function screeningInstructions(freshness: "fresh" | "stale") {
  return `You are WAVE AI's staff-only request editor. Produce an advisory screening preview, never an approval, prioritisation, disposition, delivery decision, GitHub record, or implementation instruction.
Use only supplied request wording and compact allowlisted context. Do not restate the request verbatim. Do not mention data sources, attachments, people, URLs, repository internals, or hidden identifiers.
${freshness === "fresh"
  ? "Fresh strategy context is available. You may suggest a Goal, Milestone, Product Change overlaps, and a cautious technical-impact note only when directly supported by the supplied context."
  : "Strategy context is stale. Ask clarifying questions and frame the problem only. Set suggestedGoalId and suggestedMilestoneId to null, overlappingProductChangeNumbers to [], and technicalImpact to null."}
If uncertain, say so in unknowns and lower confidence. Return only the requested structured output.`
}

export function validatePdrScreeningDraft(draft: unknown, current: Extract<CurrentGovernanceProjection, { state: "available" }>, freshness: "fresh" | "stale"): PdrScreeningDraft {
  const parsed = pdrScreeningDraftSchema.safeParse(draft)
  if (!parsed.success) throw new PdrScreeningOutputError("schema_mismatch")
  const value = parsed.data
  if (Boolean(value.suggestedGoalId) !== Boolean(value.suggestedMilestoneId)) throw new PdrScreeningOutputError("goal_milestone_pair")
  if (freshness === "stale") {
    if (value.suggestedGoalId || value.suggestedMilestoneId || value.overlappingProductChangeNumbers.length || value.technicalImpact) throw new PdrScreeningOutputError("stale_policy")
    return value
  }
  const goals = new Set(current.projection.registry.goals.map((item) => item.id))
  const milestones = new Map(current.projection.registry.milestones.filter((item) => item.lifecycle === "active").map((item) => [item.id, item.goalId]))
  const productChanges = new Set(current.projection.issues.filter((item) => item.kind === "Product Change").map((item) => item.number))
  if (value.suggestedGoalId && !goals.has(value.suggestedGoalId)) throw new PdrScreeningOutputError("unknown_goal")
  if (value.suggestedMilestoneId && !milestones.has(value.suggestedMilestoneId)) throw new PdrScreeningOutputError("unknown_milestone")
  if (value.suggestedGoalId && value.suggestedMilestoneId && milestones.get(value.suggestedMilestoneId) !== value.suggestedGoalId) throw new PdrScreeningOutputError("goal_milestone_mismatch")
  if (value.overlappingProductChangeNumbers.some((number) => !productChanges.has(number))) throw new PdrScreeningOutputError("invalid_overlap")
  return value
}

export async function generatePdrScreening(input: { request: RequestSource; current: CurrentGovernanceProjection; safetyIdentifier: string; answers?: Array<{ question: string; answer: string }> }): Promise<{ draft: PdrScreeningDraft; context: PdrScreeningContext; usage: ResponseUsage | undefined }> {
  if (input.current.state !== "available") throw new Error("Governance context is unavailable")
  const freshness = isGovernanceProjectionStale(input.current.projection.snapshotAt) ? "stale" : "fresh"
  const context: PdrScreeningContext = { snapshotId: input.current.snapshotId, digest: input.current.digest, registryRevision: input.current.projection.registryRevision, snapshotAt: input.current.projection.snapshotAt, freshness }
  const client = getWaveAiOpenAiClient()
  const modelInput = freshness === "fresh"
    ? { request: { title: cap(input.request.title, 140), originalWording: cap(input.request.originalText, 4000), clarificationAnswers: input.answers ?? [] }, context: allowedContext(input.current) }
    : { request: { title: cap(input.request.title, 140), originalWording: cap(input.request.originalText, 4000), clarificationAnswers: input.answers ?? [] }, context: { mode: "stale" } }
  if (Buffer.byteLength(JSON.stringify(modelInput), "utf8") > MAX_CONTEXT_BYTES) throw new Error("The governance context is too large to screen safely.")
  let response
  try {
    response = await client.responses.parse({
      model: WAVE_AI_MODEL, reasoning: { effort: WAVE_AI_REASONING_EFFORT, context: "current_turn" },
      store: false, parallel_tool_calls: false, max_output_tokens: PDR_SCREENING_MAX_OUTPUT_TOKENS,
      safety_identifier: input.safetyIdentifier.slice(0, 64),
      instructions: screeningInstructions(freshness),
      input: JSON.stringify(modelInput),
      text: { format: zodTextFormat(pdrScreeningDraftSchema, "pdr_screening_preview"), verbosity: "low" },
    })
  } catch (cause) {
    if (cause instanceof SyntaxError) throw new PdrScreeningOutputError("provider_parse_failure")
    throw cause
  }
  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason
    throw new PdrScreeningOutputError(reason === "max_output_tokens" ? "provider_incomplete_max_output_tokens" : reason === "content_filter" ? "provider_incomplete_content_filter" : "provider_incomplete_unknown")
  }
  if (response.status && response.status !== "completed") throw new PdrScreeningOutputError("provider_failed")
  if (!response.output_parsed) throw new PdrScreeningOutputError("provider_unparsed")
  const draft = validatePdrScreeningDraft(response.output_parsed, input.current, freshness)
  return { draft, context, usage: response.usage }
}

export { PDR_SCREENING_OUTPUT_SCHEMA_VERSION, PDR_SCREENING_PROMPT_VERSION }
