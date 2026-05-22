import { Search } from "lucide-react"
import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { getOpportunityWorkSurfaceSnapshot } from "@/lib/data/dashboard-snapshots"

export default async function OpportunityFindPage() {
  const opportunities = await getOpportunityWorkSurfaceSnapshot()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Find"
        subtitle="Search and filter the full opportunity base with journey-first deal-flow tags."
        icon={Search}
        tone="opportunity"
      />

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="find" />
    </div>
  )
}
