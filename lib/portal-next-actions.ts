import { isRecommendationResponseOpen } from "./opportunity-recommendation-window"
import { EXTERNAL_PURSUIT_STAGES } from "./types/external-pursuit"
import type { OpportunityMatchStatus } from "./types/opportunity"

/** All input fields come from current, owner-safe server readers. */
export type NextActionDealSource = {
  matchId: string
  status: OpportunityMatchStatus
  title: string
  href: string
  responseExpiresAt: string | null
  currentInterestAt: string | null
  interestRejected: boolean
  respondAuthorized: boolean
  pursuit: {
    action: "sign_nda" | "unknown" | null
    signedCopyState: "not_submitted" | "awaiting_validation" | "validated" | "unknown"
    ndaTemplateHref: string | null
    informationMemorandumHref: string | null
  } | null
}

export type NextActionExternalSource = {
  id: string
  title: string
  stage: string
  deletionStatus: string
  nextAction: string | null
  responsibleParty: string | null
  dueAt: string | null
  href: string
}

export type PortalNextActionItem = {
  kind: "respond" | "sign_nda" | "external_owner"
  title: string
  href: string
  explicitText: string | null
  responseExpiresAt: string | null
  dueAt: string | null
}

export type PortalNextWaitingItem = {
  kind: "interest_validation" | "nda_validation" | "external_staff"
  title: string
  href: string
  explicitText: string | null
}

export type PortalNextResourceItem = {
  kind: "nda_template" | "information_memorandum"
  title: string
  href: string
}

export type PortalNextActionsProjection = {
  state: "ready" | "unavailable"
  asOf: string
  yourActions: PortalNextActionItem[]
  waiting: PortalNextWaitingItem[]
  resources: PortalNextResourceItem[]
}

export function unavailablePortalNextActions(asOf = new Date().toISOString()): PortalNextActionsProjection {
  return { state: "unavailable", asOf, yourActions: [], waiting: [], resources: [] }
}

const isOpenExternalStage = (stage: string) => EXTERNAL_PURSUIT_STAGES.includes(stage as typeof EXTERNAL_PURSUIT_STAGES[number])
  && stage !== "completed" && stage !== "dropped_archived"

function byTitle<T extends { title: string; href: string }>(left: T, right: T) {
  return left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) || left.href.localeCompare(right.href)
}

/** Strict current-state derivation. No stage or import history becomes a task. */
export function buildPortalNextActions(input: {
  deals: NextActionDealSource[]
  external: NextActionExternalSource[]
  asOf: string
}): PortalNextActionsProjection {
  const yourActions: PortalNextActionItem[] = []
  const waiting: PortalNextWaitingItem[] = []
  const resources: PortalNextResourceItem[] = []

  for (const deal of input.deals) {
    if (deal.status === "proposed" && deal.respondAuthorized
      && isRecommendationResponseOpen(deal.responseExpiresAt, input.asOf)) {
      yourActions.push({ kind: "respond", title: deal.title, href: deal.href,
        explicitText: null, responseExpiresAt: deal.responseExpiresAt, dueAt: null })
    }
    if (deal.status === "interested" && deal.currentInterestAt && !deal.interestRejected) {
      waiting.push({ kind: "interest_validation", title: deal.title, href: deal.href, explicitText: null })
    }
    if (deal.status !== "active_pursuit" || !deal.pursuit) continue
    if (deal.pursuit.action === "sign_nda" && deal.pursuit.signedCopyState === "not_submitted"
      && deal.pursuit.ndaTemplateHref) {
      yourActions.push({ kind: "sign_nda", title: deal.title, href: deal.href,
        explicitText: null, responseExpiresAt: null, dueAt: null })
      resources.push({ kind: "nda_template", title: deal.title, href: deal.pursuit.ndaTemplateHref })
    }
    if (deal.pursuit.signedCopyState === "awaiting_validation") {
      waiting.push({ kind: "nda_validation", title: deal.title, href: deal.href, explicitText: null })
    }
    if (deal.pursuit.informationMemorandumHref) {
      resources.push({ kind: "information_memorandum", title: deal.title,
        href: deal.pursuit.informationMemorandumHref })
    }
  }

  for (const dossier of input.external) {
    const nextAction = dossier.nextAction?.trim()
    if (dossier.deletionStatus !== "active" || !isOpenExternalStage(dossier.stage)
      || !nextAction || !["owner", "staff"].includes(dossier.responsibleParty ?? "")) continue
    if (dossier.responsibleParty === "owner") {
      yourActions.push({ kind: "external_owner", title: dossier.title, href: dossier.href,
        explicitText: nextAction, responseExpiresAt: null,
        dueAt: /^\d{4}-\d{2}-\d{2}$/.test(dossier.dueAt ?? "") ? dossier.dueAt : null })
    } else {
      waiting.push({ kind: "external_staff", title: dossier.title, href: dossier.href, explicitText: nextAction })
    }
  }

  return { state: "ready", asOf: input.asOf,
    yourActions: yourActions.sort(byTitle), waiting: waiting.sort(byTitle), resources: resources.sort(byTitle) }
}
