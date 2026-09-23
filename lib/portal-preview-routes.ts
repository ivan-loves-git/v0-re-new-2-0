export interface PortalPreviewOpportunityRoute {
  opportunityId: string
  matchId: string | null
}

export interface PortalPreviewRepreneurOption {
  id: string
  email: string | null
}

export type PortalPreviewSection = "deals" | "profile" | "renew-pursuits" | "external-pursuits"

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

function portalPreviewHref(repreneurId: string, dealId?: string, workspaceId?: string | null) {
  const params = new URLSearchParams({ repreneurId })
  if (dealId) params.set("dealId", dealId)
  if (workspaceId) params.set("workspaceId", workspaceId)
  return `/portal-preview?${params.toString()}`
}

export function createPortalPreviewDealHrefMap(
  repreneurId: string,
  opportunities: PortalPreviewOpportunityRoute[],
  workspaceId?: string | null,
): Record<string, string> {
  return Object.fromEntries(
    opportunities.map((opportunity) => [
      opportunity.matchId ?? opportunity.opportunityId,
      portalPreviewHref(repreneurId, opportunity.matchId ?? opportunity.opportunityId, workspaceId),
    ]),
  )
}

export function createPortalPreviewHref(repreneurId: string, dealId?: string, workspaceId?: string | null) {
  return portalPreviewHref(repreneurId, dealId, workspaceId)
}

/** Switching the represented person deliberately keeps no prior selection or action state. */
export function createPortalPreviewSelectionHref(repreneurId: string, workspaceId?: string | null) {
  return portalPreviewHref(repreneurId, undefined, workspaceId)
}

export function createPortalPreviewSectionHref(repreneurId: string, section: PortalPreviewSection, workspaceId?: string | null) {
  const params = new URLSearchParams({ repreneurId, view: section })
  if (workspaceId) params.set("workspaceId", workspaceId)
  return `/portal-preview?${params.toString()}`
}

export function createPortalPreviewDocumentHref(
  repreneurId: string,
  matchId: string,
  resource: { kind: "nda-template" } | { kind: "information-memorandum"; documentId: string },
) {
  const base = `/portal-preview/deals/${encodeURIComponent(matchId)}`
  const path = resource.kind === "nda-template"
    ? `${base}/nda-template`
    : `${base}/documents/${encodeURIComponent(resource.documentId)}`
  return `${path}?${new URLSearchParams({ repreneurId }).toString()}`
}
