export interface PortalPreviewOpportunityRoute {
  opportunityId: string
  matchId: string | null
}

export interface PortalPreviewRepreneurOption {
  id: string
  email: string | null
}

/**
 * A preview may choose a helpful default only on the empty route. Once a URL
 * names a repreneur, an invalid or stale value must never become another
 * repreneur's preview.
 */
export function resolvePortalPreviewRepreneur<T extends PortalPreviewRepreneurOption>(
  options: T[],
  requestedRepreneurId: string | undefined,
): T | null {
  if (requestedRepreneurId !== undefined) {
    return options.find((option) => option.id === requestedRepreneurId) ?? null
  }

  return options.find((option) => option.email === "myworkmail4@gmail.com") ?? options[0] ?? null
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
