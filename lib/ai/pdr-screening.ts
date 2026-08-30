import "server-only"

import { zodTextFormat } from "openai/helpers/zod"
import type { ResponseUsage } from "openai/resources/responses/responses"
import { isGovernanceProjectionStale } from "@/lib/governance-projection/freshness"
import type { CurrentGovernanceProjection } from "@/lib/governance-projection/server"
import { WAVE_AI_MODEL, WAVE_AI_REASONING_EFFORT } from "@/lib/ai/config"
import { getWaveAiOpenAiClient } from "@/lib/ai/openai-client"
import { PDR_CAPABILITY_CATALOGUE, PDR_CAPABILITY_CATALOGUE_VERSION } from "@/lib/ai/pdr-capability-catalogue"
import { PDR_SCREENING_OUTPUT_SCHEMA_VERSION, PDR_SCREENING_PROMPT_VERSION, pdrScreeningDraftSchema, type PdrScreeningContext, type PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"

type RequestSource = { id: string; title: string; originalText: string }

function allowedContext(current: Extract<CurrentGovernanceProjection, { state: "available" }>) {
  const { projection } = current
  return {
    registryRevision: projection.registryRevision,
    goals: projection.registry.goals.map(({ id, title, statement }) => ({ id, title, statement })),
    milestones: projection.registry.milestones.filter((item) => item.lifecycle === "active").map(({ id, goalId, title, outcome }) => ({ id, goalId, title, outcome })),
    guardrails: projection.registry.guardrails.filter((item) => item.lifecycle === "active").map(({ id, title, rule }) => ({ id, title, rule })),
    productChanges: projection.issues.filter((item) => item.kind === "Product Change").map((item) => ({
      number: item.number, title: item.title, status: item.projectStatus,
      goalId: item.placement.goalId, milestoneId: item.placement.milestoneId,
      provenance: item.provenance?.state ?? "unverified",
    })),
    capabilityCatalogue: { version: PDR_CAPABILITY_CATALOGUE_VERSION, entries: PDR_CAPABILITY_CATALOGUE },
  }
}

function screeningInstructions(freshness: "fresh" | "stale") {
  return `You are WAVE AI's staff-only request editor. Produce an advisory screening preview, never an approval, prioritisation, disposition, delivery decision, GitHub record, or implementation instruction.
Preserve the request wording verbatim in preservedOriginalWording. Use only supplied request wording and compact allowlisted context. Do not mention data sources, attachments, people, URLs, repository internals, or hidden identifiers.
${freshness === "fresh"
  ? "Fresh strategy context is available. You may suggest a Goal, Milestone, Product Change overlaps, and a cautious technical-impact note only when directly supported by the supplied context."
  : "Strategy context is stale. Ask clarifying questions and frame the problem only. Set suggestedGoalId and suggestedMilestoneId to null, overlappingProductChangeNumbers to [], and technicalImpact to null."}
If uncertain, say so in unknowns and lower confidence. Return only the requested structured output.`
}

export function validatePdrScreeningDraft(draft: unknown, current: Extract<CurrentGovernanceProjection, { state: "available" }>, originalText: string, freshness: "fresh" | "stale"): PdrScreeningDraft {
  const parsed = pdrScreeningDraftSchema.safeParse(draft)
  if (!parsed.success || parsed.data.preservedOriginalWording !== originalText) throw new SyntaxError("Invalid PDR screening output")
  const value = parsed.data
  if (freshness === "stale") {
    if (value.suggestedGoalId || value.suggestedMilestoneId || value.overlappingProductChangeNumbers.length || value.technicalImpact) throw new SyntaxError("Stale screening exceeded advisory limits")
    return value
  }
  const goals = new Set(current.projection.registry.goals.map((item) => item.id))
  const milestones = new Map(current.projection.registry.milestones.filter((item) => item.lifecycle === "active").map((item) => [item.id, item.goalId]))
  const productChanges = new Set(current.projection.issues.filter((item) => item.kind === "Product Change").map((item) => item.number))
  if (value.suggestedGoalId && !goals.has(value.suggestedGoalId)) throw new SyntaxError("Unknown Goal")
  if (value.suggestedMilestoneId && !milestones.has(value.suggestedMilestoneId)) throw new SyntaxError("Unknown Milestone")
  if (value.suggestedGoalId && value.suggestedMilestoneId && milestones.get(value.suggestedMilestoneId) !== value.suggestedGoalId) throw new SyntaxError("Goal and Milestone do not match")
  if (value.overlappingProductChangeNumbers.some((number) => !productChanges.has(number))) throw new SyntaxError("Overlap must be a Product Change")
  return value
}

export async function generatePdrScreening(input: { request: RequestSource; current: CurrentGovernanceProjection; safetyIdentifier: string }): Promise<{ draft: PdrScreeningDraft; context: PdrScreeningContext; usage: ResponseUsage | undefined }> {
  if (input.current.state !== "available") throw new Error("Governance context is unavailable")
  const freshness = isGovernanceProjectionStale(input.current.projection.snapshotAt) ? "stale" : "fresh"
  const context: PdrScreeningContext = { snapshotId: input.current.snapshotId, digest: input.current.digest, registryRevision: input.current.projection.registryRevision, snapshotAt: input.current.projection.snapshotAt, freshness }
  const client = getWaveAiOpenAiClient()
  const response = await client.responses.parse({
    model: WAVE_AI_MODEL, reasoning: { effort: WAVE_AI_REASONING_EFFORT, context: "current_turn" },
    store: false, parallel_tool_calls: false, max_output_tokens: 2_400,
    safety_identifier: input.safetyIdentifier.slice(0, 64),
    instructions: screeningInstructions(freshness),
    input: JSON.stringify({ request: { title: input.request.title, originalWording: input.request.originalText }, context: allowedContext(input.current) }),
    text: { format: zodTextFormat(pdrScreeningDraftSchema, "pdr_screening_preview"), verbosity: "low" },
  })
  const draft = validatePdrScreeningDraft(response.output_parsed, input.current, input.request.originalText, freshness)
  return { draft, context, usage: response.usage }
}

export { PDR_SCREENING_OUTPUT_SCHEMA_VERSION, PDR_SCREENING_PROMPT_VERSION }
