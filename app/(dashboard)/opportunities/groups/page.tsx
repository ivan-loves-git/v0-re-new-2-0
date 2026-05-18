import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunityGroupsPage() {
  const opportunities = await listOpportunityWorkSurfaceRecords()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Groups || Opportunities</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operate opportunity buckets from inventory through active pursuit and closed outcomes.</p>
      </div>

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="groups" />
    </div>
  )
}
