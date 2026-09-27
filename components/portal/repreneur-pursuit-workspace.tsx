"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Search, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { PursuitJourneyHistory, PursuitJourneyProgress } from "@/components/portal/pursuit-journey"
import { SectorArtwork } from "@/components/portal/sector-artwork"
import { useUiCopy, useUiLanguage } from "@/components/i18n/ui-text"
import { uiCopy } from "@/lib/i18n/ui-copy"
import { sectorUiLabel, geographyUiLabel } from "@/lib/i18n/canonical-labels"
import { displayLocale } from "@/lib/i18n/ui-language"
import { matchStatusUiLabel, pursuitStageUiLabel } from "@/lib/i18n/deal-labels"
import type { PortalCurrentPursuit, PortalDealAction } from "@/lib/data/current-pursuit"
import type { OwnerCriterionComparison, RepreneurDealFlowOpportunity, RepreneurOpportunityExposure } from "@/lib/types/opportunity"
import { cn } from "@/lib/utils"

type Deal = RepreneurDealFlowOpportunity | RepreneurOpportunityExposure
export type SidebarDeal = Pick<RepreneurOpportunityExposure,
  "match_id" | "match_status" | "pursuit_stage" | "public_title" | "canonical_sector" |
  "sector" | "activity" | "geography_label" | "location">
type StatusFilter = "all" | "active" | "awaiting" | "ended"
const hasOwnAction = (action: PortalDealAction | undefined) => action === "respond" || action === "sign_nda"

function dealName(deal: Pick<RepreneurOpportunityExposure, "public_title">, language: "fr" | "en") {
  return deal.public_title || uiCopy(language, "Confidential acquisition opportunity")
}

function workspaceStatus(deal: SidebarDeal): StatusFilter {
  if (deal.match_status === "active_pursuit") return "active"
  if (deal.match_status === "proposed" || deal.match_status === "interested") return "awaiting"
  return "ended"
}

export function filterWorkspaceDeals<T extends SidebarDeal>(deals: T[], query: string, status: StatusFilter): T[] {
  const needle = query.trim().toLowerCase()
  return deals.filter((deal) => {
    if (status !== "all" && workspaceStatus(deal) !== status) return false
    if (!needle) return true
    return [deal.public_title, deal.sector, deal.activity, deal.geography_label, deal.location]
      .some((value) => value?.toLowerCase().includes(needle))
  })
}

function formattedNumber(value: number | null, language: "fr" | "en", suffix = "") {
  return value == null || !Number.isFinite(value) ? "—"
    : `${new Intl.NumberFormat(displayLocale(language), { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

function CriteriaPanel({ criteria }: { criteria: OwnerCriterionComparison[] | undefined }) {
  const copy = useUiCopy()
  const language = useUiLanguage()
  const labels = {
    sector: copy("Sector"), geography: copy("Geography"), revenue: copy("Revenue"),
    ebitda: copy("EBITDA"), margin: copy("EBITDA margin"), team: copy("Team"),
  }
  const outcomes = {
    within_target: copy("Within target"), outside_target: copy("Outside target"),
    not_specified: copy("Not specified"), unknown: copy("Unknown or needs review"),
  }
  const formatTarget = (criterion: OwnerCriterionComparison) => {
    const value = criterion.target
    if (Array.isArray(value)) return value.length
      ? value.map((label) => criterion.key === "sector" ? sectorUiLabel(label, language) : geographyUiLabel(label, language)).join(", ")
      : copy("Not specified")
    if (value && typeof value === "object") {
      if (value.min == null && value.max == null) return copy("Not specified")
      const suffix = criterion.key === "revenue" ? " M EUR" : criterion.key === "ebitda" ? " K EUR" : ""
      if (value.min != null && value.max != null) return `${formattedNumber(value.min, language)}–${formattedNumber(value.max, language)}${suffix}`
      return value.min != null ? `≥ ${formattedNumber(value.min, language)}${suffix}` : `≤ ${formattedNumber(value.max, language)}${suffix}`
    }
    return typeof value === "number" ? `≥ ${formattedNumber(value, language)}%` : copy("Not specified")
  }
  const formatActual = (criterion: OwnerCriterionComparison) => {
    const value = criterion.actual
    if (typeof value === "string") return criterion.key === "sector" ? sectorUiLabel(value, language) : criterion.key === "geography" ? geographyUiLabel(value, language) : value
    if (typeof value !== "number") return copy("Unknown")
    const suffix = criterion.key === "revenue" ? " M EUR" : criterion.key === "ebitda" ? " K EUR" : criterion.key === "margin" ? "%" : ""
    return formattedNumber(value, language, suffix)
  }
  return <section className="rounded-lg border bg-card" aria-label={copy("Your criteria")}>
    <div className="border-b p-5">
      <h2 className="font-semibold">{copy("Your criteria")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy("Your current targets compared with the information available for this deal. This does not change Re-New's selection.")}</p>
    </div>
    {criteria?.length ? <div className="divide-y">
      {criteria.map((criterion) => <div key={criterion.key} className="grid gap-3 p-5 text-sm sm:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1.5fr)_minmax(9rem,1.5fr)_auto] sm:items-start">
        <h3 className="font-medium">{labels[criterion.key]}</h3>
        <div><p className="text-xs text-muted-foreground">{copy("Your target")}</p><p className="mt-1 wrap-break-word">{formatTarget(criterion)}</p></div>
        <div><p className="text-xs text-muted-foreground">{copy("This deal")}</p><p className="mt-1 wrap-break-word">{formatActual(criterion)}</p></div>
        <span className={cn("w-fit rounded-md border px-2 py-1 text-xs", criterion.outcome === "within_target" && "border-emerald-300 text-emerald-800 dark:text-emerald-300", criterion.outcome === "outside_target" && "border-amber-300 text-amber-800 dark:text-amber-300")}>{outcomes[criterion.outcome]}</span>
      </div>)}
    </div> : <p className="p-5 text-sm text-muted-foreground">{copy("Criteria are unavailable right now.")}</p>}
  </section>
}

export function RepreneurPursuitWorkspace({ opportunity, deals, actions, journey, withdrawalPaused = false, initialQuery = "", initialStatus = "all", returnHref = "/portal/deals" }: {
  opportunity: Deal
  deals: SidebarDeal[]
  actions: Record<string, PortalDealAction>
  journey: PortalCurrentPursuit | null
  withdrawalPaused?: boolean
  initialQuery?: string
  initialStatus?: StatusFilter
  returnHref?: string
}) {
  const copy = useUiCopy()
  const language = useUiLanguage()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const [tab, setTab] = useState("overview")
  const visible = useMemo(() => filterWorkspaceDeals(deals, query, status), [deals, query, status])
  const selectedId = opportunity.match_id ?? opportunity.opportunity_id
  const currentIndex = visible.findIndex((deal) => deal.match_id === selectedId)
  const hrefFor = (deal: SidebarDeal) => {
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (status !== "all") params.set("status", status)
    if (returnHref !== "/portal/deals") params.set("return", returnHref)
    const suffix = params.toString()
    return `/portal/deals/${deal.match_id}${suffix ? `?${suffix}` : ""}`
  }
  const title = dealName(opportunity, language)
  const selectLabel = (deal: SidebarDeal) => deal.match_status === "active_pursuit" && deal.pursuit_stage
    ? pursuitStageUiLabel(deal.pursuit_stage, language)
    : deal.match_status ? matchStatusUiLabel(deal.match_status, language) : copy("Live Opportunity")

  const fullHistory = () => {
    setTab("journey")
    window.requestAnimationFrame(() => document.getElementById("journey-view")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return <div className="overflow-hidden rounded-lg border bg-card lg:grid lg:min-h-[calc(100svh-11rem)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]" data-wave-workspace="pursuit">
    <aside className={cn("border-r bg-card lg:flex lg:min-h-0 lg:flex-col", mobileListOpen ? "block" : "hidden")} aria-label={copy("My pursuits")}>
      <div className="space-y-4 border-b p-5">
        <div><h2 className="text-xl font-semibold tracking-tight">{copy("My pursuits")}</h2><p className="mt-1 text-xs text-muted-foreground">{copy("Your Re-New matches and current discussions.")}</p></div>
        <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={copy("Search pursuits")} placeholder={copy("Search pursuits")} value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
        <select aria-label={copy("Pursuit status")} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="min-h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="all">{copy("All pursuits")} · {deals.length}</option>
          <option value="active">{copy("Active pursuits")} · {deals.filter((deal) => workspaceStatus(deal) === "active").length}</option>
          <option value="awaiting">{copy("Awaiting response or review")} · {deals.filter((deal) => workspaceStatus(deal) === "awaiting").length}</option>
          <option value="ended">{copy("Ended discussions")} · {deals.filter((deal) => workspaceStatus(deal) === "ended").length}</option>
        </select>
      </div>
      <nav className="max-h-[65svh] flex-1 overflow-y-auto lg:max-h-none" aria-label={copy("Pursuits")}>
        {visible.length ? visible.map((deal) => {
          const action = actions[deal.match_id]
          const selected = deal.match_id === selectedId
          return <Link key={deal.match_id} href={hrefFor(deal)} aria-current={selected ? "page" : undefined} onClick={() => setMobileListOpen(false)} className={cn("flex gap-3 border-b p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary", selected && "bg-primary/8")}>
            <SectorArtwork sector={deal.canonical_sector ?? deal.sector} action={hasOwnAction(action)} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{dealName(deal, language)}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{deal.activity || (deal.sector ? sectorUiLabel(deal.sector, language) : copy("Sector to confirm"))}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded border px-1.5 py-0.5">{selectLabel(deal)}</span>{hasOwnAction(action) ? <span className="font-medium text-primary">● {copy("Your action")}</span> : action === "unknown" ? <span className="text-muted-foreground">{copy("Action status unavailable")}</span> : null}</span></span>
            <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </Link>
        }) : <div className="p-5 text-sm text-muted-foreground"><p>{copy("No pursuits match these filters.")}</p><Button variant="link" className="mt-2 p-0" onClick={() => { setQuery(""); setStatus("all") }}>{copy("Clear filters")}</Button></div>}
      </nav>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground" role="status">{copy("{count} pursuits in this view", { count: visible.length })}</p>
    </aside>
    <div className={cn("min-w-0 bg-muted/20", mobileListOpen && "hidden lg:block")}>
      <div className="flex min-h-16 items-center justify-between gap-2 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm"><Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileListOpen(true)}><PanelLeft data-icon="inline-start" />{copy("Pursuits")}</Button><Link href={returnHref} className="hidden text-muted-foreground underline-offset-4 hover:underline sm:inline">{copy("My pursuits")}</Link><ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:inline" /><span className="truncate font-medium">{title}</span></div>
        <div className="flex shrink-0 gap-1"><Button asChild variant="ghost" size="icon" aria-label={copy("Previous pursuit")} disabled={currentIndex <= 0}><Link href={currentIndex > 0 ? hrefFor(visible[currentIndex - 1]) : "#"}><ChevronLeft /></Link></Button><Button asChild variant="ghost" size="icon" aria-label={copy("Next pursuit")} disabled={currentIndex < 0 || currentIndex >= visible.length - 1}><Link href={currentIndex >= 0 && currentIndex < visible.length - 1 ? hrefFor(visible[currentIndex + 1]) : "#"}><ChevronRight /></Link></Button></div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex items-start gap-4"><SectorArtwork sector={opportunity.canonical_sector ?? opportunity.sector} large action={hasOwnAction(opportunity.match_id ? actions[opportunity.match_id] : null)} /><div className="min-w-0 flex-1"><RepreneurOpportunityDetail opportunity={opportunity} journey={journey} mode="heading" /></div></div>
        <PursuitJourneyProgress opportunity={opportunity} pursuit={journey} onFullHistory={fullHistory} />
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
          <TabsList aria-label={copy("Pursuit information")} className="max-w-full justify-start gap-5 overflow-x-auto sm:gap-7">
            <TabsTrigger value="overview" className="min-h-11 flex-none">{copy("Overview")}</TabsTrigger>
            <TabsTrigger value="criteria" className="min-h-11 flex-none">{copy("Your criteria")}</TabsTrigger>
            <TabsTrigger value="documents" className="min-h-11 flex-none">{copy("Documents")}</TabsTrigger>
            <TabsTrigger value="journey" className="min-h-11 flex-none">{copy("Journey")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-5">
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} mode="metrics" />
            {opportunity.match_id && actions[opportunity.match_id] === "sign_nda" ? <section className="rounded-lg border border-primary/30 bg-card p-5"><p className="text-xs font-semibold text-primary">{copy("Your action")}</p><h2 className="mt-2 font-semibold">{copy("Your signed NDA is needed")}</h2><p className="mt-2 text-sm text-muted-foreground">{copy("Download the current template, sign it and submit your copy for Re-New review.")}</p><Button className="mt-4" onClick={() => setTab("documents")}>{copy("Open documents")}</Button></section> : null}
            {opportunity.match_id && actions[opportunity.match_id] === "unknown" ? <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{copy("Action status is unavailable right now. Refresh before relying on this view.")}</p> : null}
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} withdrawalPaused={withdrawalPaused} mode="response" />
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} mode="description" />
          </TabsContent>
          <TabsContent value="criteria"><CriteriaPanel criteria={opportunity.criteria_comparison} /></TabsContent>
          <TabsContent value="documents">{opportunity.match_status === "active_pursuit" ? <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} mode="documents" /> : <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{copy("Confidential documents become available only in an authorized active pursuit.")}</section>}</TabsContent>
          <TabsContent value="journey"><PursuitJourneyHistory opportunity={opportunity} pursuit={journey} /></TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
}
