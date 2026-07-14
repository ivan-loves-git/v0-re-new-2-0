"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  MA_SOURCE_TYPE_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
  OPPORTUNITY_VISIBILITY_OPTIONS,
  type MaSourceType,
  type OpportunityStatus,
  type OpportunityVisibility,
  type OpportunityWorkSurfaceMatch,
  type OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"
import {
  deriveOpportunityJourney,
  getOpportunityJourneyLabel,
  OPPORTUNITY_JOURNEY_OPTIONS,
  type OpportunityJourney,
} from "@/lib/utils/opportunity-journey"
import {
  OpportunityJourneyBadge,
  OpportunityStatusBadge,
  OpportunityVisibilityBadge,
} from "@/components/opportunities/opportunity-status-badge"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { useCollectionFilters } from "@/hooks/use-collection-filters"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"

type WorkSurfaceMode = "find" | "groups"
type FreshnessFilter = "all" | "fresh" | "stale" | "no_date"
type ActivePursuitFilter = "all" | "active" | "none"
type OpportunityGroupKey = "draft" | "inventory" | "matching" | "interest" | "active" | "advanced" | "paused" | "closed"

interface OpportunityWorkSurfaceTableProps {
  opportunities: OpportunityWorkSurfaceRecord[]
  mode: WorkSurfaceMode
}

interface PreparedOpportunity {
  opportunity: OpportunityWorkSurfaceRecord
  journey: OpportunityJourney
  groupKey: OpportunityGroupKey
  activeMatch: OpportunityWorkSurfaceMatch | null
  interestedCount: number
  proposedCount: number
  ageDays: number | null
}

const FIND_ITEMS_PER_PAGE = 20
const GROUP_ITEMS_PER_PAGE = 8

const GROUP_CONFIG: Array<{ key: OpportunityGroupKey; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "inventory", label: "Live inventory" },
  { key: "matching", label: "Matching and proposed" },
  { key: "interest", label: "Interest received" },
  { key: "active", label: "Active pursuit" },
  { key: "advanced", label: "Meeting / LOI" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Closed / dropped / archived" },
]

const GROUP_PAGE_DEFAULTS: Record<OpportunityGroupKey, number> = {
  draft: 1,
  inventory: 1,
  matching: 1,
  interest: 1,
  active: 1,
  advanced: 1,
  paused: 1,
  closed: 1,
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatDealSize(opportunity: OpportunityWorkSurfaceRecord) {
  const revenue =
    opportunity.revenue_meur === null || opportunity.revenue_meur === undefined
      ? "Rev -"
      : `Rev ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(opportunity.revenue_meur)}M`
  const ebitda =
    opportunity.ebitda_keur === null || opportunity.ebitda_keur === undefined
      ? "EBITDA -"
      : `EBITDA ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(opportunity.ebitda_keur)}K`
  const headcountValue = opportunity.headcount_range ?? opportunity.headcount
  const headcount = headcountValue === null || headcountValue === undefined ? "HC -" : `HC ${headcountValue}`
  return [revenue, ebitda, headcount]
}

function getAgeDays(value: string | null | undefined) {
  const date = parseDate(value)
  if (!date) return null
  const diff = Date.now() - date.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function getRepreneurName(match: OpportunityWorkSurfaceMatch | null) {
  if (!match?.repreneur) return null
  const name = [match.repreneur.first_name, match.repreneur.last_name].filter(Boolean).join(" ")
  return name || match.repreneur.email || null
}

function getGroupKey(journey: OpportunityJourney): OpportunityGroupKey {
  if (journey === "draft") return "draft"
  if (journey === "live_in_inventory") return "inventory"
  if (journey === "matching" || journey === "proposed") return "matching"
  if (journey === "interest_received") return "interest"
  if (journey === "active_pursuit" || journey === "info_memo_received") return "active"
  if (journey === "intermediary_meeting" || journey === "seller_meeting" || journey === "loi") return "advanced"
  if (journey === "paused") return "paused"
  return "closed"
}

function prepareOpportunity(opportunity: OpportunityWorkSurfaceRecord): PreparedOpportunity {
  const journey = deriveOpportunityJourney({ status: opportunity.status, matches: opportunity.matches })
  const activeMatch = opportunity.matches.find((match) => match.status === "active_pursuit") ?? null

  return {
    opportunity,
    journey,
    groupKey: getGroupKey(journey),
    activeMatch,
    interestedCount: opportunity.matches.filter((match) => match.status === "interested").length,
    proposedCount: opportunity.matches.filter((match) => match.status === "proposed").length,
    ageDays: getAgeDays(opportunity.date_added),
  }
}

function freshnessMatches(item: PreparedOpportunity, freshness: FreshnessFilter) {
  if (freshness === "all") return true
  if (freshness === "no_date") return item.ageDays === null
  if (freshness === "fresh") return item.ageDays !== null && item.ageDays <= 90
  return item.ageDays !== null && item.ageDays > 90 && !item.activeMatch && !["archived", "closed"].includes(item.opportunity.status)
}

function pursuitSummary(item: PreparedOpportunity) {
  const activeName = getRepreneurName(item.activeMatch)
  if (activeName) return activeName
  if (item.interestedCount > 0) return `${item.interestedCount} interested`
  if (item.proposedCount > 0) return `${item.proposedCount} proposed`
  if (item.opportunity.matches.length > 0) return `${item.opportunity.matches.length} match${item.opportunity.matches.length === 1 ? "" : "es"}`
  return "No pursuit"
}

function pursuitSignal(item: PreparedOpportunity) {
  if (item.activeMatch) {
    return {
      label: "Active pursuit",
      className: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100",
    }
  }
  if (item.interestedCount > 0) {
    return {
      label: `${item.interestedCount} interested`,
      className: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100",
    }
  }
  if (item.proposedCount > 0) {
    return {
      label: `${item.proposedCount} proposed`,
      className: "border-transparent bg-accent text-accent-foreground hover:bg-accent",
    }
  }
  if (item.opportunity.matches.length > 0) {
    return {
      label: `${item.opportunity.matches.length} in matching`,
      className: "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100",
    }
  }
  return {
    label: "No pursuit",
    className: "border-transparent bg-slate-100 text-slate-600 hover:bg-slate-100",
  }
}

function OpportunityPursuitBadge({ item }: { item: PreparedOpportunity }) {
  const signal = pursuitSignal(item)
  return <Badge className={signal.className}>{signal.label}</Badge>
}

function OpportunityRow({ item, variant = "full" }: { item: PreparedOpportunity; variant?: "full" | "group" }) {
  const router = useRouter()
  const { opportunity } = item

  if (variant === "group") {
    return (
      <TableRow
        className="cursor-pointer focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        tabIndex={0}
        onClick={() => router.push(`/opportunities/${opportunity.id}`)}
        onMouseEnter={() => router.prefetch(`/opportunities/${opportunity.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            router.push(`/opportunities/${opportunity.id}`)
          }
        }}
      >
        <TableCell className="w-[27%]">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-semibold text-foreground">{opportunity.public_title ?? opportunity.reference}</span>
            <span className="truncate text-xs text-muted-foreground">{opportunity.reference}</span>
          </div>
        </TableCell>
        <TableCell className="w-[20%]">
          <OpportunityJourneyBadge journey={item.journey} />
        </TableCell>
        <TableCell className="w-[10%]">
          <OpportunityStatusBadge status={opportunity.status} />
        </TableCell>
        <TableCell className="w-[16%]">
          <OpportunityVisibilityBadge visibility={opportunity.repreneur_exposure} />
        </TableCell>
        <TableCell className="w-[13%]">
          <span className="block truncate text-sm">{opportunity.sector ?? "-"}</span>
        </TableCell>
        <TableCell className="w-[14%]">
          <OpportunityPursuitBadge item={item} />
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow
      className="cursor-pointer focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      tabIndex={0}
      onClick={() => router.push(`/opportunities/${opportunity.id}`)}
      onMouseEnter={() => router.prefetch(`/opportunities/${opportunity.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          router.push(`/opportunities/${opportunity.id}`)
        }
      }}
    >
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-foreground">{opportunity.public_title ?? opportunity.reference}</span>
          <span className="text-xs text-muted-foreground">{opportunity.reference}</span>
        </div>
      </TableCell>
      <TableCell>
        <OpportunityJourneyBadge journey={item.journey} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <OpportunityStatusBadge status={opportunity.status} />
          <OpportunityVisibilityBadge visibility={opportunity.repreneur_exposure} />
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-[220px]">
          <p className="truncate">{opportunity.sector ?? "-"}</p>
          {opportunity.activity && <p className="truncate text-xs text-muted-foreground">{opportunity.activity}</p>}
        </div>
      </TableCell>
      <TableCell>{opportunity.location ?? "-"}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {formatDealSize(opportunity).map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{formatDate(opportunity.date_added)}</span>
          {item.ageDays !== null && item.ageDays > 90 && !item.activeMatch && opportunity.status === "active" && (
            <Badge variant="outline" className="w-fit">
              stale
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <OpportunityPursuitBadge item={item} />
      </TableCell>
    </TableRow>
  )
}

export function OpportunityWorkSurfaceTable({ opportunities, mode }: OpportunityWorkSurfaceTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [groupPages, setGroupPages] = useState<Record<OpportunityGroupKey, number>>(GROUP_PAGE_DEFAULTS)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<OpportunityGroupKey>>(() => new Set(["closed"]))

  const prepared = useMemo(() => opportunities.map(prepareOpportunity), [opportunities])

  const sectors = useMemo(
    () => Array.from(new Set(opportunities.map((opportunity) => opportunity.sector).filter(Boolean) as string[])).sort(),
    [opportunities],
  )
  const locations = useMemo(
    () => Array.from(new Set(opportunities.map((opportunity) => opportunity.location).filter(Boolean) as string[])).sort(),
    [opportunities],
  )

  const resetPages = () => {
    setCurrentPage(1)
    setGroupPages(GROUP_PAGE_DEFAULTS)
  }

  const filterDefinitions = useMemo<CollectionFilterDefinition[]>(() => [
    { key: "journey", label: "Journey", options: OPPORTUNITY_JOURNEY_OPTIONS },
    { key: "status", label: "Status", options: OPPORTUNITY_STATUS_OPTIONS },
    { key: "visibility", label: "Visibility", options: OPPORTUNITY_VISIBILITY_OPTIONS },
    { key: "sector", label: "Sector", options: sectors.map((sector) => ({ value: sector, label: sector })) },
    { key: "location", label: "Location", options: locations.map((location) => ({ value: location, label: location })) },
    { key: "sourceType", label: "Source", options: MA_SOURCE_TYPE_OPTIONS },
    { key: "freshness", label: "Freshness", options: [
      { value: "fresh", label: "Fresh" },
      { value: "stale", label: "Stale" },
      { value: "no_date", label: "No date" },
    ] },
    { key: "pursuit", label: "Pursuit", options: [
      { value: "active", label: "Active pursuit" },
      { value: "none", label: "No active pursuit" },
    ] },
  ], [locations, sectors])

  const filters = useCollectionFilters({ definitions: filterDefinitions, onChange: resetPages })
  const search = filters.search
  const journeyFilter = (filters.values.journey || "all") as OpportunityJourney | "all"
  const statusFilter = (filters.values.status || "all") as OpportunityStatus | "all"
  const visibilityFilter = (filters.values.visibility || "all") as OpportunityVisibility | "all"
  const sectorFilter = filters.values.sector || "all"
  const locationFilter = filters.values.location || "all"
  const sourceTypeFilter = (filters.values.sourceType || "all") as MaSourceType | "all"
  const freshnessFilter = (filters.values.freshness || "all") as FreshnessFilter
  const activePursuitFilter = (filters.values.pursuit || "all") as ActivePursuitFilter

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()

    return prepared.filter((item) => {
      const { opportunity } = item
      if (journeyFilter !== "all" && item.journey !== journeyFilter) return false
      if (statusFilter !== "all" && opportunity.status !== statusFilter) return false
      if (visibilityFilter !== "all" && opportunity.repreneur_exposure !== visibilityFilter) return false
      if (sectorFilter !== "all" && opportunity.sector !== sectorFilter) return false
      if (locationFilter !== "all" && opportunity.location !== locationFilter) return false
      if (sourceTypeFilter !== "all" && opportunity.source?.source_type !== sourceTypeFilter) return false
      if (activePursuitFilter === "active" && !item.activeMatch) return false
      if (activePursuitFilter === "none" && item.activeMatch) return false
      if (!freshnessMatches(item, freshnessFilter)) return false
      if (!query) return true

      return [
        opportunity.reference,
        opportunity.public_title,
        opportunity.sector,
        opportunity.activity,
        opportunity.location,
        opportunity.source?.firm_name,
        opportunity.source_label,
        getOpportunityJourneyLabel(item.journey),
        pursuitSummary(item),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [
    activePursuitFilter,
    freshnessFilter,
    journeyFilter,
    locationFilter,
    prepared,
    search,
    sectorFilter,
    sourceTypeFilter,
    statusFilter,
    visibilityFilter,
  ])

  const pageStart = (currentPage - 1) * FIND_ITEMS_PER_PAGE
  const totalPages = Math.ceil(filtered.length / FIND_ITEMS_PER_PAGE)
  const paginated = filtered.slice(pageStart, pageStart + FIND_ITEMS_PER_PAGE)

  const setGroupPage = (groupKey: OpportunityGroupKey, page: number) => {
    setGroupPages((current) => ({ ...current, [groupKey]: page }))
  }

  const toggleGroup = (groupKey: OpportunityGroupKey) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const filterBar = (
    <CollectionFilterBar
      search={filters.search}
      onSearchChange={filters.setSearch}
      searchPlaceholder="Search opportunities..."
      definitions={filterDefinitions}
      values={filters.values}
      onFilterChange={filters.setFilter}
      onFilterRemove={filters.removeFilter}
      onClearFilters={filters.clearFilters}
      onReset={filters.reset}
      resultCount={filtered.length}
      totalCount={opportunities.length}
      resultLabel="opportunity"
      className={mode === "find" ? "rounded-none border-x-0 border-t-0" : undefined}
    />
  )

  if (mode === "groups") {
    return (
      <div className="flex flex-col gap-4">
        {filterBar}

        <div className="flex flex-col gap-4">
          {GROUP_CONFIG.map((group) => {
            const items = filtered.filter((item) => item.groupKey === group.key)
            if (items.length === 0) return null

            const isCollapsed = collapsedGroups.has(group.key)
            const page = groupPages[group.key]
            const start = (page - 1) * GROUP_ITEMS_PER_PAGE
            const pageItems = items.slice(start, start + GROUP_ITEMS_PER_PAGE)
            const groupTotalPages = Math.ceil(items.length / GROUP_ITEMS_PER_PAGE)

            return (
              <section key={group.key} className="wave-panel overflow-hidden">
                <button
                  className="flex w-full items-center justify-between bg-muted/25 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold text-foreground">{group.label}</span>
                    <Badge variant="secondary" className="tabular-nums">{items.length}</Badge>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto bg-card">
                    <Table className="min-w-[720px] table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[27%]">Opportunity</TableHead>
                          <TableHead className="w-[20%]">Journey</TableHead>
                          <TableHead className="w-[10%]">Status</TableHead>
                          <TableHead className="w-[16%]">Visibility</TableHead>
                          <TableHead className="w-[13%]">Sector</TableHead>
                          <TableHead className="w-[14%]">Pursuit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageItems.map((item) => (
                          <OpportunityRow key={item.opportunity.id} item={item} variant="group" />
                        ))}
                      </TableBody>
                    </Table>

                    {groupTotalPages > 1 && (
                      <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground">
                          Showing {start + 1}-{Math.min(start + GROUP_ITEMS_PER_PAGE, items.length)} of {items.length}
                        </span>
                        <Pagination className="sm:mx-0 sm:w-auto">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                disabled={page === 1}
                                onClick={() => page > 1 && setGroupPage(group.key, page - 1)}
                                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: groupTotalPages }, (_, index) => index + 1)
                              .filter((candidate) => candidate === 1 || candidate === groupTotalPages || Math.abs(candidate - page) <= 1)
                              .map((candidate, index, shownPages) => {
                                const showEllipsis = index > 0 && candidate - shownPages[index - 1] > 1
                                return (
                                  <span key={candidate} className="flex items-center">
                                    {showEllipsis && <PaginationEllipsis />}
                                    <PaginationItem>
                                      <PaginationLink
                                        onClick={() => setGroupPage(group.key, candidate)}
                                        isActive={page === candidate}
                                        className="cursor-pointer"
                                      >
                                        {candidate}
                                      </PaginationLink>
                                    </PaginationItem>
                                  </span>
                                )
                              })}
                            <PaginationItem>
                              <PaginationNext
                                disabled={page === groupTotalPages}
                                onClick={() => page < groupTotalPages && setGroupPage(group.key, page + 1)}
                                className={page === groupTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {filterBar}

      <div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Journey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sector / activity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Pursuit signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No opportunities match these filters. Remove a filter to widen the list.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => <OpportunityRow key={item.opportunity.id} item={item} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-2 border-t bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {pageStart + 1}-{Math.min(pageStart + FIND_ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <Pagination className="sm:mx-0 sm:w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={currentPage === 1}
                  onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, index, shownPages) => {
                  const showEllipsis = index > 0 && page - shownPages[index - 1] > 1
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsis && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </span>
                  )
                })}
              <PaginationItem>
                <PaginationNext
                  disabled={currentPage === totalPages}
                  onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
