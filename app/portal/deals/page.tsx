import { connection } from "next/server"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurDealSortSelector } from "@/components/portal/repreneur-deal-sort-selector"
import { listMyRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"
import { parseRepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"

interface PortalDealsPageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function PortalDealsPage({ searchParams }: PortalDealsPageProps) {
  await connection()
  const params = await searchParams
  const sort = parseRepreneurDealSort(params.sort)
  const { repreneur, staffRecommended, dealFlow } = await listMyRepreneurDealFlow(sort)

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Your deals" subtitle="Recommended opportunities and the full anonymized Re-New deal flow" icon={BriefcaseBusiness} tone="opportunity" />

      {staffRecommended.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="recommended-deals">
          <div>
            <h2 id="recommended-deals" className="text-base font-semibold">Recommended by Re-New</h2>
            <p className="text-sm text-muted-foreground">Opportunities the team has selected for you.</p>
          </div>
          <RepreneurOpportunityList repreneur={repreneur} opportunities={staffRecommended} />
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="deal-flow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="deal-flow" className="text-base font-semibold">Deal flow</h2>
            <p className="text-sm text-muted-foreground">Opportunities ordered for your profile.</p>
          </div>
          <RepreneurDealSortSelector value={sort} />
        </div>
        <RepreneurOpportunityList
          repreneur={repreneur}
          opportunities={dealFlow}
          emptyDescription={
            staffRecommended.length > 0
              ? "There are no additional opportunities available at the moment."
              : undefined
          }
        />
      </section>
    </div>
  )
}
