import type { EmailTemplateKey } from "@/lib/types/email"

export type MaWorkflowTemplateKey = Extract<
  EmailTemplateKey,
  | "ma_opportunity_validity_check"
  | "ma_request_more_information"
  | "ma_repreneur_interest_feedback"
  | "ma_nda_info_memo_request"
  | "ma_process_follow_up"
>

const INFO_MEMO_REMINDER_BUSINESS_DAYS = 5
const OPPORTUNITY_FRESHNESS_DAYS = 90
const OPPORTUNITY_MONTHLY_RECHECK_DAYS = 30

interface OpportunityContext {
  status: string
  date_added: string | null
  created_at: string
  updated_at: string
}

interface MatchContext {
  pursuit_stage: string | null
  pursuit_stage_updated_at: string | null
  updated_at: string
}

interface InteractionContext {
  template_key: string
  status: string
  sent_at?: string | null
  created_at: string
}

export interface MaWorkflowRecommendation {
  title: string
  message: string
  templateKey: MaWorkflowTemplateKey
}

function localDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function businessDaysSince(value: string | null | undefined, now = new Date()) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const start = localDateOnly(date)
  const end = localDateOnly(now)
  if (start >= end) return 0

  let count = 0
  const cursor = new Date(start)
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1)
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count += 1
  }

  return count
}

export function calendarDaysSince(value: string | null | undefined, now = new Date()) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const start = localDateOnly(date)
  const end = localDateOnly(now)
  if (start >= end) return 0
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function latestSentInteraction(interactions: InteractionContext[], templateKey: MaWorkflowTemplateKey) {
  return interactions.find((interaction) => interaction.template_key === templateKey && interaction.status === "sent")
}

function interactionDate(interaction: InteractionContext | null | undefined) {
  return interaction?.sent_at ?? interaction?.created_at ?? null
}

function deriveNdaInfoMemoReminder(
  activeMatch: MatchContext | null,
  interactions: InteractionContext[],
  memoAvailable: boolean,
  now: Date,
): MaWorkflowRecommendation | null {
  if (!activeMatch || memoAvailable) return null
  if (activeMatch.pursuit_stage && !["interest", "info_memo_received"].includes(activeMatch.pursuit_stage)) return null

  const ndaRequest = latestSentInteraction(interactions, "ma_nda_info_memo_request")
  const referenceDate = interactionDate(ndaRequest) ?? activeMatch.pursuit_stage_updated_at ?? activeMatch.updated_at
  const stalledBusinessDays = businessDaysSince(referenceDate, now)
  if (stalledBusinessDays === null || stalledBusinessDays < INFO_MEMO_REMINDER_BUSINESS_DAYS) return null

  if (ndaRequest) {
    return {
      title: "5-business-day NDA/info memo follow-up due",
      message: `The NDA/info memo request was sent ${stalledBusinessDays} business days ago and no approved info-memo file is available yet.`,
      templateKey: "ma_process_follow_up",
    }
  }

  return {
    title: "5-business-day NDA/info memo request due",
    message: `This pursuit has been active for ${stalledBusinessDays} business days without a logged NDA/info memo request.`,
    templateKey: "ma_nda_info_memo_request",
  }
}

function deriveOpportunityFreshnessReminder(
  opportunity: OpportunityContext,
  interactions: InteractionContext[],
  now: Date,
): MaWorkflowRecommendation | null {
  if (!["active", "paused"].includes(opportunity.status)) return null

  const lastValidityCheck = latestSentInteraction(interactions, "ma_opportunity_validity_check")
  const lastValidityCheckDate = interactionDate(lastValidityCheck)
  const ageReferenceDate = opportunity.date_added ?? opportunity.created_at ?? opportunity.updated_at

  if (!lastValidityCheckDate) {
    const ageDays = calendarDaysSince(ageReferenceDate, now)
    if (ageDays === null || ageDays < OPPORTUNITY_FRESHNESS_DAYS) return null
    return {
      title: "3-month opportunity freshness check due",
      message: `This opportunity has been open for ${ageDays} days without a logged source validity check. Ask the M&A source whether the deal is still open and what the current seller timeline is.`,
      templateKey: "ma_opportunity_validity_check",
    }
  }

  const daysSinceCheck = calendarDaysSince(lastValidityCheckDate, now)
  if (daysSinceCheck === null || daysSinceCheck < OPPORTUNITY_MONTHLY_RECHECK_DAYS) return null

  return {
    title: "Monthly M&A source re-check due",
    message: `The last source validity check was sent ${daysSinceCheck} days ago. If the deal was confirmed open, send the monthly re-check before keeping it active in the pipeline.`,
    templateKey: "ma_opportunity_validity_check",
  }
}

export function deriveMaWorkflowRecommendation({
  opportunity,
  activeMatch,
  interactions,
  memoAvailable = false,
  now = new Date(),
}: {
  opportunity: OpportunityContext
  activeMatch: MatchContext | null
  interactions: InteractionContext[]
  memoAvailable?: boolean
  now?: Date
}): MaWorkflowRecommendation | null {
  const ndaInfoMemoReminder = deriveNdaInfoMemoReminder(activeMatch, interactions, memoAvailable, now)
  if (ndaInfoMemoReminder) return ndaInfoMemoReminder
  if (activeMatch && !memoAvailable) {
    return {
      title: "NDA/info memo request available",
      message: "The next expected M&A action is to request the firm's NDA and info memo using their process.",
      templateKey: "ma_nda_info_memo_request",
    }
  }
  return deriveOpportunityFreshnessReminder(opportunity, interactions, now)
}
