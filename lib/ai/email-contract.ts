import { z } from "zod"

export const waveAiLanguages = ["fr", "en"] as const

export const waveAiEmailDraftRequestSchema = z.object({
  repreneurId: z.string().uuid(),
  templateId: z.string().trim().min(1).max(120),
  language: z.enum(waveAiLanguages).default("fr"),
  customInstructions: z.string().trim().max(1200).optional(),
}).strict()

export const waveAiEmailDraftSchema = z.object({
  subject: z.string().trim().min(5).max(180),
  body: z.string().trim().min(40).max(6000),
  assumptions: z.array(z.string().trim().min(1).max(240)).max(5),
  warnings: z.array(z.string().trim().min(1).max(240)).max(5),
}).strict()

export const waveAiGenerationEventSchema = z.object({
  generationId: z.string().uuid(),
  eventType: z.enum([
    "rendered",
    "edit_started",
    "copied",
    "send_review_opened",
    "send_succeeded",
    "send_failed",
    "workflow_action_confirmed",
    "feedback_helpful",
    "feedback_not_helpful",
    "discarded",
  ]),
  reasonCode: z.enum([
    "wrong_fact",
    "not_relevant",
    "poor_wording",
    "missing_context",
    "other_without_text",
  ]).optional(),
  actionKey: z.string().trim().max(80).optional(),
}).strict().superRefine((event, context) => {
  if (event.eventType === "feedback_not_helpful" && !event.reasonCode) {
    context.addIssue({
      code: "custom",
      message: "Negative feedback requires an allowlisted reason.",
      path: ["reasonCode"],
    })
  }
  if (event.eventType !== "feedback_not_helpful" && event.reasonCode) {
    context.addIssue({
      code: "custom",
      message: "A feedback reason is only valid for negative feedback.",
      path: ["reasonCode"],
    })
  }
})

export type WaveAiEmailDraftRequest = z.infer<typeof waveAiEmailDraftRequestSchema>
export type WaveAiEmailDraft = z.infer<typeof waveAiEmailDraftSchema>
export type WaveAiGenerationEvent = z.infer<typeof waveAiGenerationEventSchema>

export interface WaveAiEmailDraftResponse extends WaveAiEmailDraft {
  generationId: string
  traceId: string
  model: "gpt-5.6-luna"
}
