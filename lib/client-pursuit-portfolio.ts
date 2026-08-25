import type {
  OpportunityMatchStatus,
  OpportunityPursuitStage,
  OpportunityStatus,
} from "@/lib/types/opportunity"

export type ClientPortfolioRepreneurRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  lifecycle_status: string
  updated_at: string | null
  repreneur_offers?: Array<{
    status: string
    offer?: { name?: string | null } | Array<{ name?: string | null }> | null
  }> | null
}

export type ClientPortfolioMatchRow = {
  id: string
  repreneur_id: string
  status: OpportunityMatchStatus
  pursuit_stage: OpportunityPursuitStage | null
  created_at: string
  updated_at: string
  interest_expressed_at: string | null
  reviewed_at: string | null
  pursuit_stage_updated_at: string | null
  opportunity:
    | {
        id: string
        reference: string
        public_title: string | null
        status: OpportunityStatus
        is_demo: boolean
      }
    | Array<{
        id: string
        reference: string
        public_title: string | null
        status: OpportunityStatus
        is_demo: boolean
      }>
    | null
}

export type ClientPortfolioActivityRow = {
  repreneur_id: string | null
  created_at: string
}

export type ClientPursuitPortfolioItem = {
  id: string
  href: string
  reference: string
  title: string
  stageLabel: string
  waitingSince: string
  nextActor: "Staff" | "Repreneur"
}

export type ClientPursuitPortfolioRow = {
  repreneurId: string
  repreneurName: string
  repreneurEmail: string
  href: string
  serviceScope: string[]
  proposedCount: number
  interestedCount: number
  activeCount: number
  openPursuitCount: number
  pursuits: ClientPursuitPortfolioItem[]
  oldestAction: ClientPursuitPortfolioItem | null
  lastVerifiedAt: string | null
  exceptions: string[]
}

const stageLabels: Record<OpportunityPursuitStage, string> = {
  interest: "Active pursuit",
  info_memo_received: "Info memo received",
  intermediary_meeting: "Intermediary meeting",
  seller_meeting: "Seller meeting",
  loi: "LOI",
  closed: "Closed",
  dropped: "Dropped",
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function stageLabel(match: ClientPortfolioMatchRow) {
  if (match.status === "proposed") return "Awaiting response"
  if (match.status === "interested") return "Interest received"
  return match.pursuit_stage ? stageLabels[match.pursuit_stage] : "Active pursuit"
}

function waitingSince(match: ClientPortfolioMatchRow) {
  if (match.status === "proposed") return match.created_at
  if (match.status === "interested") {
    return match.interest_expressed_at ?? match.created_at
  }
  return match.pursuit_stage_updated_at
    ?? match.reviewed_at
    ?? match.interest_expressed_at
    ?? match.created_at
}

function later(left: string | null, right: string | null) {
  if (!left) return right
  if (!right) return left
  return Date.parse(right) > Date.parse(left) ? right : left
}

function offerName(
  offer: ClientPortfolioRepreneurRow["repreneur_offers"] extends Array<infer T> | null | undefined
    ? T
    : never,
) {
  return one(offer.offer)?.name?.trim() || null
}

export function projectClientPursuitPortfolio(input: {
  repreneurs: ClientPortfolioRepreneurRow[]
  matches: ClientPortfolioMatchRow[]
  activities: ClientPortfolioActivityRow[]
}): ClientPursuitPortfolioRow[] {
  const matchesByRepreneur = new Map<string, ClientPortfolioMatchRow[]>()
  for (const match of input.matches) {
    const opportunity = one(match.opportunity)
    if (!opportunity || opportunity.is_demo) continue
    const current = matchesByRepreneur.get(match.repreneur_id) ?? []
    current.push(match)
    matchesByRepreneur.set(match.repreneur_id, current)
  }

  const lastActivityByRepreneur = new Map<string, string>()
  for (const activity of input.activities) {
    if (!activity.repreneur_id) continue
    lastActivityByRepreneur.set(
      activity.repreneur_id,
      later(lastActivityByRepreneur.get(activity.repreneur_id) ?? null, activity.created_at)!,
    )
  }

  return input.repreneurs
    .filter((repreneur) => repreneur.lifecycle_status === "client")
    .map((repreneur) => {
      const serviceScope = [...new Set(
        (repreneur.repreneur_offers ?? [])
          .filter((offer) => offer.status === "accepted")
          .map(offerName)
          .filter((name): name is string => Boolean(name)),
      )]
      const matches = matchesByRepreneur.get(repreneur.id) ?? []
      const pursuits = matches
        .map((match): ClientPursuitPortfolioItem | null => {
          const opportunity = one(match.opportunity)
          if (!opportunity) return null
          return {
            id: match.id,
            href: `/opportunities/${opportunity.id}`,
            reference: opportunity.reference,
            title: opportunity.public_title || opportunity.reference,
            stageLabel: stageLabel(match),
            waitingSince: waitingSince(match),
            nextActor: match.status === "proposed" ? "Repreneur" : "Staff",
          }
        })
        .filter((item): item is ClientPursuitPortfolioItem => Boolean(item))
        .sort((left, right) => Date.parse(left.waitingSince) - Date.parse(right.waitingSince))

      let lastVerifiedAt = lastActivityByRepreneur.get(repreneur.id) ?? null
      for (const pursuit of pursuits) {
        lastVerifiedAt = later(lastVerifiedAt, pursuit.waitingSince)
      }
      const exceptions: string[] = []
      if (!serviceScope.length) exceptions.push("Service scope missing")
      if (!pursuits.length) exceptions.push("No open pursuit")
      if (!lastVerifiedAt) exceptions.push("No verified activity")
      const name = [repreneur.first_name, repreneur.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ")
      if (!name) exceptions.push("Client name missing")

      return {
        repreneurId: repreneur.id,
        repreneurName: name || "Unnamed client",
        repreneurEmail: repreneur.email?.trim() || "",
        href: `/repreneurs/${repreneur.id}`,
        serviceScope,
        proposedCount: matches.filter((match) => match.status === "proposed").length,
        interestedCount: matches.filter((match) => match.status === "interested").length,
        activeCount: matches.filter((match) => match.status === "active_pursuit").length,
        openPursuitCount: pursuits.length,
        pursuits,
        oldestAction: pursuits[0] ?? null,
        lastVerifiedAt,
        exceptions,
      }
    })
    .sort((left, right) => {
      if (left.oldestAction && right.oldestAction) {
        return Date.parse(left.oldestAction.waitingSince) - Date.parse(right.oldestAction.waitingSince)
      }
      if (left.oldestAction) return -1
      if (right.oldestAction) return 1
      return left.repreneurName.localeCompare(right.repreneurName)
    })
}
