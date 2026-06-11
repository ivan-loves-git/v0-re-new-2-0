import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { OpportunityTable } from "@/components/opportunities/opportunity-table"
import { Button } from "@/components/ui/button"
import { listOpportunities } from "@/lib/actions/opportunities"


export default async function OpportunitiesPage() {
  const opportunities = await listOpportunities()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Opportunities</h1>
          <p className="text-sm text-muted-foreground">Internal deal-flow records and repreneur disclosure boundaries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/opportunities/import">
              <Upload data-icon="inline-start" />
              Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/opportunities/new">
              <Plus data-icon="inline-start" />
              New opportunity
            </Link>
          </Button>
        </div>
      </div>

      <OpportunityTable opportunities={opportunities} />
    </div>
  )
}
