/**
 * Pure on-request classification of already verified GitHub facts.
 * It does not fetch, persist, schedule or distribute a report.
 */
type IssueState = "OPEN" | "CLOSED"
type ProjectStatus = "Unrouted" | "Ready" | "Todo" | "In Progress" | "Review" | "Done" | "Cancelled / Superseded" | null
type ProductChange = {
  number: number
  title: string
  url: string
  state: IssueState
  projectStatus: ProjectStatus
  closedAt: string | null
  endReason: "cancelled" | "superseded" | null
  reopenedAt: string | null
  releaseProof: { productionCommit: string; verifiedAt: string; proofUrl: string } | null
}
type Ticket = { number: number; parentNumber: number; state: IssueState }
type Decision = { number: number; title: string; url: string; state: "Proposed" | "Needs Ivan" | "Decided" | "Superseded" }

export type FounderSummaryInput = {
  reportAt: string
  githubVerifiedAt: string
  audienceAuthorized: boolean
  strategy: { status: "accepted" | "proposed"; revision: string; sourceUrl: string; goalTitles: string[] }
  productChanges: ProductChange[]
  tickets: Ticket[]
  decisions: Decision[]
}

type OutcomeStatus = "released" | "closed_unreleased" | "cancelled" | "superseded" | "ended_unknown" | "reopened" | "partial" | "in_progress"
const governanceIssue = (number: number) => `https://github.com/re-new-team/renew-governance/issues/${number}`
const validDate = (value: string) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
const issueUrl = (number: number, url: string) => url === governanceIssue(number)

export function buildFounderSummary(input: FounderSummaryInput) {
  if (!input.audienceAuthorized) throw new Error("Founder summary audience access is unverified")
  if (input.strategy.status !== "accepted" || !input.strategy.revision || input.strategy.sourceUrl !== "https://github.com/re-new-team/renew-governance/blob/main/strategy/registry.yaml") {
    throw new Error("Founder summary requires the current accepted Strategy Registry")
  }
  if (!validDate(input.reportAt) || !validDate(input.githubVerifiedAt) || Date.parse(input.githubVerifiedAt) > Date.parse(input.reportAt) || Date.parse(input.reportAt) - Date.parse(input.githubVerifiedAt) > 86_400_000) {
    throw new Error("Founder summary requires recently verified GitHub facts")
  }
  const seen = new Set<number>()
  const ticketsByParent = new Map<number, { closed: number; open: number }>()
  const ticketNumbers = new Set<number>()
  for (const ticket of input.tickets) {
    if (ticketNumbers.has(ticket.number)) throw new Error("Duplicate Ticket in founder summary")
    ticketNumbers.add(ticket.number)
    const count = ticketsByParent.get(ticket.parentNumber) ?? { closed: 0, open: 0 }
    count[ticket.state === "CLOSED" ? "closed" : "open"]++
    ticketsByParent.set(ticket.parentNumber, count)
  }
  const outcomes = input.productChanges.map((item) => {
    if (!Number.isSafeInteger(item.number) || item.number <= 0 || seen.has(item.number) || !issueUrl(item.number, item.url)) throw new Error("Invalid or duplicate Product Change")
    seen.add(item.number)
    if (item.closedAt && !validDate(item.closedAt)) throw new Error("Product Change closure date is invalid")
    if (item.reopenedAt && !validDate(item.reopenedAt)) throw new Error("Product Change reopened date is invalid")
    if (item.releaseProof && (!/^[0-9a-f]{40}$/.test(item.releaseProof.productionCommit) || !validDate(item.releaseProof.verifiedAt) || !item.releaseProof.proofUrl.startsWith(`${item.url}#issuecomment-`))) {
      throw new Error("Product Change release proof is invalid")
    }
    const ticketProgress = ticketsByParent.get(item.number) ?? { closed: 0, open: 0 }
    let status: OutcomeStatus
    if (item.endReason) status = item.endReason
    else if (item.projectStatus === "Cancelled / Superseded") status = "ended_unknown"
    else if (item.state === "OPEN" && item.reopenedAt) status = "reopened"
    else if (item.state === "CLOSED" && item.releaseProof) status = "released"
    else if (item.state === "CLOSED") status = "closed_unreleased"
    else if (ticketProgress.closed > 0 && ticketProgress.open > 0) status = "partial"
    else status = "in_progress"
    return {
      number: item.number, title: item.title, url: item.url,
      status, projectStatus: item.projectStatus,
      closedAt: item.closedAt, reopenedAt: item.reopenedAt,
      release: status === "released" ? item.releaseProof : null,
      ticketProgress,
    }
  })
  const decisionsNeeded = input.decisions.filter((item) => {
    if (!issueUrl(item.number, item.url)) throw new Error("Decision reference is invalid")
    return item.state === "Needs Ivan"
  }).map(({ number, title, url }) => ({ number, title, url }))
  return {
    reportAt: input.reportAt,
    githubVerifiedAt: input.githubVerifiedAt,
    strategy: { revision: input.strategy.revision, sourceUrl: input.strategy.sourceUrl, goalTitles: [...input.strategy.goalTitles] },
    outcomes,
    upcoming: outcomes.filter((item) => ["reopened", "partial", "in_progress"].includes(item.status)),
    decisionsNeeded,
    productChangeCount: outcomes.length,
    ticketCount: input.tickets.length,
    kpiActuals: "not assessed from GitHub delivery status" as const,
  }
}
