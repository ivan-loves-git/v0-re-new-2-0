import { BarChart3 } from "lucide-react"
import { OpportunityKpiPanel } from "@/components/dashboard/opportunity-kpi-panel"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { getOpportunityKpiData } from "@/lib/actions/opportunity-analytics"


export default async function OpportunityAnalyticsPage() {
  const data = await getOpportunityKpiData()

  return (
    <div className="wave-page flex flex-col gap-5">
      <SectionPageHeader
        title="Analytics"
        subtitle="Internal deal-flow metrics across opportunities, introductions, pursuits, NDA status, and documents."
        icon={BarChart3}
        tone="opportunity"
      />

      <OpportunityKpiPanel data={data} />
    </div>
  )
}
