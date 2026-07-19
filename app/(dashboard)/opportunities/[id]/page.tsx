import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"
import { getMaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import { listOpportunityDocuments } from "@/lib/actions/opportunity-documents"
import { listOpportunityMatchCandidates, listOpportunityMatches, listOpportunityPursuitEvents } from "@/lib/actions/opportunity-matches"
import { closeOpportunity, getOpportunity, getOpportunityClosureHistory, reopenOpportunity, updateOpportunity } from "@/lib/actions/opportunities"
import type { OpportunityClosureReason } from "@/lib/types/opportunity"


export default function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
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
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const [opportunity, documents, matches, matchCandidates, pursuitEvents, maWorkflow, closureHistory] = await Promise.all([
    getOpportunity(id),
    listOpportunityDocuments(id),
    listOpportunityMatches(id),
    listOpportunityMatchCandidates(id),
    listOpportunityPursuitEvents(id),
    getMaOpportunityWorkflow(id),
    getOpportunityClosureHistory(id),
  ])

  if (!opportunity) {
    notFound()
  }

  async function updateAction(formData: FormData) {
    "use server"
    return updateOpportunity(id, formData)
  }

  async function closeAction(reason: OpportunityClosureReason) {
    "use server"
    return closeOpportunity(id, reason)
  }

  async function reopenAction() {
    "use server"
    return reopenOpportunity(id)
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
        matches={matches}
        matchCandidates={matchCandidates}
        pursuitEvents={pursuitEvents}
        maWorkflow={maWorkflow}
        updateAction={updateAction}
        closureHistory={closureHistory}
        closeAction={closeAction}
        reopenAction={reopenAction}
        defaultTab={tab}
      />
    </div>
  )
}
