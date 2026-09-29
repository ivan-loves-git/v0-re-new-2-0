import { connection } from "next/server"
import { PortalPursuitsContent } from "@/components/portal/portal-pursuits-content"
import { listMyRepreneurOpportunities } from "@/lib/actions/repreneur-opportunities"
import { readPortalDealActionIndicators } from "@/lib/data/current-pursuit"
import { listExternalPursuitBoard } from "@/lib/actions/external-pursuits"
import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"
import { readPortalNextActions } from "@/lib/data/portal-next-actions"
import { unavailablePortalNextActions } from "@/lib/portal-next-actions"

export default async function PortalPursuitsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; q?: string; status?: string }>
}) {
  await connection()
  const search = await searchParams
  if (search.view === "external") {
    // The panel has its own fail-closed read. An unavailable summary must not
    // make the existing External board unavailable.
    const [external, nextActions] = await Promise.all([
      listExternalPursuitBoard(), readPortalNextActions({ kind: "portal" }),
    ])
    const attachmentsByPursuit = await getExternalPursuitAttachmentMap(external.map((record) => record.id))
    return <PortalPursuitsContent view="external" deals={[]} actions={{}} responseAsOf={new Date().toISOString()}
      external={external} attachmentsByPursuit={attachmentsByPursuit}
      nextActions={nextActions ?? unavailablePortalNextActions()} />
  }

  const source = await listMyRepreneurOpportunities()
  const { opportunities } = source
  const nextActions = await readPortalNextActions({ kind: "portal" }, source)
  const actions = await readPortalDealActionIndicators(opportunities.map((deal) => deal.match_id))
  const status = search.status === "active" || search.status === "awaiting" || search.status === "ended"
    ? search.status : "all"
  return <PortalPursuitsContent view="renew" deals={opportunities.map((deal) => ({
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
  }))} actions={actions} responseAsOf={new Date().toISOString()}
    initialQuery={typeof search.q === "string" ? search.q.slice(0, 120) : ""} initialStatus={status}
    external={[]} attachmentsByPursuit={{}}
    nextActions={nextActions ?? unavailablePortalNextActions()} />
}
