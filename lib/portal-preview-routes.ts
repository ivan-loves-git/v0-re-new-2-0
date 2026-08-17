export interface PortalPreviewOpportunityRoute {
  opportunityId: string
  matchId: string | null
}

function portalPreviewHref(repreneurId: string, matchId?: string) {
  const params = new URLSearchParams({ repreneurId })
  if (matchId) params.set("matchId", matchId)
  return `/portal-preview?${params.toString()}`
}

export function createPortalPreviewDealHrefMap(
  repreneurId: string,
  opportunities: PortalPreviewOpportunityRoute[],
): Record<string, string> {
  return Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.matchId ?? opportunity.opportunityId,
      portalPreviewHref(repreneurId, opportunity.matchId ?? undefined),
    ]),
  )
}

export function createPortalPreviewHref(repreneurId: string, matchId?: string) {
  return portalPreviewHref(repreneurId, matchId)
}
