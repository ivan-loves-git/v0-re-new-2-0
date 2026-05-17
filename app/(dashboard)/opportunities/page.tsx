import { OpportunityTable } from "@/components/opportunities/opportunity-table"
import { listOpportunities } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunitiesPage() {
  const opportunities = await listOpportunities()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Opportunities</h1>
        <p className="text-sm text-muted-foreground">Internal deal-flow records and repreneur disclosure boundaries.</p>
      </div>

      <OpportunityTable opportunities={opportunities} />
    </div>
  )
}
