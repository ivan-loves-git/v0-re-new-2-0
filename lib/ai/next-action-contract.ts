import { z } from "zod"

export const waveAiNextActionRequestSchema = z.object({ opportunityId: z.string().uuid() }).strict()
export const waveAiNextActionKeys = [
  "resolve_source_review",
  "complete_opportunity_profile",
] as const
export const waveAiNextActionSchema = z.object({
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  actionId: z.enum(waveAiNextActionKeys),
  rationale: z.string().trim().min(1).max(280),
  confidence: z.enum(["low", "medium", "high"]),
  factRefs: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
  unknowns: z.array(z.string().trim().min(1).max(160)).max(4),
}).strict()
export const waveAiNextActionResponseSchema = z.object({
  recommendations: z.array(waveAiNextActionSchema).max(3),
}).strict().superRefine((value, ctx) => {
  const actions = new Set<string>()
  value.recommendations.forEach((recommendation, index) => {
    if (recommendation.rank !== index + 1) ctx.addIssue({ code: "custom", path: ["recommendations", index, "rank"], message: "Ranks must be contiguous and ordered." })
    if (actions.has(recommendation.actionId)) ctx.addIssue({ code: "custom", path: ["recommendations", index, "actionId"], message: "Actions must be unique." })
    actions.add(recommendation.actionId)
  })
})

export type WaveAiNextAction = z.infer<typeof waveAiNextActionSchema>
