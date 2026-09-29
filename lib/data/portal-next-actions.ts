import "server-only"

import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { listStaffPortalPreviewOpportunities } from "@/lib/actions/repreneur-portal-preview"
import { readPortalCurrentPursuit, readPortalDealActionIndicators, type PortalPursuitViewer } from "@/lib/data/current-pursuit"
import { safeRepreneurOpportunityTitle } from "@/lib/opportunity-confidentiality"
import { createPortalPreviewDocumentHref, createPortalPreviewHref } from "@/lib/portal-preview-routes"
import { buildPortalNextActions, unavailablePortalNextActions, type NextActionDealSource,
  type NextActionExternalSource, type PortalNextActionsProjection } from "@/lib/portal-next-actions"
import { verifyStaffPortalSelection, type StaffPortalSelection } from "@/lib/staff-portal-selection"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import type { RepreneurDealFlowOpportunity, RepreneurOpportunityExposure, RepreneurOpportunityProfile } from "@/lib/types/opportunity"

export type PortalNextActionsViewer = { kind: "portal" } | {
  kind: "staff-preview"
  repreneurId: string
  selectionToken: string
}

export type PortalNextActionsSource = {
  repreneur: RepreneurOpportunityProfile | null
  opportunities: Array<RepreneurOpportunityExposure | RepreneurDealFlowOpportunity>
}

type ExternalRow = {
  id: string
  title: string
  next_action: string | null
  responsible_party: string | null
  due_at: string | null
  stage: string
  deletion_status: string
}

function ownerDealHref(matchId: string) {
  const params = new URLSearchParams({ return: "/portal/pursuits" })
  return `/portal/deals/${encodeURIComponent(matchId)}?${params}`
}

function ownerDocumentHref(matchId: string, documentId?: string) {
  const base = `/portal/deals/${encodeURIComponent(matchId)}`
  return documentId ? `${base}/documents/${encodeURIComponent(documentId)}` : `${base}/nda-template`
}

/** A staff preview must have a live, actor-bound workspace selection before any new read. */
async function resolveNextActionsOwner(viewer: PortalNextActionsViewer): Promise<{
  repreneurId: string
  pursuitViewer: PortalPursuitViewer
  selection: StaffPortalSelection | null
} | null> {
  if (viewer.kind === "portal") {
    const access = await requirePortalAccess()
    return access.repreneurId
      ? { repreneurId: access.repreneurId, pursuitViewer: { kind: "portal" }, selection: null }
      : null
  }
  const staff = await requireStaffAccess()
  if (!isUuid(viewer.repreneurId) || !viewer.selectionToken) return null
  const selection = await verifyStaffPortalSelection(viewer.selectionToken, viewer.repreneurId, staff.user.id)
  return selection
    ? { repreneurId: viewer.repreneurId,
        pursuitViewer: { kind: "staff-preview", repreneurId: viewer.repreneurId }, selection }
    : null
}

/** Returns only the displayed follow-up fields; no notes, contacts or global staff board. */
async function readOwnerExternalFollowUps(repreneurId: string): Promise<ExternalRow[]> {
  const { data, error } = await createAdminClient().from("external_pursuits")
    .select("id,title,next_action,responsible_party,due_at,stage,deletion_status")
    .eq("owner_repreneur_id", repreneurId)
    .eq("deletion_status", "active")
  if (error) throw new Error("Owner External Pursuits are unavailable.")
  return (data ?? []) as ExternalRow[]
}

export async function readPortalNextActions(
  viewer: PortalNextActionsViewer,
  currentSource?: PortalNextActionsSource,
): Promise<PortalNextActionsProjection | null> {
  const owner = await resolveNextActionsOwner(viewer)
  if (!owner) return null
  const asOf = new Date().toISOString()

  try {
    const source = currentSource ?? (viewer.kind === "portal"
      ? await listMyRepreneurOpportunities()
      : await listStaffPortalPreviewOpportunities(owner.repreneurId))
    if (source.repreneur?.id !== owner.repreneurId || typeof source.repreneur.is_demo !== "boolean") {
      return unavailablePortalNextActions(asOf)
    }

    // Both existing readers already enforce Active opportunity, current owner,
    // REAL/DEMO namespace equality and public-safe title. Discovery-only rows
    // have no match and can never become an action here.
    const matched = source.opportunities.filter((deal) => Boolean(deal.match_id && deal.match_status))
    const proposedIds = matched.filter((deal) => deal.match_status === "proposed")
      .map((deal) => deal.match_id!)
    const activeIds = matched.filter((deal) => deal.match_status === "active_pursuit")
      .map((deal) => deal.match_id!)
    const [indicators, journeys, externalRows] = await Promise.all([
      readPortalDealActionIndicators(proposedIds, owner.pursuitViewer),
      Promise.all(activeIds.map((matchId) => readPortalCurrentPursuit({ matchId, viewer: owner.pursuitViewer }))),
      readOwnerExternalFollowUps(owner.repreneurId),
    ])
    const journeyByMatch = new Map(activeIds.map((matchId, index) => [matchId, journeys[index]]))
    const preview = owner.selection
    const dealHref = (matchId: string) => preview
      ? createPortalPreviewHref(owner.repreneurId, matchId, preview.workspaceId, { returnView: "renew-pursuits" })
      : ownerDealHref(matchId)
    const documentHref = (matchId: string, documentId?: string) => preview
      ? createPortalPreviewDocumentHref(owner.repreneurId, matchId,
          documentId ? { kind: "information-memorandum", documentId } : { kind: "nda-template" },
          preview.workspaceId, preview.generation)
      : ownerDocumentHref(matchId, documentId)
    const externalHref = preview
      ? createPortalPreviewHref(owner.repreneurId, undefined, preview.workspaceId, { view: "external-pursuits" })
      : "/portal/pursuits?view=external"

    const deals: NextActionDealSource[] = matched.flatMap((deal) => {
      if (!deal.match_id || !deal.match_status) return []
      const journey = journeyByMatch.get(deal.match_id)
      return [{
        matchId: deal.match_id,
        status: deal.match_status,
        title: safeRepreneurOpportunityTitle(deal.public_title),
        href: dealHref(deal.match_id),
        responseExpiresAt: deal.recommendation_expires_at ?? null,
        currentInterestAt: deal.interest_expressed_at ?? null,
        interestRejected: deal.interest_rejected === true,
        respondAuthorized: indicators[deal.match_id] === "respond",
        pursuit: journey ? {
          action: journey.action === "sign_nda" || journey.action === "unknown" ? journey.action : null,
          signedCopyState: journey.signedCopyState,
          ndaTemplateHref: journey.action === "sign_nda" ? documentHref(deal.match_id) : null,
          informationMemorandumHref: journey.confidentialGrant
            ? documentHref(deal.match_id, journey.confidentialGrant.informationMemoDocumentId) : null,
        } : null,
      }]
    })
    const external: NextActionExternalSource[] = externalRows.map((row) => ({
      id: row.id,
      title: row.title.trim() || "External pursuit",
      nextAction: row.next_action,
      responsibleParty: row.responsible_party,
      dueAt: row.due_at,
      stage: row.stage,
      deletionStatus: row.deletion_status,
      href: externalHref,
    }))
    return buildPortalNextActions({ deals, external, asOf })
  } catch {
    // An incomplete authority read is unknown, never an empty action queue.
    return unavailablePortalNextActions(asOf)
  }
}
