import { z } from "zod"

export const PDR_SCREENING_PROMPT_VERSION = "pdr-screening-v2" as const
export const PDR_SCREENING_OUTPUT_SCHEMA_VERSION = "pdr-screening-v1" as const

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max)

/** Deliberately small: this is advisory editing, not a delivery instruction. */
export const pdrScreeningDraftSchema = z.object({
  classification: z.enum(["product_change", "bug", "research", "operational_question", "needs_clarification"]),
  affectedUsers: boundedText(3, 500),
  desiredOutcome: boundedText(3, 700),
  successSignal: boundedText(3, 500),
  clarificationQuestions: z.array(boundedText(4, 240)).min(1).max(5)
    .superRefine((items, context) => {
      if (new Set(items.map((item) => item.toLocaleLowerCase())).size !== items.length) {
        context.addIssue({ code: "custom", message: "Clarification questions must be unique." })
      }
    }),
  problemFraming: boundedText(20, 1_200),
  constraintsAndNonGoals: z.array(boundedText(3, 400)).max(8),
  successCriteria: z.array(boundedText(3, 400)).min(1).max(8),
  confidence: z.enum(["low", "medium", "high"]),
  unknowns: z.array(boundedText(3, 400)).max(8),
  suggestedGoalId: z.string().regex(/^G-\d{3}$/).nullable(),
  suggestedMilestoneId: z.string().regex(/^M-\d{3}$/).nullable(),
  overlappingProductChangeNumbers: z.array(z.number().int().positive()).max(8)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) context.addIssue({ code: "custom", message: "Overlap Product Changes must be unique." })
    }),
  technicalImpact: boundedText(3, 800).nullable(),
}).strict()

export type PdrScreeningDraft = z.infer<typeof pdrScreeningDraftSchema>

export type PdrScreeningContext = {
  snapshotId: string
  digest: string
  registryRevision: string
  snapshotAt: string
  freshness: "fresh" | "stale"
}

export const pdrScreeningSaveSchema = z.object({
  requestId: z.string().uuid(),
  previewToken: z.string().min(40).max(16_000),
  draft: pdrScreeningDraftSchema,
}).strict()

export const pdrScreeningAnswersSchema = z.array(z.object({
  question: boundedText(4, 240),
  answer: boundedText(1, 600),
}).strict()).min(1).max(5)
