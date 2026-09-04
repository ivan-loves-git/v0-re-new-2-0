import { z } from "zod"

/** v3 adds bounded, bug-specific clarification without changing intake authority. */
export const PDR_SCREENING_PROMPT_VERSION = "pdr-screening-v3" as const
export const PDR_SCREENING_OUTPUT_SCHEMA_VERSION = "pdr-screening-v2" as const

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max)

// Questions are the only model-authored text that staff are invited to act on.
// Keep the boundary narrow: reproduction facts can be useful, but secrets,
// raw records and personal/contact information must never be requested here.
const unsafeQuestionPattern = /\b(?:credential|password|passcode|secret|api\s*key|access\s*token|authentication\s*code|auth\s*code|one[\s-]*time\s*code|\botp\b|\bmfa\b|two[\s-]*factor|raw\s+(?:client|customer)\s+(?:data|record)|confidential\s+(?:document|file)|private\s+(?:document|file)|full\s+name|email\s+address|phone\s+number|home\s+address)\b/i

const clarificationQuestion = boundedText(4, 240).superRefine((question, context) => {
  if (unsafeQuestionPattern.test(question)) {
    context.addIssue({ code: "custom", message: "Clarification questions must not request sensitive information." })
  }
})

function questionsForClassification(classification: "product_change" | "bug" | "research" | "operational_question" | "needs_clarification") {
  return classification === "bug"
    ? z.array(clarificationQuestion).max(2)
    : z.array(clarificationQuestion).min(1).max(5)
}

/** Deliberately small: this is advisory editing, not a delivery instruction. */
export const pdrScreeningDraftSchema = z.object({
  classification: z.enum(["product_change", "bug", "research", "operational_question", "needs_clarification"]),
  affectedUsers: boundedText(3, 500),
  desiredOutcome: boundedText(3, 700),
  successSignal: boundedText(3, 500),
  clarificationQuestions: z.array(clarificationQuestion).max(5),
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
}).strict().superRefine((draft, context) => {
  const questions = questionsForClassification(draft.classification).safeParse(draft.clarificationQuestions)
  if (!questions.success) {
    for (const issue of questions.error.issues) context.addIssue({ ...issue, path: ["clarificationQuestions", ...issue.path] })
  }
  if (new Set(draft.clarificationQuestions.map((item) => item.toLocaleLowerCase())).size !== draft.clarificationQuestions.length) {
    context.addIssue({ code: "custom", path: ["clarificationQuestions"], message: "Clarification questions must be unique." })
  }
})

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
