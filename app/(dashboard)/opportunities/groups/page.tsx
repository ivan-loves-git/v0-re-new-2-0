import Link from "next/link"
import { FolderKanban, Plus, Upload } from "lucide-react"
import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { listOpportunityWorkSurfaceRecords } from "@/lib/actions/opportunities"


export default async function OpportunityGroupsPage() {
  const opportunities = await listOpportunityWorkSurfaceRecords()

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Groups"
        subtitle="Operate opportunity buckets from inventory through active pursuit and closed outcomes."
        icon={FolderKanban}
        tone="opportunity"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/opportunities/import">
                <Upload data-icon="inline-start" />
                Import
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/opportunities/new">
                <Plus data-icon="inline-start" />
                New opportunity
              </Link>
            </Button>
          </div>
        }
      />

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="groups" />
    </div>
  )
}
