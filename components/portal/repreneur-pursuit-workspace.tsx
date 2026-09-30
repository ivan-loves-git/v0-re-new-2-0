"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { PortalNavigationLink as Link } from "@/components/portal/portal-navigation-link"
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
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"
import { createPortalPreviewHref, type PortalPreviewSection } from "@/lib/portal-preview-routes"
import type { PortalCurrentPursuit, PortalDealAction } from "@/lib/data/current-pursuit"
import type { OwnerCriterionComparison, RepreneurDealFlowOpportunity, RepreneurOpportunityExposure } from "@/lib/types/opportunity"
import { cn } from "@/lib/utils"
import type { RepreneurDealSort } from "@/lib/utils/repreneur-deal-flow"

type Deal = RepreneurDealFlowOpportunity | RepreneurOpportunityExposure
export type SidebarDeal = Pick<RepreneurOpportunityExposure,
  "match_id" | "match_status" | "pursuit_stage" | "public_title" | "canonical_sector" |
  "sector" | "activity" | "geography_label" | "location" | "interest_rejected" | "recommendation_expires_at">
type StatusFilter = "all" | "active" | "awaiting" | "ended"
interface StaffPreviewWorkspaceAdapter {
  sort?: RepreneurDealSort
  repreneurId: string
  workspaceId: string | null
  returnView: PortalPreviewSection
  documentHrefs?: { ndaTemplate?: string; informationMemorandum?: string }
}
const hasOwnAction = (action: PortalDealAction | undefined) => action === "respond" || action === "sign_nda"

function dealName(deal: Pick<RepreneurOpportunityExposure, "public_title">, language: "fr" | "en") {
  return deal.public_title || uiCopy(language, "Confidential acquisition opportunity")
}

function ownerPursuitListHref(query: string, status: StatusFilter) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (status !== "all") params.set("status", status)
  return `/portal/pursuits${params.size ? `?${params}` : ""}`
}

function workspaceStatus(deal: SidebarDeal): StatusFilter {
  if (deal.match_status === "active_pursuit") return "active"
  if (deal.match_status === "proposed" || (deal.match_status === "interested" && !deal.interest_rejected)) return "awaiting"
  return "ended"
}

export function currentWorkspaceAction(deal: SidebarDeal, action: PortalDealAction | undefined, now: string): PortalDealAction {
  return action === "respond" && !isRecommendationResponseOpen(deal.recommendation_expires_at, now)
    ? null : action ?? null
}

export function nextWorkspaceResponseRefreshDelay(
  deals: SidebarDeal[], actions: Record<string, PortalDealAction>, actionNow: string, currentTime: number,
): number | null {
  const nextExpiry = deals.reduce((earliest, deal) => {
    if (actions[deal.match_id] !== "respond" || !deal.recommendation_expires_at) return earliest
    const expiry = Date.parse(deal.recommendation_expires_at)
    return Number.isFinite(expiry) && expiry > Date.parse(actionNow) ? Math.min(earliest, expiry) : earliest
  }, Infinity)
  return Number.isFinite(nextExpiry) ? Math.max(0, nextExpiry - currentTime + 20) : null
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
      {criteria.map((criterion) => <div key={criterion.key} className="grid gap-3 p-5 text-sm sm:grid-cols-2 xl:grid-cols-[minmax(8rem,1fr)_minmax(9rem,1.5fr)_minmax(9rem,1.5fr)_minmax(0,auto)] xl:items-start">
        <h3 className="font-medium sm:col-span-2 xl:col-span-1">{labels[criterion.key]}</h3>
        <div><p className="text-xs text-muted-foreground">{copy("Your target")}</p><p className="mt-1 wrap-break-word">{formatTarget(criterion)}</p></div>
        <div><p className="text-xs text-muted-foreground">{copy("This deal")}</p><p className="mt-1 wrap-break-word">{formatActual(criterion)}</p></div>
        <span className={cn("w-fit rounded-md border px-2 py-1 text-xs sm:col-span-2 xl:col-span-1", criterion.outcome === "within_target" && "border-emerald-300 text-emerald-800 dark:text-emerald-300", criterion.outcome === "outside_target" && "border-amber-300 text-amber-800 dark:text-amber-300")}>{outcomes[criterion.outcome]}</span>
      </div>)}
    </div> : <p className="p-5 text-sm text-muted-foreground">{copy("Criteria are unavailable right now.")}</p>}
  </section>
}

export function RepreneurPursuitWorkspace({ opportunity, deals, actions, journey, responseAsOf, withdrawalPaused = false, initialQuery = "", initialStatus = "all", returnHref = "/portal/deals", staffPreview, staffAssistanceControls, staffDocumentAssistanceControls }: {
  opportunity: Deal | null
  deals: SidebarDeal[]
  actions: Record<string, PortalDealAction>
  journey: PortalCurrentPursuit | null
  /** One server-rendered clock value keeps first render and hydration consistent. */
  responseAsOf: string
  withdrawalPaused?: boolean
  initialQuery?: string
  initialStatus?: StatusFilter
  returnHref?: string
  staffPreview?: StaffPreviewWorkspaceAdapter
  staffAssistanceControls?: ReactNode
  staffDocumentAssistanceControls?: ReactNode
}) {
  const copy = useUiCopy()
  const language = useUiLanguage()
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [mobileListOpen, setMobileListOpen] = useState(!opportunity)
  const [tab, setTab] = useState("overview")
  const [actionNow, setActionNow] = useState(responseAsOf)
  useEffect(() => {
    const refresh = () => setActionNow(new Date().toISOString())
    const onVisibility = () => { if (document.visibilityState === "visible") refresh() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])
  useEffect(() => {
    const delay = nextWorkspaceResponseRefreshDelay(deals, actions, actionNow, Date.now())
    if (delay === null) return
    const timer = window.setTimeout(() => setActionNow(new Date().toISOString()), delay)
    return () => window.clearTimeout(timer)
  }, [actionNow, actions, deals])
  const searched = useMemo(() => filterWorkspaceDeals(deals, query, "all"), [deals, query])
  const visible = useMemo(() => status === "all" ? searched : searched.filter((deal) => workspaceStatus(deal) === status), [searched, status])
  const counts = useMemo(() => ({ all: searched.length, active: searched.filter((deal) => workspaceStatus(deal) === "active").length,
    awaiting: searched.filter((deal) => workspaceStatus(deal) === "awaiting").length,
    ended: searched.filter((deal) => workspaceStatus(deal) === "ended").length }), [searched])
  const selectedId = opportunity?.match_id ?? opportunity?.opportunity_id ?? null
  const currentIndex = visible.findIndex((deal) => deal.match_id === selectedId)
  const previousDeal = currentIndex > 0 ? visible[currentIndex - 1] : null
  const nextDeal = currentIndex >= 0 && currentIndex < visible.length - 1 ? visible[currentIndex + 1] : null
  const hrefFor = (deal: SidebarDeal) => {
    if (staffPreview) return createPortalPreviewHref(staffPreview.repreneurId, deal.match_id, staffPreview.workspaceId, {
      query, status, returnView: staffPreview.returnView, sort: staffPreview.sort,
    })
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (status !== "all") params.set("status", status)
    if (returnHref !== "/portal/deals") params.set("return", returnHref)
    const suffix = params.toString()
    return `/portal/deals/${deal.match_id}${suffix ? `?${suffix}` : ""}`
  }
  const listHrefFor = (nextQuery: string, nextStatus: StatusFilter) => staffPreview
    ? createPortalPreviewHref(staffPreview.repreneurId, undefined, staffPreview.workspaceId, {
        query: nextQuery, status: nextStatus, view: staffPreview.returnView, sort: staffPreview.sort,
      }) : returnHref === "/portal/pursuits" ? ownerPursuitListHref(nextQuery, nextStatus) : returnHref
  const listHref = listHrefFor(query, status)
  const updateFilters = (nextQuery: string, nextStatus: StatusFilter) => {
    setQuery(nextQuery)
    setStatus(nextStatus)
    if (opportunity) return
    const nextHref = listHrefFor(nextQuery, nextStatus)
    if (window.location.pathname === nextHref.split("?")[0]
      && window.location.pathname + window.location.search !== nextHref) {
      window.history.replaceState(null, "", nextHref)
    }
  }
  useEffect(() => {
    if (opportunity) return
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const urlQuery = (params.get("q") ?? "").slice(0, 120)
      const rawStatus = params.get("status")
      const urlStatus: StatusFilter = rawStatus === "active" || rawStatus === "awaiting" || rawStatus === "ended"
        ? rawStatus : "all"
      setQuery(urlQuery)
      setStatus(urlStatus)
    }
    syncFromUrl()
    window.addEventListener("popstate", syncFromUrl)
    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [opportunity])
  const title = opportunity ? dealName(opportunity, language) : null
  const selectedAction = opportunity?.match_id
    ? currentWorkspaceAction(opportunity as SidebarDeal, actions[opportunity.match_id], actionNow)
    : null
  const selectLabel = (deal: SidebarDeal) => deal.match_status === "active_pursuit" && deal.pursuit_stage
    ? pursuitStageUiLabel(deal.pursuit_stage, language)
    : deal.match_status === "interested" && deal.interest_rejected ? copy("Interest not selected by Re-New")
    : deal.match_status ? matchStatusUiLabel(deal.match_status, language) : copy("Live Opportunity")

  const fullHistory = () => {
    setTab("journey")
    window.requestAnimationFrame(() => document.getElementById("journey-view")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return <div className="overflow-hidden rounded-lg border bg-card lg:grid lg:min-h-[calc(100svh-11rem)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]" data-wave-workspace="pursuit">
    <aside className={cn("border-r bg-card lg:flex lg:min-h-0 lg:flex-col", !opportunity || mobileListOpen ? "block" : "hidden")} aria-label={copy("My pursuits")}>
      <div className="space-y-4 border-b p-5">
        <div><h2 className="text-xl font-semibold tracking-tight">{copy("My pursuits")}</h2><p className="mt-1 text-xs text-muted-foreground">{copy("Your Re-New matches and current discussions.")}</p></div>
        <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={copy("Search pursuits")} placeholder={copy("Search pursuits")} value={query} onChange={(event) => updateFilters(event.target.value, status)} className="pl-9" /></div>
        <select aria-label={copy("Pursuit status")} value={status} onChange={(event) => updateFilters(query, event.target.value as StatusFilter)} className="min-h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="all">{copy("All pursuits")} · {counts.all}</option>
          <option value="active">{copy("Active pursuits")} · {counts.active}</option>
          <option value="awaiting">{copy("Awaiting response or review")} · {counts.awaiting}</option>
          <option value="ended">{copy("Ended discussions")} · {counts.ended}</option>
        </select>
      </div>
      <nav className="max-h-[65svh] flex-1 overflow-y-auto lg:max-h-none" aria-label={copy("Pursuits")}>
        {visible.length ? visible.map((deal) => {
          const action = currentWorkspaceAction(deal, actions[deal.match_id], actionNow)
          const selected = deal.match_id === selectedId
          return <Link key={deal.match_id} href={hrefFor(deal)} aria-current={selected ? "page" : undefined} onClick={() => setMobileListOpen(false)} className={cn("flex gap-3 border-b p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary", selected && "bg-primary/8")}>
            <SectorArtwork sector={deal.canonical_sector ?? deal.sector} action={hasOwnAction(action)} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{dealName(deal, language)}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{deal.activity || (deal.sector ? sectorUiLabel(deal.sector, language) : copy("Sector to confirm"))}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="rounded border px-1.5 py-0.5">{selectLabel(deal)}</span>{hasOwnAction(action) ? <span className="font-medium text-primary">● {copy("Your action")}</span> : action === "unknown" ? <span className="text-muted-foreground">{copy("Action status unavailable")}</span> : null}</span></span>
            <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
          </Link>
        }) : <div className="p-5 text-sm text-muted-foreground"><p>{copy(deals.length ? "No pursuits match these filters." : "No Re-New pursuits are available yet.")}</p>
          {deals.length ? <Button variant="link" className="mt-2 p-0" onClick={() => updateFilters("", "all")}>{copy("Clear filters")}</Button> : null}</div>}
      </nav>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground" role="status">{copy("{count} pursuits in this view", { count: visible.length })}</p>
    </aside>
    {opportunity ? <div className={cn("min-w-0 bg-muted/20", mobileListOpen && "hidden lg:block")}>
      <div className="flex min-h-16 items-center justify-between gap-2 border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm"><Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileListOpen(true)}><PanelLeft data-icon="inline-start" />{copy("Pursuits")}</Button><Link href={listHref} className="hidden text-muted-foreground underline-offset-4 hover:underline sm:inline">{copy("My pursuits")}</Link><ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:inline" /><span className="truncate font-medium">{title}</span></div>
        <div className="flex shrink-0 gap-1">
          {previousDeal ? <Button asChild variant="ghost" size="icon"><Link href={hrefFor(previousDeal)} aria-label={copy("Previous pursuit")}><ChevronLeft /></Link></Button>
            : <Button variant="ghost" size="icon" aria-label={copy("Previous pursuit")} disabled><ChevronLeft /></Button>}
          {nextDeal ? <Button asChild variant="ghost" size="icon"><Link href={hrefFor(nextDeal)} aria-label={copy("Next pursuit")}><ChevronRight /></Link></Button>
            : <Button variant="ghost" size="icon" aria-label={copy("Next pursuit")} disabled><ChevronRight /></Button>}
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex items-start gap-4"><SectorArtwork sector={opportunity.canonical_sector ?? opportunity.sector} large action={hasOwnAction(selectedAction)} /><div className="min-w-0 flex-1"><RepreneurOpportunityDetail opportunity={opportunity} journey={journey} readOnly={Boolean(staffPreview)} mode="heading" /></div></div>
        <PursuitJourneyProgress opportunity={opportunity} pursuit={journey} onFullHistory={fullHistory} />
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
          <TabsList aria-label={copy("Pursuit information")} className="grid h-auto w-full grid-cols-2 justify-start gap-x-3 gap-y-0 sm:inline-flex sm:h-10 sm:w-fit sm:gap-7">
            <TabsTrigger value="overview" className="min-h-11 w-full sm:w-auto sm:flex-none">{copy("Overview")}</TabsTrigger>
            <TabsTrigger value="criteria" className="min-h-11 w-full sm:w-auto sm:flex-none">{copy("Your criteria")}</TabsTrigger>
            <TabsTrigger value="documents" className="min-h-11 w-full sm:w-auto sm:flex-none">{copy("Documents")}</TabsTrigger>
            <TabsTrigger value="journey" className="min-h-11 w-full sm:w-auto sm:flex-none">{copy("Journey")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-5">
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} readOnly={Boolean(staffPreview)} mode="metrics" />
            {selectedAction === "sign_nda" ? <section className="rounded-lg border border-primary/30 bg-card p-5"><p className="text-xs font-semibold text-primary">{copy("Your action")}</p><h2 className="mt-2 font-semibold">{copy("Your signed NDA is needed")}</h2><p className="mt-2 text-sm text-muted-foreground">{copy("Download the current template, sign it and submit your copy for Re-New review.")}</p><Button className="mt-4" onClick={() => setTab("documents")}>{copy("Open documents")}</Button></section> : null}
            {selectedAction === "unknown" ? <p role="status" className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{copy("Action status is unavailable right now. Refresh before relying on this view.")}</p> : null}
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} withdrawalPaused={withdrawalPaused} readOnly={Boolean(staffPreview)} staffAssistanceControls={staffPreview ? staffAssistanceControls : null} mode="response" />
            <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} readOnly={Boolean(staffPreview)} mode="description" />
          </TabsContent>
          <TabsContent value="criteria"><CriteriaPanel criteria={opportunity.criteria_comparison} /></TabsContent>
          <TabsContent value="documents">{opportunity.match_status === "active_pursuit" ? <RepreneurOpportunityDetail opportunity={opportunity} journey={journey} readOnly={Boolean(staffPreview)} documentHrefs={staffPreview?.documentHrefs} staffDocumentAssistanceControls={staffPreview ? staffDocumentAssistanceControls : null} mode="documents" /> : <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{copy("Confidential documents become available only in an authorized active pursuit.")}</section>}</TabsContent>
          <TabsContent value="journey"><PursuitJourneyHistory opportunity={opportunity} pursuit={journey} /></TabsContent>
        </Tabs>
      </div>
    </div> : <div className="hidden min-w-0 items-center justify-center bg-muted/20 p-8 lg:flex">
      <div className="max-w-sm text-center"><h3 className="font-semibold">{copy(deals.length ? "Select a pursuit to see its details." : "No Re-New pursuits are available yet.")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{copy(deals.length
          ? "Choose a Re-New match from the list. Opening it does not mark it as reviewed."
          : "When Re-New selects an opportunity for you, it will appear here.")}</p></div>
    </div>}
  </div>
}
