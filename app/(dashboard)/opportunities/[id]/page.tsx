import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OpportunityDetail } from "@/components/opportunities/opportunity-detail"
import { listOpportunityDocuments } from "@/lib/actions/opportunity-documents"
import { getOpportunity, updateOpportunity } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const opportunity = await getOpportunity(id)

  if (!opportunity) {
    notFound()
  }

  const documents = await listOpportunityDocuments(id)

  async function updateAction(formData: FormData) {
    "use server"
    await updateOpportunity(id, formData)
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/opportunities">
          <ArrowLeft className="size-4" />
          Back to Opportunities
        </Link>
      </Button>

      <OpportunityDetail opportunity={opportunity} documents={documents} updateAction={updateAction} />
    </div>
  )
}
