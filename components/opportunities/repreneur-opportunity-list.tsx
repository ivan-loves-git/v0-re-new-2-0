"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { LockedOpportunityInterestAction } from "@/components/opportunities/locked-opportunity-interest-action"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { WaveMicroLabel } from "@/components/wave/visual-foundations"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityNdaStatusLabel,
  getOpportunityPursuitStageLabel,
  type RepreneurDealFlowOpportunity,
  type RepreneurOpportunityExposure,
  type RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
  getEbitdaMarginPercentage,
  isStaffRecommended,
  partitionRepreneurDeals,
  type RepreneurDealDiscoveryFilters,
  type RepreneurDealDiscoveryOpportunity,
} from "@/lib/utils/repreneur-deal-discovery"
import { displayRepreneurOpportunityGeography } from "@/lib/utils/repreneur-opportunity-geography"

type RepreneurOpportunityListItem = RepreneurOpportunityExposure | RepreneurDealFlowOpportunity

interface RepreneurOpportunityListProps {
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityListItem[]
  detailHrefForOpportunity?: (opportunity: RepreneurOpportunityListItem) => string | null
  detailLabel?: string
  emptyDescription?: string
  readOnly?: boolean
}

function opportunityTitle(opportunity: RepreneurOpportunityListItem) {
  return opportunity.public_title || opportunity.sector || "Opportunity"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
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
    if (value) values.set(value.toLocaleLowerCase(), value)
  }

  return Array.from(values, ([value, label]) => ({ value, label })).sort((first, second) =>
    first.label.localeCompare(second.label),
  )
}

function discoveryFilterDefinitions(opportunities: RepreneurOpportunityListItem[]): CollectionFilterDefinition[] {
  return [
    { key: "geography", label: "Geography", options: filterOptions(opportunities, (opportunity) => opportunity.location) },
    {
      key: "sector",
      label: "Sector",
      options: filterOptions(opportunities, (opportunity) => opportunity.sector ?? opportunity.activity),
    },
    {
      key: "revenue",
      label: "Revenue",
      options: [
        { value: "under-first", label: "Under €1M" },
        { value: "first-to-second", label: "€1M–€3M" },
        { value: "second-to-third", label: "€3M–€5M" },
        { value: "over-third", label: "Over €5M" },
        { value: "unknown", label: "Not available" },
      ],
    },
    {
      key: "ebitdaMargin",
      label: "EBITDA margin",
      options: [
        { value: "under-first", label: "Under 10%" },
        { value: "first-to-second", label: "10%–20%" },
        { value: "second-to-third", label: "20%–30%" },
        { value: "over-third", label: "Over 30%" },
        { value: "unknown", label: "Not available" },
      ],
    },
    {
      key: "employees",
      label: "Employees",
      options: [
        { value: "under-first", label: "Under 10" },
        { value: "first-to-second", label: "10–50" },
        { value: "second-to-third", label: "51–250" },
        { value: "over-third", label: "Over 250" },
        { value: "unknown", label: "Not available" },
      ],
    },
  ]
}

function DealCard({
  opportunity,
  detailHref,
  detailLabel,
  readOnly,
  position,
}: {
  opportunity: RepreneurOpportunityListItem
  detailHref: string | null
  detailLabel: string
  readOnly: boolean
  position: number
}) {
  const staffRecommended = isStaffRecommended(opportunity)
  const isDeclined = opportunity.match_status === "declined"
  const publicRelevance = relevanceGrade(opportunity)
  const lockedForAnotherRepreneur = Boolean(opportunity.is_locked_for_other_repreneur)

  return (
    <Card className="rounded-lg border bg-card py-0 shadow-none">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-label={`Position ${position}`}>
              {String(position).padStart(2, "0")}
            </span>
          {staffRecommended && !isDeclined ? <Badge variant="secondary">Selected by Re-New</Badge> : null}
          {lockedForAnotherRepreneur ? <Badge variant="outline">Someone is already positioned</Badge> : null}
          {opportunity.match_status ? <Badge variant="outline">{getOpportunityMatchStatusLabel(opportunity.match_status)}</Badge> : null}
          {opportunity.pursuit_stage ? <Badge variant="outline">{getOpportunityPursuitStageLabel(opportunity.pursuit_stage)}</Badge> : null}
          {opportunity.match_status === "active_pursuit" ? <Badge variant="outline">{getOpportunityNdaStatusLabel(opportunity.nda_status ?? "not_required")}</Badge> : null}
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
              Added {formatDate(opportunity.date_added)}
            </span>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 border-y py-2.5 text-sm sm:grid-cols-4">
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
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{opportunity.reference}</span>
            <span aria-hidden="true"> · </span>
            {opportunity.sector ?? opportunity.activity ?? "Sector to confirm"}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
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
}: {
  title: string
  description: string
  opportunities: RepreneurDealDiscoveryOpportunity[]
  detailHrefForOpportunity: (opportunity: RepreneurOpportunityListItem) => string | null
  detailLabel: string
  readOnly: boolean
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
          />
        ))}
      </div>
    </section>
  )
}

export function RepreneurOpportunityList({
  repreneur,
  opportunities,
  detailHrefForOpportunity,
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
  const sections = useMemo(() => partitionRepreneurDeals(filteredOpportunities), [filteredOpportunities])
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
    detailHrefForOpportunity?.(opportunity) ??
    `/portal/deals/${opportunity.match_id ?? opportunity.opportunity_id}`

  return (
    <div className="flex flex-col gap-6">
      <CollectionFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, Re-New ref, geography, sector, or metrics"
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

      {filteredOpportunities.length === 0 ? (
        <Alert>
          <BriefcaseBusiness />
          <AlertTitle>No deals match these criteria</AlertTitle>
          <AlertDescription>Clear a filter or try another search term to see the rest of your available deals.</AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <DealSection title="Recommended by Re-New" description="The Re-New team recommends starting with these opportunities." opportunities={sections.staffRecommended} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
          <DealSection title="Current deals" description="Other live opportunities available for you to review." opportunities={sections.remaining} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
          {sections.outsideCurrentCriteria.length > 0 ? (
            <>
              <Separator />
              <DealSection title="Outside your current criteria" description="These deals remain available if you would like to explore beyond your current criteria." opportunities={sections.outsideCurrentCriteria} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
            </>
          ) : null}
          <DealSection title="Declined deals" description="You can revisit a past decision whenever your priorities change." opportunities={sections.declined} detailHrefForOpportunity={detailHref} detailLabel={detailLabel} readOnly={readOnly} />
        </div>
      )}
    </div>
  )
}
