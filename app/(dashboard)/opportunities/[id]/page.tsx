import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"
import { getMaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import { listOpportunityDocuments } from "@/lib/actions/opportunity-documents"
import { listOpportunityNdaArtifacts } from "@/lib/actions/opportunity-nda-artifacts"
import { readStaffCurrentPursuit } from "@/lib/data/current-pursuit"
import {
  listOpportunityMatchCandidates,
  listOpportunityMatches,
  listOpportunityPursuitEvents,
} from "@/lib/actions/opportunity-matches"
import {
  closeOpportunity,
  getOpportunity,
  getOpportunityClosureHistory,
} from "@/lib/actions/opportunities"
import {
  listMaOfficeIntakeOptions,
  listOpportunityGeographyOptions,
  resolveAcmeProvisionalSource,
  updateOpportunityIntake,
} from "@/lib/actions/opportunity-intake"
import { isFranceGeographyMandatesEnabled } from "@/lib/opportunity-geography-release"
import type { OpportunityClosureReason } from "@/lib/types/opportunity"
import { isUuid } from "@/lib/uuid"

export default function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; wave_ai_outcome?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <OpportunityDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function OpportunityDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; wave_ai_outcome?: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { tab, wave_ai_outcome: waveAiOutcome } = await searchParams
  const opportunity = await getOpportunity(id)
  if (!opportunity) {
    notFound()
  }

  const [
    documents,
    matches,
    matchCandidates,
    pursuitEvents,
    maWorkflow,
    closureHistory,
    ndaArtifacts,
  ] = await Promise.all([
    listOpportunityDocuments(id),
    listOpportunityMatches(id),
    listOpportunityMatchCandidates(id),
    listOpportunityPursuitEvents(id),
    getMaOpportunityWorkflow(id),
    getOpportunityClosureHistory(id),
    listOpportunityNdaArtifacts(id),
  ])

  const geographyMandatesEnabled = isFranceGeographyMandatesEnabled()
  const [officeOptions, geographyOptions] = await Promise.all([
    listMaOfficeIntakeOptions({
      includeCurrentProvisionalOfficeId: opportunity.source_review_required
        ? opportunity.source_office_id
        : null,
    }),
    geographyMandatesEnabled ? listOpportunityGeographyOptions() : [],
  ])
  const journeyMatch = matches.find((match) => match.status === "active_pursuit")
    ?? matches.find((match) => match.status === "dropped")
    ?? null
  const pursuitProjection = journeyMatch
    ? await readStaffCurrentPursuit(journeyMatch.id)
    : null

  async function updateAction(formData: FormData) {
    "use server"
    if (waveAiOutcome) formData.set("wave_ai_outcome", waveAiOutcome)
    return updateOpportunityIntake(id, formData)
  }

  async function closeAction(reason: OpportunityClosureReason) {
    "use server"
    return closeOpportunity(id, reason)
  }

  async function resolveSourceAction(formData: FormData) {
    "use server"
    if (waveAiOutcome) formData.set("wave_ai_outcome", waveAiOutcome)
    return resolveAcmeProvisionalSource(id, formData)
  }

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities/find">
          <ArrowLeft data-icon="inline-start" />
          Back to opportunities
        </Link>
      </Button>

      <OpportunityDetail
        opportunity={opportunity}
        documents={documents}
        ndaArtifacts={ndaArtifacts}
        matches={matches}
        matchCandidates={matchCandidates}
        pursuitEvents={pursuitEvents}
        pursuitProjection={pursuitProjection}
        maWorkflow={maWorkflow}
        updateAction={updateAction}
        resolveSourceAction={resolveSourceAction}
        closureHistory={closureHistory}
        closeAction={closeAction}
        officeOptions={officeOptions}
        geographyOptions={geographyOptions}
        geographyMandatesEnabled={geographyMandatesEnabled}
        defaultTab={tab}
      />
    </div>
  )
}
