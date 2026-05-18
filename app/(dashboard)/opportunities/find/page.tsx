import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunityFindPage() {
  const opportunities = await listOpportunityWorkSurfaceRecords()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Find Opportunities</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search and filter the full opportunity base with journey-first deal-flow tags.</p>
      </div>

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="find" />
    </div>
  )
}
