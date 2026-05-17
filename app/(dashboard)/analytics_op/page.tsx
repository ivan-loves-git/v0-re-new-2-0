import { OpportunityKpiPanel } from "@/components/dashboard/opportunity-kpi-panel"
import { getOpportunityKpiData } from "@/lib/actions/opportunity-analytics"

export const revalidate = 60

export default async function OpportunityAnalyticsPage() {
  const data = await getOpportunityKpiData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Analytics || Opportunities</h1>
        <p className="mt-1 text-muted-foreground">
          Internal deal-flow metrics across opportunities, introductions, pursuits, NDA status, and documents.
        </p>
      </div>

      <OpportunityKpiPanel data={data} />
    </div>
  )
}
