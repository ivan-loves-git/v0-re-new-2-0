import { OpportunityResponseReviewTable } from "@/components/opportunities/opportunity-response-review-table"
import { listOpportunityMatchResponses } from "@/lib/actions/opportunity-matches"


export default async function OpportunityReviewsPage() {
  const responses = await listOpportunityMatchResponses()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Opportunity Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Repreneur interest and not-a-fit responses waiting for staff review.
        </p>
      </div>

      <OpportunityResponseReviewTable responses={responses} />
    </div>
  )
}
