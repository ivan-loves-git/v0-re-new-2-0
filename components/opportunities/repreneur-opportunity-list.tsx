"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { partitionPersonalReviews } from "@/lib/utils/repreneur-personal-review"
import { PersonalReviewHint, RepreneurPersonalReviewControl } from "@/components/opportunities/repreneur-personal-review"
import { DealOrderInfo, DEAL_SECTION_ORDER } from "@/components/opportunities/deal-order-info"
import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { WaveMicroLabel } from "@/components/wave/visual-foundations"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  getOpportunityMatchStatusLabel,
  type RepreneurDealFlowOpportunity,
  type RepreneurOpportunityExposure,
  type RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
  getEbitdaMarginPercentage,
  isStaffRecommended,
  type RepreneurDealDiscoveryFilters,
  type RepreneurDealDiscoveryOpportunity,
} from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"

type RepreneurOpportunityListItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityListProps {
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityListItem[]
  detailHrefByOpportunityId?: Record<string, string>
  detailLabel?: string
  emptyDescription?: string
  readOnly?: boolean
}

function opportunityTitle(opportunity: RepreneurOpportunityListItem) {
  return opportunity.public_title || "Confidential acquisition opportunity"
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "—"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatEbitdaMargin(opportunity: RepreneurOpportunityListItem) {
  const margin = getEbitdaMarginPercentage(opportunity)
  if (margin === null) return "—"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(margin)}%`
}

function formatRecommendationDeadline(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  const value = new Date(expiresAt)
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris", timeZoneName: "short" }).format(value)
}

function filterOptions(
  opportunities: RepreneurOpportunityListItem[],
  valueFor: (opportunity: RepreneurOpportunityListItem) => string | null | undefined,
) {
  const values = new Map<string, string>()
  for (const opportunity of opportunities) {
    const value = valueFor(opportunity)?.trim()
    if (value) values.set(value.toLowerCase(), value)
  }

  return Array.from(values, ([, label]) => ({ value: label, label })).sort((first, second) =>
    first.label.localeCompare(second.label, "fr"),
  )
}

export function canonicalSectorFilterOptions(opportunities: RepreneurOpportunityListItem[]) {
  return filterOptions(opportunities, (opportunity) => opportunity.canonical_sector)
}

export function canonicalGeographyFilterOptions(opportunities: RepreneurOpportunityListItem[]) {
  const optionsByNodeId = new Map<string, {
    value: string
    label: string
    nodeLevel: "country" | "macro_zone" | "region" | null
    parentLabel: string | null
    equivalentValues?: string[]
  }>()
  for (const opportunity of opportunities) {
    if (opportunity.geography_filter_nodes !== undefined) {
      for (const node of opportunity.geography_filter_nodes) {
        optionsByNodeId.set(node.id, {
          value: node.id,
          label: node.label,
          nodeLevel: node.nodeLevel,
          parentLabel: node.parentLabel,
          ...(node.equivalentNodeIds?.length ? { equivalentValues: node.equivalentNodeIds } : {}),
        })
      }
      continue
    }
    // Older callers without a server taxonomy projection retain exact-ID filtering.
    if (!opportunity.geography_node_id || !opportunity.geography_label) continue
    optionsByNodeId.set(opportunity.geography_node_id, {
      value: opportunity.geography_node_id,
      label: opportunity.geography_label,
      nodeLevel: opportunity.geography_node_level ?? null,
      parentLabel: opportunity.geography_parent_label ?? null,
    })
  }

  const options = Array.from(optionsByNodeId.values())
  const duplicateLabels = new Set(
    options
      .map((option) => option.label.trim().toLocaleLowerCase("fr-FR"))
      .filter((label, index, labels) => labels.indexOf(label) !== index),
  )
  const levelRank = { country: 0, macro_zone: 1, region: 2 } as const
  const levelLabel = { country: "Country", macro_zone: "Macro-zone", region: "Region" } as const
  const collator = new Intl.Collator("fr-FR", { sensitivity: "base" })

  return options
    .sort((first, second) => {
      const firstRank = first.nodeLevel ? levelRank[first.nodeLevel] : 3
      const secondRank = second.nodeLevel ? levelRank[second.nodeLevel] : 3
      if (firstRank !== secondRank) return firstRank - secondRank
      const labelOrder = collator.compare(first.label, second.label)
      if (labelOrder !== 0) return labelOrder
      return first.value < second.value ? -1 : first.value > second.value ? 1 : 0
    })
    .map(({ value, label, nodeLevel, parentLabel, equivalentValues }) => {
      const isDuplicate = duplicateLabels.has(label.trim().toLocaleLowerCase("fr-FR"))
      const aliases = equivalentValues?.length ? { equivalentValues } : {}
      if (!isDuplicate) return { value, label, ...aliases }
      const context = nodeLevel
        ? parentLabel ? `${levelLabel[nodeLevel]} · ${parentLabel}` : levelLabel[nodeLevel]
        : parentLabel ? `Parent · ${parentLabel}` : null
      if (!context) return { value, label, ...aliases }
      return { value, label: `${label} — ${context}`, ...aliases }
    })
}

export function normalizeSavedGeographySelection(
  saved: unknown,
  options: { value: string; equivalentValues?: readonly string[] }[],
) {
  if (!Array.isArray(saved)) return []
  const canonicalBySavedId = new Map(options.map((option) => [option.value, option.value]))
  for (const option of options) {
    for (const equivalentId of option.equivalentValues ?? []) {
      if (!canonicalBySavedId.has(equivalentId)) canonicalBySavedId.set(equivalentId, option.value)
    }
  }
  return [...new Set(saved.flatMap((value) =>
    typeof value === "string" && canonicalBySavedId.has(value)
      ? [canonicalBySavedId.get(value)!]
      : []))]
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value]
}

const PREFERENCE_NAMESPACE = "re-new:portal:deal-flow:filter-preferences:v1"
type NumericDealRangeFilterKey = Exclude<keyof RepreneurDealDiscoveryFilters, "geography" | "sector">

function DealDiscoveryToolbar({
  search, onSearchChange, geographyOptions, sectorOptions, filters, onTaxonomyChange, onClear, resultCount, totalCount, preferencesEnabled,
}: {
  search: string
  onSearchChange: (value: string) => void
  geographyOptions: { value: string; label: string }[]
  sectorOptions: { value: string; label: string }[]
  filters: RepreneurDealDiscoveryFilters
  onTaxonomyChange: (key: "geography" | "sector", values: string[]) => void
  onClear: () => void
  resultCount: number
  totalCount: number
  preferencesEnabled: boolean
}) {
  const picker = (key: "geography" | "sector", label: string, options: { value: string; label: string }[]) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">{label} {filters[key].length ? `(${filters[key].length})` : ""}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <fieldset className="grid gap-2"><legend className="text-sm font-medium">{label}</legend>
          {options.map((option) => <div key={option.value} className="flex items-center gap-2"><Checkbox id={`${key}-${option.value}`} checked={filters[key].includes(option.value)} onCheckedChange={() => onTaxonomyChange(key, toggleValue(filters[key], option.value))} /><Label htmlFor={`${key}-${option.value}`} className="font-normal">{option.label}</Label></div>)}
        </fieldset>
      </PopoverContent>
    </Popover>
  )
  return <section className="rounded-lg border bg-card p-3" aria-label="Deal flow filters"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><Input aria-label="Search deal flow" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search title, teaser, reference, geography or sector" className="lg:max-w-sm" /><div className="flex flex-wrap gap-2">{picker("geography", "Geography", geographyOptions)}{picker("sector", "Sectors", sectorOptions)}<Button type="button" variant="ghost" size="sm" onClick={onClear}>Clear filters</Button></div></div><p className="mt-3 border-t pt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{resultCount}</span> deals filtered from {totalCount}. {preferencesEnabled ? "Geography and sector choices are saved in this browser only." : "Staff preview does not read or save repreneur preferences."}</p></section>
}

export function DealRangeFilters({
  filters,
  onChange,
  onClearFilters,
  onReset,
}: {
  filters: RepreneurDealDiscoveryFilters
  onChange: (key: NumericDealRangeFilterKey, value: string) => void
  onClearFilters: () => void
  onReset: () => void
}) {
  const hasNumericFilters = [
    filters.revenueMin,
    filters.revenueMax,
    filters.ebitdaMarginMin,
    filters.employeesMin,
    filters.employeesMax,
  ].some((value) => value.trim().length > 0)

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-sm">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1.5fr]">
        <fieldset className="grid gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Revenue (M EUR)</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Minimum revenue" inputMode="decimal" min="0" type="number" value={filters.revenueMin} onChange={(event) => onChange("revenueMin", event.target.value)} placeholder="Min" />
            <Input aria-label="Maximum revenue" inputMode="decimal" min="0" type="number" value={filters.revenueMax} onChange={(event) => onChange("revenueMax", event.target.value)} placeholder="Max" />
          </div>
        </fieldset>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Minimum EBITDA margin</span>
          <Input aria-label="Minimum EBITDA margin" inputMode="decimal" min="0" type="number" value={filters.ebitdaMarginMin} onChange={(event) => onChange("ebitdaMarginMin", event.target.value)} placeholder="%" />
        </label>
        <fieldset className="grid gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">Employees</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Minimum employees" inputMode="numeric" min="0" type="number" value={filters.employeesMin} onChange={(event) => onChange("employeesMin", event.target.value)} placeholder="Min" />
            <Input aria-label="Maximum employees" inputMode="numeric" min="0" type="number" value={filters.employeesMax} onChange={(event) => onChange("employeesMax", event.target.value)} placeholder="Max" />
          </div>
        </fieldset>
      </div>
      {hasNumericFilters ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" aria-label="Clear Deal Flow filters" onClick={onClearFilters}>Clear filters</Button>
          <Button type="button" variant="ghost" size="sm" aria-label="Reset Deal Flow search and filters" onClick={onReset}>Reset all</Button>
        </div>
      ) : null}
    </div>
  )
}

function DealCard({
  opportunity,
  detailHref,
  detailLabel,
  readOnly,
  compact = false,
}: {
  opportunity: RepreneurOpportunityListItem
  detailHref: string | null
  detailLabel: string
  readOnly: boolean
  compact?: boolean
}) {
  const detailLink = useRef<HTMLAnchorElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (restoreFocus.current && !opportunity.personal_review?.reviewed) {
      detailLink.current?.focus()
      restoreFocus.current = false
    }
  }, [opportunity.personal_review?.reviewed])
  const staffRecommended = isStaffRecommended(opportunity)
  const isDeclined = opportunity.match_status === "declined" || opportunity.match_status === "dropped"
  const lockedForAnotherRepreneur = Boolean(opportunity.is_locked_for_other_repreneur)
  const responsePending = opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit" && !opportunity.interest_expressed_at
  const responseExpired = responsePending && !isRecommendationResponseOpen(opportunity.recommendation_expires_at)
  const responseDeadline = responsePending ? formatRecommendationDeadline(opportunity.recommendation_expires_at) : null

  return (
    <Card className="rounded-lg border bg-card py-0 shadow-none">
      <CardContent
        className={`grid gap-4 p-4 lg:items-center ${
          lockedForAnotherRepreneur
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
            : "lg:grid-cols-[minmax(0,1fr)_auto]"
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
          {staffRecommended && !isDeclined && !opportunity.interest_rejected ? <Badge variant="secondary">Selected by Re-New</Badge> : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">Someone is already positioned</Badge> : null}
          {opportunity.match_status === "interested" ? <Badge variant="outline">{opportunity.interest_rejected ? "Interest not selected by Re-New" : "Interest sent, awaiting Re-New validation"}</Badge> : null}
          {opportunity.match_status === "active_pursuit" ? <Badge variant="outline">Active pursuit</Badge> : null}
          {opportunity.match_status && opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit" ? <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge> : null}
          {responseExpired ? <Badge variant="outline">Response window expired</Badge> : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-col gap-1">
            <p className="truncate text-base font-semibold tracking-tight">{opportunityTitle(opportunity)}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {displayRepreneurOpportunityGeography(opportunity.location)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Added {opportunity.date_added_display ?? "-"}
            </span>
            </div>
          </div>
          {opportunity.teaser_summary ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{opportunity.teaser_summary}</p> : null}
          {!compact ? <dl className="mt-3 grid grid-cols-2 border-y py-2.5 text-sm sm:grid-cols-4">
            <div className="min-w-0 border-r pr-3 sm:px-3 sm:first:pl-0">
              <WaveMicroLabel asChild><dt>Revenue</dt></WaveMicroLabel>
              <dd className="mt-1 font-medium">{formatNumber(opportunity.revenue_meur, "M EUR")}</dd>
            </div>
            <div className="min-w-0 pl-3 sm:border-r sm:px-3">
              <WaveMicroLabel asChild><dt>EBITDA</dt></WaveMicroLabel>
              <dd className="mt-1 font-medium">{formatNumber(opportunity.ebitda_keur, "K EUR")}</dd>
            </div>
            <div className="mt-3 min-w-0 border-r pr-3 sm:mt-0 sm:px-3">
              <WaveMicroLabel asChild><dt>Margin</dt></WaveMicroLabel>
              <dd className="mt-1 font-medium">{formatEbitdaMargin(opportunity)}</dd>
            </div>
            <div className="mt-3 min-w-0 pl-3 sm:mt-0 sm:px-3 sm:pr-0">
              <WaveMicroLabel asChild><dt>Team</dt></WaveMicroLabel>
              <dd className="mt-1 font-medium">{opportunity.headcount_range ?? opportunity.headcount ?? "—"}</dd>
            </div>
          </dl> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}
          </p>
          {responseDeadline ? <p className="mt-1 text-xs text-muted-foreground">{responseExpired ? "Response window expired" : "Respond by"}: {responseDeadline}</p> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:items-end">
          {!readOnly ? <PersonalReviewHint state={opportunity.personal_review} /> : null}
          {!readOnly && opportunity.personal_review?.reviewed ? <RepreneurPersonalReviewControl
            key={`${opportunity.opportunity_id}-${opportunity.personal_review.reviewed}`}
            opportunityId={opportunity.opportunity_id} initialState={opportunity.personal_review}
            onUndo={() => { restoreFocus.current = true }}
          /> : null}
          {isDeclined ? <p className="text-sm text-muted-foreground">You can reconsider this deal from its detail page.</p> : null}
          {detailHref ? (
            <Button asChild variant="outline" className="w-full lg:w-auto">
              <Link ref={detailLink} href={detailHref}>
                {isDeclined ? "Review and reconsider" : detailLabel}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function DealSection({
  sectionKey,
  title,
  description,
  opportunities,
  detailHrefForOpportunity,
  detailLabel,
  readOnly,
  compact,
}: {
  sectionKey: "recommended" | "declined" | "in-progress" | "live-opportunities"
  title: string
  description: string
  opportunities: RepreneurDealDiscoveryOpportunity[]
  detailHrefForOpportunity: (opportunity: RepreneurOpportunityListItem) => string | null
  detailLabel: string
  readOnly: boolean
  compact?: boolean
}) {
  if (opportunities.length === 0) return null

  const headingId = `deal-section-${sectionKey}`
  const groups = partitionPersonalReviews(opportunities)
  const reviewEligible = !readOnly && (sectionKey === "recommended" || sectionKey === "live-opportunities")
  const reviewOrdering = reviewEligible && groups.available
  const ordered = reviewOrdering ? [...groups.unreviewed, ...groups.reviewed] : opportunities
  const rationale = sectionKey === "recommended" ? "Re-New selections come first so you can respond to the team."
    : sectionKey === "in-progress" ? "Your existing interest and active pursuits stay together; personal review marks do not change their priority."
    : sectionKey === "live-opportunities" ? "Explore other available opportunities after your selections and ongoing discussions."
    : "Declined deals stay last and remain available to reconsider."

  return (
    <section className="flex flex-col gap-3 border-t pt-5" aria-labelledby={headingId}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">{title}</h2>
          <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${opportunities.length} ${opportunities.length === 1 ? "deal" : "deals"}`}>{opportunities.length}</span>
          <DealOrderInfo label={`About ${title} ordering`}>
            <p>{rationale}</p>
            {reviewOrdering ? <p className="mt-2">Not reviewed first, reviewed below. Your existing order is kept inside each group.</p> : null}
            {reviewEligible && !groups.available ? <p className="mt-2">Review order is unavailable right now. Your existing deal order is shown.</p> : null}
            <p className="mt-2">Overall order: {DEAL_SECTION_ORDER}</p>
          </DealOrderInfo>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3">
        {ordered.map((opportunity, index) => (
          <Fragment key={opportunity.match_id ?? opportunity.opportunity_id}>
          {reviewOrdering && groups.reviewed.length > 0 && index === groups.unreviewed.length ? <div className="flex items-center gap-3 pt-2">
            <h3 className="shrink-0 text-xs font-medium text-muted-foreground">Reviewed · {groups.reviewed.length}</h3>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div> : null}
          <DealCard
            key={opportunity.match_id ?? opportunity.opportunity_id}
            opportunity={opportunity}
            detailHref={detailHrefForOpportunity(opportunity)}
            detailLabel={detailLabel}
            readOnly={readOnly}
            compact={compact}
          />
          </Fragment>
        ))}
      </div>
    </section>
  )
}

export function RepreneurOpportunityList({
  repreneur,
  opportunities,
  detailHrefByOpportunityId,
  detailLabel = "View detail",
  emptyDescription,
  readOnly = false,
}: RepreneurOpportunityListProps) {
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<RepreneurDealDiscoveryFilters>(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS)
  const [loadedPreferenceKey, setLoadedPreferenceKey] = useState<string | null>(null)
  const [responseClock, setResponseClock] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setResponseClock((value) => value + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const geographyOptions = useMemo(() => canonicalGeographyFilterOptions(opportunities), [opportunities])
  const sectorOptions = useMemo(() => canonicalSectorFilterOptions(opportunities), [opportunities])
  const preferenceKey = repreneur && !readOnly && typeof repreneur.is_demo === "boolean"
    ? `${PREFERENCE_NAMESPACE}:${repreneur.is_demo ? "DEMO" : "REAL"}:${repreneur.id}`
    : null
  useEffect(() => {
    if (!preferenceKey) return
    const allowedSector = new Set(sectorOptions.map((option) => option.value))
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(preferenceKey) ?? "{}")
      const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
      const values = (value: unknown, allowed: Set<string>) => Array.isArray(value)
        ? value.filter((candidate): candidate is string => typeof candidate === "string" && allowed.has(candidate))
        : []
      setFilters((current) => ({ ...current, geography: normalizeSavedGeographySelection(record.geography, geographyOptions), sector: values(record.sector, allowedSector) }))
    } catch {
      setFilters((current) => ({ ...current, geography: [], sector: [] }))
    }
    setLoadedPreferenceKey(preferenceKey)
  }, [geographyOptions, preferenceKey, sectorOptions])
  useEffect(() => {
    if (!preferenceKey || loadedPreferenceKey !== preferenceKey) return
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify({ geography: filters.geography, sector: filters.sector }))
    } catch {
      // Browser storage is optional. The Deal Flow remains usable without it.
    }
  }, [filters.geography, filters.sector, loadedPreferenceKey, preferenceKey])
  const filteredOpportunities = useMemo(
    () => filterRepreneurDeals(opportunities, search, filters),
    [filters, opportunities, search],
  )
  const sections = useMemo(() => {
    const buckets = {
      recommended: [] as RepreneurDealDiscoveryOpportunity[],
      declined: [] as RepreneurDealDiscoveryOpportunity[],
      inProgress: [] as RepreneurDealDiscoveryOpportunity[],
      live: [] as RepreneurDealDiscoveryOpportunity[],
    }
    const usesDealBuckets = filteredOpportunities.some((opportunity) => "deal_bucket" in opportunity && Boolean(opportunity.deal_bucket))
    for (const opportunity of filteredOpportunities) {
      if (opportunity.match_status === "proposed" && !isRecommendationResponseOpen(opportunity.recommendation_expires_at)) {
        buckets.live.push(opportunity)
        continue
      }
      if (usesDealBuckets && "deal_bucket" in opportunity && opportunity.deal_bucket) {
        if (opportunity.deal_bucket === "recommended") buckets.recommended.push(opportunity)
        if (opportunity.deal_bucket === "declined") buckets.declined.push(opportunity)
        if (opportunity.deal_bucket === "in_progress") buckets.inProgress.push(opportunity)
        if (opportunity.deal_bucket === "live") buckets.live.push(opportunity)
        continue
      }
      if (opportunity.match_status === "declined" || opportunity.match_status === "dropped") buckets.declined.push(opportunity)
      else if (isStaffRecommended(opportunity)) buckets.recommended.push(opportunity)
      else if ("is_outside_current_criteria" in opportunity && opportunity.is_outside_current_criteria) buckets.live.push(opportunity)
      else buckets.live.push(opportunity)
    }
    return buckets
  }, [filteredOpportunities, responseClock])
  if (!repreneur) {
    return (
      <Alert>
        <BriefcaseBusiness />
        <AlertTitle>No linked repreneur profile</AlertTitle>
        <AlertDescription>No opportunity data is available for this login.</AlertDescription>
      </Alert>
    )
  }

  if (opportunities.length === 0) {
    return (
      <Alert>
        <BriefcaseBusiness />
        <AlertTitle>No opportunities available</AlertTitle>
        <AlertDescription>
          {emptyDescription ?? `There are no opportunities for ${repreneur.first_name} at the moment.`}
        </AlertDescription>
      </Alert>
    )
  }

  const detailHref = (opportunity: RepreneurOpportunityListItem) =>
    detailHrefByOpportunityId?.[opportunity.match_id ?? opportunity.opportunity_id] ??
    `/portal/deals/${opportunity.match_id ?? opportunity.opportunity_id}`
  const reviewOrderUnavailable = !readOnly && [...sections.recommended, ...sections.live]
    .some((opportunity) => opportunity.personal_review == null)

  return (
    <div className="flex flex-col gap-6">
      <DealDiscoveryToolbar
        search={search}
        onSearchChange={setSearch}
        geographyOptions={geographyOptions}
        sectorOptions={sectorOptions}
        filters={filters}
        onTaxonomyChange={(key, values) => setFilters((current) => ({ ...current, [key]: values }))}
        onClear={() => { setSearch(""); setFilters(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS) }}
        resultCount={filteredOpportunities.length}
        totalCount={opportunities.length}
        preferencesEnabled={Boolean(preferenceKey)}
      />
      <DealRangeFilters
        filters={filters}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
        onClearFilters={() => setFilters(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS)}
        onReset={() => {
          setSearch("")
          setFilters(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS)
        }}
      />

      {filteredOpportunities.length === 0 ? (
        <Alert>
          <BriefcaseBusiness />
          <AlertTitle>No deals match these criteria</AlertTitle>
          <AlertDescription>Clear a filter or try another search term to see the rest of your available deals.</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <p>Recommended → In Progress → Live Opportunities → Declined</p>
            <DealOrderInfo label="How your deal list is ordered">
              <p>Re-New selections first, then ongoing discussions, other live deals and declined deals.</p>
              {!readOnly ? <><p className="mt-2">{reviewOrderUnavailable
                ? "Where review status is available, Reviewed deals move down within Recommended and Live Opportunities. Sections with unavailable review status keep their existing order."
                : "Reviewed deals move down within Recommended and Live Opportunities."} Opening a detail only marks it Viewed and does not move it.</p>
              <p className="mt-2">Not yet viewed means no opening recorded since tracking began. It does not mean newly published. Reviewed means finished for now, not a response or confirmation that you read later updates.</p></> : null}
            </DealOrderInfo>
          </div>
          <DealSection sectionKey="recommended" title="Recommended" description="Selections from Re-New that are waiting for your first response." opportunities={sections.recommended} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
          <DealSection sectionKey="in-progress" title="In Progress" description="Interest sent to Re-New or a validated active pursuit." opportunities={sections.inProgress} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} compact />
          <DealSection sectionKey="live-opportunities" title="Live Opportunities" description="Other live opportunities available for you to review." opportunities={sections.live} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
          <DealSection sectionKey="declined" title="Declined" description="Deals you can safely review and reconsider." opportunities={sections.declined} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} compact />
        </div>
      )}
    </div>
  )
}
