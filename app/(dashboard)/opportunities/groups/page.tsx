import { FolderKanban } from "lucide-react"
import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"

export const revalidate = 30

export default async function OpportunityGroupsPage() {
  const opportunities = await listOpportunityWorkSurfaceRecords()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Groups"
        subtitle="Operate opportunity buckets from inventory through active pursuit and closed outcomes."
        icon={FolderKanban}
        tone="opportunity"
      />

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="groups" />
    </div>
  )
}
