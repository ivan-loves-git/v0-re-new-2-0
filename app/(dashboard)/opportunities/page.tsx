import Link from "next/link"
import { BriefcaseBusiness, Plus } from "lucide-react"
import { OpportunityTable } from "@/components/opportunities/opportunity-table"
import { OpportunityExportButton } from "@/components/opportunities/opportunity-export-button"
import { Button } from "@/components/ui/button"
import { listOpportunities } from "@/lib/actions/opportunities"
import { SectionPageHeader } from "@/components/ui/section-page-header"


export default async function OpportunitiesPage() {
  const opportunities = await listOpportunities()

  return (
    <div className="space-y-6">
      <SectionPageHeader
        title="Opportunities"
        subtitle="Internal deal-flow records and controlled repreneur disclosure"
        icon={BriefcaseBusiness}
        tone="opportunity"
        actions={
          <>
            <OpportunityExportButton />
            <Button asChild>
              <Link href="/opportunities/new">
                <Plus data-icon="inline-start" />
                New opportunity
              </Link>
            </Button>
          </>
        }
      />

      <OpportunityTable opportunities={opportunities} />
    </div>
  )
}
