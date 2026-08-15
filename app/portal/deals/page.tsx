import { connection } from "next/server"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurDealSortSelector } from "@/components/portal/repreneur-deal-sort-selector"
import { listMyRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"
import { parseRepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"
import { BriefcaseBusiness } from "lucide-react"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface PortalDealsPageProps {
  searchParams: Promise<{ sort?: string }>
}

export default async function PortalDealsPage({ searchParams }: PortalDealsPageProps) {
  await connection()
  const params = await searchParams
  const sort = parseRepreneurDealSort(params.sort)
  const { repreneur, staffRecommended, dealFlow, automaticMatching } = await listMyRepreneurDealFlow(sort)
  const opportunities = [...staffRecommended, ...dealFlow]

  return (
    <div className="flex flex-col gap-6">
      <SectionPageHeader title="Your deals" subtitle="Recommended opportunities and the full anonymized Re-New deal flow" icon={BriefcaseBusiness} tone="opportunity" />

      <section className="flex flex-col gap-3" aria-labelledby="deal-flow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="deal-flow" className="text-base font-semibold">Deal flow</h2>
            <p className="text-sm text-muted-foreground">Opportunities ordered for your profile.</p>
          </div>
          {automaticMatching.complete ? <RepreneurDealSortSelector value={sort} /> : null}
        </div>
        {!automaticMatching.complete && repreneur ? (
          <Alert>
            <BriefcaseBusiness />
            <AlertTitle>Complete your acquisition project to see the full deal flow</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>Re-New selections remain available. Complete the missing profile and acquisition-project information so WAVE can order the wider deal flow for you.</span>
              <Button asChild className="w-fit" size="sm" variant="outline">
                <Link href="/portal/profile#target-thesis">Edit acquisition project</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <RepreneurOpportunityList
          repreneur={repreneur}
          opportunities={opportunities}
        />
      </section>
    </div>
  )
}
