import Link from "next/link"
import { Plus, Search, Upload } from "lucide-react"
import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import { Button } from "@/components/ui/button"
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

      <OpportunityWorkSurfaceTable opportunities={opportunities} mode="find" />
    </div>
  )
}
