export const EMAIL_REVIEW_PURPOSES = [
  { key: "source_freshness", label: "Source freshness" },
  { key: "e4_qualification", label: "E4 qualification" },
  { key: "e6_nda_ready", label: "E6 NDA ready" },
  { key: "e7_signed_copies", label: "E7 signed copies" },
  { key: "ma_validity_check", label: "Validity check" },
  { key: "ma_more_information", label: "More information" },
  { key: "ma_interest_feedback", label: "Interest feedback" },
  { key: "ma_nda_memo_request", label: "NDA and memo request" },
  { key: "ma_process_follow_up", label: "Process follow-up" },
  { key: "ma_other", label: "Other M&A email" },
] as const

export type EmailReviewPurpose = (typeof EMAIL_REVIEW_PURPOSES)[number]["key"]
export type EmailReviewView = "active" | "all"
export type EmailReviewSort = "message" | "purpose" | "recipient" | "company" | "prepared"
export type EmailReviewDirection = "asc" | "desc"

export interface EmailReviewQueueRow {
  id: string
  source_kind: "ma" | "e4" | "e6" | "e7" | "freshness"
  template_key: string
  subject: string
  body_preview: string
  recipient_email: string
  namespace: "REAL" | "DEMO"
  state: "pending" | "sending" | "sent" | "failed" | "uncertain" | "cancelled"
  version: number
  created_at: string
  recipient_name: string | null
  recipient_avatar_url: string | null
  company_name: string | null
  purpose_key: EmailReviewPurpose
  purpose_label: string
}

export interface EmailReviewQueueOptions {
  page: number
  view: EmailReviewView
  search: string
  purpose: EmailReviewPurpose | "all"
  sort: EmailReviewSort
  direction: EmailReviewDirection
}

const SORT_COLUMNS: Record<EmailReviewSort, string> = {
  message: "message_sort",
  purpose: "purpose_sort",
  recipient: "recipient_sort",
  company: "company_sort",
  prepared: "created_at",
}

export function emailReviewSortColumn(sort: EmailReviewSort) {
  return SORT_COLUMNS[sort]
}

export function parseEmailReviewQueueOptions(input: Record<string, string | undefined>): EmailReviewQueueOptions {
  const requestedPage = Number(input.reviewPage)
  const sort = (["message", "purpose", "recipient", "company", "prepared"] as const)
    .find((value) => value === input.reviewSort) ?? "prepared"
  const purpose = EMAIL_REVIEW_PURPOSES.find((value) => value.key === input.reviewPurpose)?.key ?? "all"
  return {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1,
    view: input.reviewFilter === "all" ? "all" : "active",
    search: (input.reviewSearch ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    purpose,
    sort,
    direction: input.reviewDirection === "asc" || input.reviewDirection === "desc"
      ? input.reviewDirection : sort === "prepared" ? "desc" : "asc",
  }
}

export function emailReviewSearchPattern(search: string) {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`
}

// Ticket #224's selected-send boundary is pending REAL drafts only. Until then,
// selection is a page-scoped review aid and never dispatches or archives mail.
export function isEmailReviewSelectable(row: EmailReviewQueueRow) {
  return row.state === "pending" && row.namespace === "REAL"
}
