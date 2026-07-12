import { OpportunityResponseReviewTable } from "@/components/opportunities/opportunity-response-review-table"
import { listOpportunityMatchResponses } from "@/lib/actions/opportunity-matches"
import { ClipboardCheck } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default async function OpportunityReviewsPage() {
  const responses = await listOpportunityMatchResponses()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Opportunity reviews" subtitle="Repreneur interest and not-a-fit responses awaiting staff review" icon={ClipboardCheck} tone="opportunity" />

      <OpportunityResponseReviewTable responses={responses} />
    </div>
  )
}
