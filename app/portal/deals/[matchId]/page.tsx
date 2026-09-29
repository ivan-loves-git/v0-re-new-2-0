import { notFound } from "next/navigation"
import { connection } from "next/server"
import { getMyRepreneurOpportunity, listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { readPortalCurrentPursuit, readPortalDealActionIndicators } from "@/lib/data/current-pursuit"
import { RepreneurPursuitWorkspace } from "@/components/portal/repreneur-pursuit-workspace"
import { interestWithdrawalOperationsPaused } from "@/lib/interest-withdrawal-operations"


export default async function PortalDealDetailPage({ params, searchParams }: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ q?: string; status?: string; return?: string }>
}) {
  await connection()
  const { matchId } = await params
  const [opportunity, list, search] = await Promise.all([
    getMyRepreneurOpportunity(matchId),
    listMyRepreneurOpportunities(),
    searchParams,
  ])

  if (!opportunity) {
    notFound()
  }

  const [journey, actions] = await Promise.all([
    opportunity.match_id && opportunity.match_status === "active_pursuit"
      ? readPortalCurrentPursuit({
        matchId: opportunity.match_id,
        viewer: { kind: "portal" },
      })
      : Promise.resolve(null),
    readPortalDealActionIndicators(list.opportunities.map((deal) => deal.match_id)),
  ])
  const status = search.status === "active" || search.status === "awaiting" || search.status === "ended"
    ? search.status : "all"
  const requestedReturn = search.return
  const returnHref = requestedReturn === "/portal/pursuits"
    ? "/portal/pursuits"
    : requestedReturn?.startsWith("/portal/deals?") && !requestedReturn.includes("//")
      ? requestedReturn : "/portal/deals"

  return <RepreneurPursuitWorkspace
    opportunity={opportunity}
    deals={list.opportunities.map((deal) => ({
      match_id: deal.match_id,
      match_status: deal.match_status,
      pursuit_stage: deal.pursuit_stage,
      interest_rejected: deal.interest_rejected,
      recommendation_expires_at: deal.recommendation_expires_at,
      public_title: deal.public_title,
      canonical_sector: deal.canonical_sector,
      sector: deal.sector,
      activity: deal.activity,
      geography_label: deal.geography_label,
      location: deal.location,
    }))}
    actions={actions}
    journey={journey}
    responseAsOf={new Date().toISOString()}
    withdrawalPaused={interestWithdrawalOperationsPaused()}
    initialQuery={typeof search.q === "string" ? search.q.slice(0, 120) : ""}
    initialStatus={status}
    returnHref={returnHref}
  />
}
