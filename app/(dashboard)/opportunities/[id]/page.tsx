import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"
import { getMaOpportunityWorkflow, sendMaSourceWorkflowEmail } from "@/lib/actions/ma-workflows"
import { listOpportunityDocuments } from "@/lib/actions/opportunity-documents"
import { listOpportunityMatchCandidates, listOpportunityMatches, listOpportunityPursuitEvents } from "@/lib/actions/opportunity-matches"
import { getOpportunity, updateOpportunity } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const opportunity = await getOpportunity(id)

  if (!opportunity) {
    notFound()
  }

  const [documents, matches, matchCandidates, pursuitEvents, maWorkflow] = await Promise.all([
    listOpportunityDocuments(id),
    listOpportunityMatches(id),
    listOpportunityMatchCandidates(id),
    listOpportunityPursuitEvents(id),
    getMaOpportunityWorkflow(id),
  ])

  async function updateAction(formData: FormData) {
    "use server"
    await updateOpportunity(id, formData)
  }

  async function sendMaAction(formData: FormData) {
    "use server"
    return sendMaSourceWorkflowEmail(id, formData)
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities/find">
          <ArrowLeft className="size-4" />
          Back to Opportunities
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
        sendMaAction={sendMaAction}
      />
    </div>
  )
}
