import type { EmailTemplateKey } from "@/lib/types/email"
import { freshnessDueBasis } from "@/lib/opportunity-freshness-policy"

export type MaWorkflowTemplateKey = Extract<
  EmailTemplateKey,
  | "ma_opportunity_validity_check"
  | "ma_request_more_information"
  | "ma_repreneur_interest_feedback"
  | "ma_nda_info_memo_request"
  | "ma_process_follow_up"
>

const INFO_MEMO_REMINDER_BUSINESS_DAYS = 5

interface OpportunityContext {
  status: string
  is_demo?: boolean
  date_added: string | null
  date_added_precision?: "day" | "month" | null
  created_at: string
  updated_at: string
}

interface MatchContext {
  pursuit_stage: string | null
  pursuit_stage_provenance?: string | null
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
  if (activeMatch.pursuit_stage_provenance === "staff_confirmed_history") return null
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
  activeMatch: MatchContext | null,
  confirmation: { id: string; at: string } | null,
  now: Date,
): MaWorkflowRecommendation | null {
  const due = freshnessDueBasis({
    status: opportunity.status, isDemo: opportunity.is_demo === true,
    hasActiveRealPursuit: activeMatch !== null,
    dateAdded: opportunity.date_added, dateAddedPrecision: opportunity.date_added_precision,
    confirmation,
  }, now)
  if (!due) return null
  return {
    title: "45-day source freshness review due",
    message: due.basis === "confirmed_open"
      ? `The source last explicitly confirmed this opportunity open ${due.ageDays} calendar days ago. Review the source context and unsent draft; sending alone never resets the clock.`
      : `This opportunity has an older inventory age of at least ${due.ageDays} calendar days with no recorded source confirmation. Preserve its stored date precision and review the unsent draft.`,
    templateKey: "ma_opportunity_validity_check",
  }
}

export function deriveMaWorkflowRecommendation({
  opportunity,
  activeMatch,
  interactions,
  confirmation = null,
  memoAvailable = false,
  now = new Date(),
}: {
  opportunity: OpportunityContext
  activeMatch: MatchContext | null
  interactions: InteractionContext[]
  confirmation?: { id: string; at: string } | null
  memoAvailable?: boolean
  now?: Date
}): MaWorkflowRecommendation | null {
  const ndaInfoMemoReminder = deriveNdaInfoMemoReminder(activeMatch, interactions, memoAvailable, now)
  if (ndaInfoMemoReminder) return ndaInfoMemoReminder
  if (activeMatch && !memoAvailable && activeMatch.pursuit_stage_provenance !== "staff_confirmed_history") {
    return {
      title: "NDA/info memo request available",
      message: "The next expected M&A action is to request the firm's NDA and info memo using their process.",
      templateKey: "ma_nda_info_memo_request",
    }
  }
  return deriveOpportunityFreshnessReminder(opportunity, activeMatch, confirmation, now)
}
