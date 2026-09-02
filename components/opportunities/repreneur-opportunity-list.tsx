"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LockedOpportunityInterestAction } from "@/components/opportunities/locked-opportunity-interest-action"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { WaveMicroLabel } from "@/components/wave/visual-foundations"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"
import {
  getOpportunityMatchRecommendationLabel,
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
  return opportunity.public_title || opportunity.sector || "Opportunity"
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

function relevanceGrade(opportunity: RepreneurOpportunityListItem) {
  return "relevance_grade" in opportunity
    ? opportunity.relevance_grade
    : null
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
  const optionsByNodeId = new Map<string, string>()
  for (const opportunity of opportunities) {
    if (!opportunity.geography_node_id || !opportunity.geography_label) continue
    optionsByNodeId.set(opportunity.geography_node_id, opportunity.geography_label)
  }

  return Array.from(optionsByNodeId, ([value, label]) => ({ value, label })).sort((first, second) =>
    first.label.localeCompare(second.label, "fr"),
  )
}

function discoveryFilterDefinitions(opportunities: RepreneurOpportunityListItem[]): CollectionFilterDefinition[] {
  return [
    {
      key: "geography",
      label: "Geography",
      options: canonicalGeographyFilterOptions(opportunities),
    },
    {
      key: "sector",
      label: "Sector",
      options: canonicalSectorFilterOptions(opportunities),
    },
  ]
}

export function DealRangeFilters({
  filters,
  onChange,
  onClearFilters,
  onReset,
}: {
  filters: RepreneurDealDiscoveryFilters
  onChange: (key: keyof RepreneurDealDiscoveryFilters, value: string) => void
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
  position,
  compact = false,
}: {
  opportunity: RepreneurOpportunityListItem
  detailHref: string | null
  detailLabel: string
  readOnly: boolean
  position: number
  compact?: boolean
}) {
  const staffRecommended = isStaffRecommended(opportunity)
  const isDeclined = opportunity.match_status === "declined" || opportunity.match_status === "dropped"
  const publicRelevance = relevanceGrade(opportunity)
  const lockedForAnotherRepreneur = Boolean(opportunity.is_locked_for_other_repreneur)

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
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-label={`Position ${position}`}>
              {String(position).padStart(2, "0")}
            </span>
          {staffRecommended && !isDeclined ? <Badge variant="secondary">Selected by Re-New</Badge> : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">Someone is already positioned</Badge> : null}
          {opportunity.match_status === "interested" ? <Badge variant="outline">Interest sent, awaiting Re-New validation</Badge> : null}
          {opportunity.match_status === "active_pursuit" ? <Badge variant="outline">Active pursuit</Badge> : null}
          {opportunity.match_status && opportunity.match_status !== "interested" && opportunity.match_status !== "active_pursuit" ? <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge> : null}
          {publicRelevance ? <Badge variant="outline">Relevance: {getOpportunityMatchRecommendationLabel(publicRelevance)}</Badge> : null}
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
            <span className="font-mono text-foreground">{opportunity.reference}</span>
            <span aria-hidden="true"> · </span>
            {opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:items-end">
          {lockedForAnotherRepreneur || !opportunity.match_id ? (
            <LockedOpportunityInterestAction
              opportunityId={opportunity.opportunity_id}
              interestRecorded={Boolean(opportunity.interest_expressed_at)}
              notificationSent={Boolean(opportunity.interest_notification_sent_at)}
              lockedForAnotherRepreneur={lockedForAnotherRepreneur}
              readOnly={readOnly}
            />
          ) : null}
          {isDeclined ? <p className="text-sm text-muted-foreground">You can reconsider this deal from its detail page.</p> : null}
          {detailHref ? (
            <Button asChild variant="outline" className="w-full lg:w-auto">
              <Link href={detailHref}>
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

function DealSection({
  title,
  description,
  opportunities,
  detailHrefForOpportunity,
  detailLabel,
  readOnly,
  compact,
}: {
  title: string
  description: string
  opportunities: RepreneurDealDiscoveryOpportunity[]
  detailHrefForOpportunity: (opportunity: RepreneurOpportunityListItem) => string | null
  detailLabel: string
  readOnly: boolean
  compact?: boolean
}) {
  if (opportunities.length === 0) return null

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`deal-section-${title}`}>
      <div className="flex flex-col gap-1">
        <h2 id={`deal-section-${title}`} className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3">
        {opportunities.map((opportunity, index) => (
          <DealCard
            key={opportunity.match_id ?? opportunity.opportunity_id}
            opportunity={opportunity}
            detailHref={detailHrefForOpportunity(opportunity)}
            detailLabel={detailLabel}
            readOnly={readOnly}
            position={index + 1}
            compact={compact}
          />
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
  const definitions = useMemo(() => discoveryFilterDefinitions(opportunities), [opportunities])
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
  }, [filteredOpportunities])
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

  return (
    <div className="flex flex-col gap-6">
      <CollectionFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, teaser, Re-New ref, geography, sector, or metrics"
        definitions={definitions}
        values={filters}
        onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
        onFilterRemove={(key) => setFilters((current) => ({ ...current, [key]: "" }))}
        onClearFilters={() => setFilters(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS)}
        onReset={() => {
          setSearch("")
          setFilters(EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS)
        }}
        resultCount={filteredOpportunities.length}
        totalCount={opportunities.length}
        resultLabel="deal"
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
          <DealSection title="Recommended" description="Selections from Re-New that are waiting for your first response." opportunities={sections.recommended} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
          <DealSection title="Declined" description="Deals you can safely review and reconsider." opportunities={sections.declined} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} compact />
          <DealSection title="In Progress" description="Interest sent to Re-New or a validated active pursuit." opportunities={sections.inProgress} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} compact />
          <DealSection title="Live Opportunities" description="Other live opportunities available for you to review." opportunities={sections.live} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
        </div>
      )}
    </div>
  )
}
