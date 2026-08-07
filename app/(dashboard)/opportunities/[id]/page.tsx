import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"
import { getMaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import { listOpportunityDocuments } from "@/lib/actions/opportunity-documents"
import { listOpportunityNdaArtifacts } from "@/lib/actions/opportunity-nda-artifacts"
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
  resolveAcmeProvisionalSource,
  updateOpportunityIntake,
} from "@/lib/actions/opportunity-intake"
import type { OpportunityClosureReason } from "@/lib/types/opportunity"

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
  const { tab, wave_ai_outcome: waveAiOutcome } = await searchParams
  const [
    opportunity,
    documents,
    matches,
    matchCandidates,
    pursuitEvents,
    maWorkflow,
    closureHistory,
    ndaArtifacts,
  ] = await Promise.all([
    getOpportunity(id),
    listOpportunityDocuments(id),
    listOpportunityMatches(id),
    listOpportunityMatchCandidates(id),
    listOpportunityPursuitEvents(id),
    getMaOpportunityWorkflow(id),
    getOpportunityClosureHistory(id),
    listOpportunityNdaArtifacts(id),
  ])

  if (!opportunity) {
    notFound()
  }

  const officeOptions = await listMaOfficeIntakeOptions({
    includeCurrentProvisionalOfficeId: opportunity.source_review_required
      ? opportunity.source_office_id
      : null,
  })

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
        maWorkflow={maWorkflow}
        updateAction={updateAction}
        resolveSourceAction={resolveSourceAction}
        closureHistory={closureHistory}
        closeAction={closeAction}
        officeOptions={officeOptions}
        defaultTab={tab}
      />
    </div>
  )
}
