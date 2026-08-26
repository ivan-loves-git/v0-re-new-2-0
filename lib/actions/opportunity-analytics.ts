"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  OPPORTUNITY_PURSUIT_STAGE_OPTIONS,
  type OpportunityMatchStatus,
  type OpportunityPursuitStage,
} from "@/lib/types/opportunity"

const INTRODUCTION_STATUSES: OpportunityMatchStatus[] = [
  "proposed",
  "interested",
  "declined",
  "active_pursuit",
]
const INTERMEDIARY_SOURCE_TYPES = new Set(["ma_firm", "broker"])

export interface OpportunityKpiStageRow {
  stage: OpportunityPursuitStage
  label: string
  count: number
}

export interface OpportunityKpiFunnelRow {
  label: string
  numerator: number
  denominator: number
  percent: number
}

export interface OpportunityKpiData {
  activeIntermediaries: number
  activeOpportunities: number
  totalOpenOpportunities: number
  introductions: number
  activePursuits: number
  sellerMeetings: number
  lois: number
  droppedDeals: number
  closedDeals: number
  pendingReviews: number
  ndaBlockedPursuits: number
  approvedDocuments: number
  stageRows: OpportunityKpiStageRow[]
  funnelRows: OpportunityKpiFunnelRow[]
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 100)
}

function sourceType(row: {
  source?:
    | { source_type?: string | null }
    | { source_type?: string | null }[]
    | null
}) {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  return source?.source_type ?? null
}

function canonicalFirmId(row: {
  source_office?:
    | { firm?: { id?: string | null } | { id?: string | null }[] | null }
    | Array<{ firm?: { id?: string | null } | { id?: string | null }[] | null }>
    | null
}) {
  const office = Array.isArray(row.source_office)
    ? row.source_office[0]
    : row.source_office
  const firm = Array.isArray(office?.firm) ? office.firm[0] : office?.firm
  return firm?.id ?? null
}

function intermediaryKey(opportunity: {
  source_id?: string | null
  source_label?: string | null
  source?:
    | { source_type?: string | null }
    | { source_type?: string | null }[]
    | null
  source_office?:
    | { firm?: { id?: string | null } | { id?: string | null }[] | null }
    | Array<{ firm?: { id?: string | null } | { id?: string | null }[] | null }>
    | null
}) {
  const firmId = canonicalFirmId(opportunity)
  if (firmId) return `firm:${firmId}`

  const type = sourceType(opportunity)
  if (opportunity.source_id && (!type || INTERMEDIARY_SOURCE_TYPES.has(type))) {
    return `source:${opportunity.source_id}`
  }

  const label = opportunity.source_label?.trim().toLowerCase()
  return label ? `label:${label}` : null
}

export async function getOpportunityKpiData(): Promise<OpportunityKpiData> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [opportunitiesResult, matchesResult, documentsResult] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select(
          "id, is_demo, status, source_id, source_label, source:ma_sources(source_type), source_office:ma_offices(firm:ma_firms(id))",
        ),
      supabase
        .from("opportunity_matches")
        .select("id, opportunity_id, status, pursuit_stage, nda_status, reviewed_at, opportunity:opportunities(is_demo), repreneur:repreneurs(is_demo)"),
      supabase.from("opportunity_documents").select("id, visibility, opportunity:opportunities(is_demo)"),
    ])

  if (opportunitiesResult.error)
    throw new Error(opportunitiesResult.error.message)
  if (matchesResult.error) throw new Error(matchesResult.error.message)
  if (documentsResult.error) throw new Error(documentsResult.error.message)

  const opportunities = opportunitiesResult.data ?? []
  const matches = matchesResult.data ?? []
  const documents = documentsResult.data ?? []

  const productionOpportunities = opportunities.filter(
    (opportunity) => !opportunity.is_demo,
  )
  const productionMatches = matches.filter((match) => {
    const opportunity = Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity
    const repreneur = Array.isArray(match.repreneur) ? match.repreneur[0] : match.repreneur
    return !opportunity?.is_demo && !repreneur?.is_demo
  })
  const productionDocuments = documents.filter((document) => {
    const opportunity = Array.isArray(document.opportunity) ? document.opportunity[0] : document.opportunity
    return !opportunity?.is_demo
  })
  const activeOpportunities = productionOpportunities.filter(
    (opportunity) => opportunity.status === "active",
  )
  const openOpportunities = productionOpportunities.filter(
    (opportunity) => !["archived", "closed"].includes(opportunity.status),
  )
  const activeIntermediaryKeys = new Set(
    activeOpportunities
      .map(intermediaryKey)
      .filter((key): key is string => Boolean(key)),
  )

  const introducedMatches = productionMatches.filter((match) =>
    INTRODUCTION_STATUSES.includes(match.status as OpportunityMatchStatus),
  )
  const activePursuitMatches = productionMatches.filter(
    (match) => match.status === "active_pursuit",
  )
  const pendingReviews = productionMatches.filter(
    (match) =>
      ["interested", "declined"].includes(match.status) && !match.reviewed_at,
  ).length

  const stageRows = OPPORTUNITY_PURSUIT_STAGE_OPTIONS.map((option) => ({
    stage: option.value,
    label: option.label,
    count: productionMatches.filter((match) => match.pursuit_stage === option.value)
      .length,
  }))

  const sellerMeetings =
    stageRows.find((row) => row.stage === "seller_meeting")?.count ?? 0
  const lois = stageRows.find((row) => row.stage === "loi")?.count ?? 0
  const droppedDeals = productionMatches.filter(
    (match) => match.status === "dropped" || match.pursuit_stage === "dropped",
  ).length
  const closedDeals = productionMatches.filter(
    (match) => match.pursuit_stage === "closed",
  ).length
  const ndaBlockedPursuits = activePursuitMatches.filter((match) =>
    ["required", "sent"].includes(match.nda_status ?? ""),
  ).length
  const approvedDocuments = productionDocuments.filter(
    (document) => document.visibility === "approved_for_repreneur",
  ).length

  const funnelRows: OpportunityKpiFunnelRow[] = [
    {
      label: "Introductions becoming active pursuits",
      numerator: activePursuitMatches.length,
      denominator: introducedMatches.length,
      percent: percentage(
        activePursuitMatches.length,
        introducedMatches.length,
      ),
    },
    {
      label: "Active pursuits reaching seller meeting",
      numerator: sellerMeetings + lois + closedDeals,
      denominator: activePursuitMatches.length + closedDeals + droppedDeals,
      percent: percentage(
        sellerMeetings + lois + closedDeals,
        activePursuitMatches.length + closedDeals + droppedDeals,
      ),
    },
    {
      label: "LOIs becoming closed deals",
      numerator: closedDeals,
      denominator: lois + closedDeals,
      percent: percentage(closedDeals, lois + closedDeals),
    },
  ]

  return {
    activeIntermediaries: activeIntermediaryKeys.size,
    activeOpportunities: activeOpportunities.length,
    totalOpenOpportunities: openOpportunities.length,
    introductions: introducedMatches.length,
    activePursuits: activePursuitMatches.length,
    sellerMeetings,
    lois,
    droppedDeals,
    closedDeals,
    pendingReviews,
    ndaBlockedPursuits,
    approvedDocuments,
    stageRows,
    funnelRows,
  }
}
