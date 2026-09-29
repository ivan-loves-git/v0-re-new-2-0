import type { OpportunityMatchStatus, OpportunityPursuitStage, OpportunityStatus } from "@/lib/types/opportunity"

/** Staff presentation v1.0, Decision #166. These are not persisted workflow states. */
export const RENEW_BOARD_COLUMNS = [
  { value: "matching", label: "Matching" },
  { value: "proposed", label: "Proposed" },
  { value: "interest_received", label: "Interest to validate" },
  { value: "active_pursuit", label: "Active pursuit" },
  { value: "loi", label: "LOI" },
] as const

export const RENEW_BOARD_STAGES = [
  { value: "matching", label: "Matching" },
  { value: "proposed", label: "Proposed" },
  { value: "interest_received", label: "Interest received" },
  { value: "active_pursuit", label: "Active pursuit" },
  { value: "nda_signed", label: "NDA signed" },
  { value: "info_memo_received", label: "Info memo received" },
  { value: "qa_with_ma_firm", label: "Q&A with M&A firm" },
  { value: "intermediary_meeting", label: "Intermediary meeting" },
  { value: "seller_meeting", label: "Seller meeting" },
  { value: "loi", label: "LOI" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
  { value: "declined", label: "Declined" },
  { value: "unknown", label: "Stage unavailable" },
] as const

export const RENEW_BOARD_VIEWS = [
  { value: "active", label: "Active board" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped / declined" },
  { value: "inactive", label: "Inactive opportunities" },
] as const

export const RENEW_BOARD_SORTS = [
  { value: "stage", label: "Stage progression" },
  { value: "repreneur", label: "Repreneur A–Z" },
  { value: "opportunity", label: "Opportunity A–Z" },
] as const

export type ReNewBoardSort = typeof RENEW_BOARD_SORTS[number]["value"]

export type ReNewBoardStage = typeof RENEW_BOARD_STAGES[number]["value"]
export type ReNewBoardColumn = typeof RENEW_BOARD_COLUMNS[number]["value"]
export type ReNewBoardView = typeof RENEW_BOARD_VIEWS[number]["value"]

export interface ReNewStaffBoardRecord {
  id: string
  title: string
  ownerName: string | null
  href: string
  stage: ReNewBoardStage
  column: ReNewBoardColumn | null
  view: ReNewBoardView
  context: string | null
  stageProvenance: "staff_confirmed_history" | null
}

const ACTIVE_STAGE: Record<OpportunityPursuitStage, ReNewBoardStage> = {
  interest: "active_pursuit",
  nda_signed: "nda_signed",
  info_memo_received: "info_memo_received",
  qa_with_ma_firm: "qa_with_ma_firm",
  intermediary_meeting: "intermediary_meeting",
  seller_meeting: "seller_meeting",
  loi: "loi",
  closed: "completed",
  dropped: "dropped",
}

function currentStage(status: OpportunityMatchStatus, stage: OpportunityPursuitStage | null): ReNewBoardStage {
  switch (status) {
    case "draft":
    case "shortlisted": return "matching"
    case "proposed": return "proposed"
    case "interested": return "interest_received"
    case "declined": return "declined"
    case "dropped": return "dropped"
    case "completed": return "completed"
    case "active_pursuit": return stage === null ? "active_pursuit" : ACTIVE_STAGE[stage] ?? "unknown"
    default: return "unknown"
  }
}

export function getReNewBoardStageLabel(stage: ReNewBoardStage): string {
  return RENEW_BOARD_STAGES.find((option) => option.value === stage)?.label ?? "Stage unavailable"
}

export function projectStaffReNewPursuit(input: {
  opportunityStatus: OpportunityStatus
  matchStatus: OpportunityMatchStatus
  pursuitStage: OpportunityPursuitStage | null
}): Pick<ReNewStaffBoardRecord, "stage" | "column" | "view" | "context"> {
  const stage = currentStage(input.matchStatus, input.pursuitStage)
  const inactiveContexts: Partial<Record<OpportunityStatus, string>> = {
    draft: "Opportunity draft",
    paused: "Opportunity paused",
    archived: "Opportunity archived",
  }
  const inactiveContext = inactiveContexts[input.opportunityStatus]
  if (inactiveContext) return { stage, column: null, view: "inactive", context: inactiveContext }
  // Only this match's actual outcome can establish completion or dropping.
  if (stage === "completed") return { stage, column: null, view: "completed", context: null }
  if (stage === "dropped" || stage === "declined") return { stage, column: null, view: "dropped", context: null }
  if (input.opportunityStatus === "closed") {
    return { stage, column: null, view: "inactive", context: "Opportunity closed · pursuit not completed" }
  }
  if (stage === "unknown") return { stage, column: null, view: "inactive", context: "Stage needs review" }
  const column = stage === "matching" || stage === "proposed" || stage === "interest_received" || stage === "loi"
    ? stage : "active_pursuit"
  return { stage, column, view: "active", context: null }
}

export function filterStaffReNewPursuits(records: ReNewStaffBoardRecord[], filters: {
  view: ReNewBoardView
  stage: ReNewBoardStage | "all"
  query: string
}): ReNewStaffBoardRecord[] {
  const needle = filters.query.trim().toLocaleLowerCase()
  return records.filter((record) => record.view === filters.view
    && (filters.stage === "all" || record.stage === filters.stage)
    && (!needle || [record.title, record.ownerName ?? ""].some((value) => value.toLocaleLowerCase().includes(needle))))
}

const boardNameCollator = new Intl.Collator("fr", { sensitivity: "base", numeric: true })
const stageRanks = new Map<ReNewBoardStage, number>(RENEW_BOARD_STAGES.map((stage, index) => [stage.value, index]))

function compareBoardNames(left: string | null, right: string | null): number {
  const a = left?.trim() ?? ""
  const b = right?.trim() ?? ""
  if (!a || !b) return a ? -1 : b ? 1 : 0
  return boardNameCollator.compare(a, b)
}

/** Sort presentation only; callers retain the existing column/view grouping. */
export function sortStaffReNewPursuits(records: ReNewStaffBoardRecord[], sort: ReNewBoardSort): ReNewStaffBoardRecord[] {
  return [...records].sort((a, b) => {
    const stage = (stageRanks.get(a.stage) ?? RENEW_BOARD_STAGES.length) - (stageRanks.get(b.stage) ?? RENEW_BOARD_STAGES.length)
    const owner = compareBoardNames(a.ownerName, b.ownerName)
    const title = compareBoardNames(a.title, b.title)
    const order = sort === "stage" ? stage || owner || title
      : sort === "repreneur" ? owner || title || stage
      : title || owner || stage
    return order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}
