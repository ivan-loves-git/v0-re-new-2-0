"use client"

import { PortalNavigationLink } from "@/components/portal/portal-navigation-link"
import { BriefcaseBusiness } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurDealSortSelector } from "@/components/portal/repreneur-deal-sort-selector"
import { useUiCopy } from "@/components/i18n/ui-text"
import type { listMyRepreneurDealFlow } from "@/lib/actions/repreneur-opportunities"
import type { RepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"

type DealFlow = Awaited<ReturnType<typeof listMyRepreneurDealFlow>>

export function PortalDealsContent({
  result,
  sort,
  staffPreview,
}: {
  result: DealFlow
  sort: RepreneurDealSort
  staffPreview?: { profileHref: string; detailHrefByOpportunityId: Record<string, string> }
}) {
  const u = useUiCopy()
  const { repreneur, deals, automaticMatching, demoProfile } = result

  return <div className="flex flex-col gap-6">
    <SectionPageHeader title={u("Your deals")} subtitle={u("Recommended opportunities and the full anonymized Re-New deal flow")} icon={BriefcaseBusiness} tone="opportunity" />
    <section className="flex flex-col gap-3" aria-labelledby="deal-flow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="deal-flow" className="text-base font-semibold">{u("Deal flow")}</h2>
          <p className="text-sm text-muted-foreground">{u("Opportunities ordered for your profile.")}</p>
        </div>
        {automaticMatching.complete ? <RepreneurDealSortSelector value={sort} /> : null}
      </div>
      {demoProfile ? <Alert>
        <BriefcaseBusiness />
        <AlertTitle>{u("Demo profile")}</AlertTitle>
        <AlertDescription>{u("This test profile is kept outside the production Deal Flow and its operating statistics.")}</AlertDescription>
      </Alert> : null}
      {!demoProfile && !automaticMatching.complete && repreneur ? <Alert>
        <BriefcaseBusiness />
        <AlertTitle>{u("Complete your acquisition project to receive tailored recommendations")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{u("Your current Re-New selections remain available. Add the missing acquisition-project information so WAVE can recommend further opportunities that fit your criteria.")}</span>
          <Button asChild className="w-fit" size="sm" variant="outline">
            <PortalNavigationLink href={staffPreview?.profileHref ?? "/portal/profile#target-thesis"}>{u("Edit acquisition project")}</PortalNavigationLink>
          </Button>
        </AlertDescription>
      </Alert> : null}
      <RepreneurOpportunityList repreneur={repreneur} opportunities={deals} returnSort={sort === "relevance" ? undefined : sort}
        detailHrefByOpportunityId={staffPreview?.detailHrefByOpportunityId} readOnly={Boolean(staffPreview)} />
    </section>
  </div>
}
