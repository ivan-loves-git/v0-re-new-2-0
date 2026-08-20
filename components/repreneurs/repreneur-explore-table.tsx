"use client"

import { useState, useMemo, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { formatDistance } from "date-fns"
import { subDays } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { StatusBadge } from "./status-badge"
import { Badge } from "@/components/ui/badge"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import type { Repreneur, LifecycleStatus, JourneyStage, PersonaType } from "@/lib/types/repreneur"
import { exportRepreneursToCSV, type EnrichedRepreneur } from "@/lib/utils/csv-export"
import { getExportEnrichmentData } from "@/lib/actions/repreneurs"
import { DECLINE_REASON_OPTIONS } from "@/lib/types/repreneur"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import { useCollectionFilters } from "@/hooks/use-collection-filters"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"
import { initialDateLabel, useHydratedNow } from "@/hooks/use-hydrated-now"

const ITEMS_PER_PAGE = 20

type SortField = "name" | "email" | "status" | "who" | "when" | "assessment" | "journey" | "created_at"
type SortDirection = "asc" | "desc"

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
]

const SCORE_RANGES = [
  { value: "all", label: "Any score" },
  { value: "60", label: "60+" },
  { value: "100", label: "100+" },
  { value: "140", label: "140+" },
]

const JOURNEY_OPTIONS: { value: JourneyStage; label: string }[] = [
  { value: "explorer", label: "Explorer" },
  { value: "learner", label: "Learner" },
  { value: "ready", label: "Ready" },
  { value: "execution", label: "Execution" },
  { value: "post_acquisition", label: "Post-acquisition" },
]

const PERSONA_OPTIONS: { value: PersonaType; label: string }[] = [
  { value: "first_time_buyer", label: "First-time buyer" },
  { value: "serial_acquirer", label: "Serial acquirer" },
  { value: "corporate_spinoff", label: "Corporate spinoff" },
  { value: "family_succession", label: "Family succession" },
]

const RECOMMENDATION_OPTIONS = [
  { value: "deal_flow", label: "Deal flow" },
  { value: "priority_interview", label: "Priority interview" },
  { value: "interview", label: "Interview" },
  { value: "starter_pack", label: "Starter pack" },
]

function getScoreColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground/60"
  if (score >= 70) return "text-emerald-700"
  if (score >= 50) return "text-blue-700"
  if (score >= 30) return "text-amber-700"
  return "text-muted-foreground"
}

interface RepreneurWithAssessment extends Repreneur {
  assessment_decision?: string | null
  assessment_pending?: boolean
}

interface RepreneurExploreTableProps {
  repreneurs: RepreneurWithAssessment[]
}

export interface RepreneurExploreTableRef {
  triggerExport: () => void
}

export const RepreneurExploreTable = forwardRef<RepreneurExploreTableRef, RepreneurExploreTableProps>(
  function RepreneurExploreTable({ repreneurs }, ref) {
    const router = useRouter()
    const now = useHydratedNow()

    // Sort state
    const [sortField, setSortField] = useState<SortField>("created_at")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)

    // Extract unique sources
    const sources = useMemo(() => {
      const uniqueSources = new Set<string>()
      repreneurs.forEach((r) => {
        if (r.source) uniqueSources.add(r.source)
      })
      return Array.from(uniqueSources).sort()
    }, [repreneurs])

    const filterDefinitions = useMemo<CollectionFilterDefinition[]>(() => [
      { key: "status", label: "Status", options: [
        { value: "lead", label: "Lead" },
        { value: "qualified", label: "Qualified" },
        { value: "client", label: "Client" },
        { value: "to_reactivate", label: "To be reactivated" },
        { value: "declined", label: "Declined" },
        { value: "rejected", label: "Rejected" },
      ] },
      { key: "source", label: "Source", options: sources.map((source) => ({ value: source, label: source })) },
      { key: "added", label: "Added", options: DATE_RANGES.filter((option) => option.value !== "all") },
      { key: "score", label: "Minimum score", options: SCORE_RANGES.filter((option) => option.value !== "all") },
      { key: "journey", label: "Journey", options: JOURNEY_OPTIONS },
      { key: "persona", label: "Persona", options: PERSONA_OPTIONS },
      { key: "recommendation", label: "Recommendation", options: RECOMMENDATION_OPTIONS },
    ], [sources])

    const filters = useCollectionFilters({ definitions: filterDefinitions, onChange: () => setCurrentPage(1) })
    const search = filters.search
    const statusFilter = (filters.values.status || "all") as LifecycleStatus | "all"
    const sourceFilter = filters.values.source || ""
    const dateRange = filters.values.added || "all"
    const minScore = filters.values.score || "all"
    const journeyFilter = (filters.values.journey || "all") as JourneyStage | "all"
    const personaFilter = (filters.values.persona || "all") as PersonaType | "all"
    const recommendationFilter = filters.values.recommendation || ""

    // Filtered data
    const filtered = useMemo(() => {
      return repreneurs.filter((r) => {
        if (search) {
          const q = search.toLowerCase()
          const name = `${r.first_name} ${r.last_name}`.toLowerCase()
          const email = r.email.toLowerCase()
          if (!name.includes(q) && !email.includes(q)) return false
        }

        if (statusFilter !== "all" && r.lifecycle_status !== statusFilter) return false

        if (sourceFilter && r.source !== sourceFilter) return false

        if (minScore !== "all") {
          const who = r.who_score ?? r.tier1_score ?? 0
          const when = r.when_score ?? 0
          if (who + when < parseInt(minScore)) return false
        }

        if (dateRange !== "all" && now !== null) {
          const days = parseInt(dateRange)
          const cutoff = subDays(new Date(now), days)
          if (new Date(r.created_at) < cutoff) return false
        }

        if (journeyFilter !== "all" && r.journey_stage !== journeyFilter) return false

        if (personaFilter !== "all" && r.persona !== personaFilter) return false

        if (recommendationFilter && r.recommendation !== recommendationFilter) return false

        return true
      })
    }, [
      repreneurs,
      search,
      statusFilter,
      sourceFilter,
      dateRange,
      minScore,
      journeyFilter,
      personaFilter,
      recommendationFilter,
      now,
    ])

    // Sorted data
    const sorted = useMemo(() => {
      return [...filtered].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
          case "name":
            comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "fr")
            break
          case "email":
            comparison = a.email.localeCompare(b.email, "fr")
            break
          case "status":
            comparison = a.lifecycle_status.localeCompare(b.lifecycle_status, "fr")
            break
          case "who":
            comparison = (a.who_score ?? a.tier1_score ?? 0) - (b.who_score ?? b.tier1_score ?? 0)
            break
          case "when":
            comparison = (a.when_score ?? 0) - (b.when_score ?? 0)
            break
          case "assessment": {
            const decisionOrder: Record<string, number> = {
              engagement: 3,
              engagement_sous_conditions: 2,
              non_engagement: 1,
            }
            const aOrder = a.assessment_decision
              ? decisionOrder[a.assessment_decision] || 0
              : a.assessment_pending
                ? -1
                : -2
            const bOrder = b.assessment_decision
              ? decisionOrder[b.assessment_decision] || 0
              : b.assessment_pending
                ? -1
                : -2
            comparison = aOrder - bOrder
            break
          }
          case "journey":
            comparison = (a.journey_stage ?? "").localeCompare(b.journey_stage ?? "", "fr")
            break
          case "created_at":
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            break
        }
        return sortDirection === "asc" ? comparison : -comparison
      })
    }, [filtered, sortField, sortDirection])

    useImperativeHandle(
      ref,
      () => ({
        triggerExport: async () => {
          const {
            interviewCounts,
            interviewBooked,
            firstInterviewAt,
            firstContactAt,
            offerData,
            firstOffer,
            secondOffer,
          } = await getExportEnrichmentData()
          const enriched: EnrichedRepreneur[] = sorted.map((r) => ({
            ...r,
            interview_count: interviewCounts[r.id] || 0,
            interview_booked: interviewBooked[r.id] ? "Yes" : "No",
            offer_names: offerData[r.id]?.names || "",
            offer_status: offerData[r.id]?.status || "",
            decline_reason: r.decline_reason_category
              ? DECLINE_REASON_OPTIONS.find((o) => o.value === r.decline_reason_category)?.label ||
                r.decline_reason_category
              : "",
            application_date: r.created_at ? r.created_at.slice(0, 10) : "",
            first_contact_at: firstContactAt[r.id] || "",
            first_interview_at: firstInterviewAt[r.id] || "",
            first_offer_at: firstOffer[r.id]?.offeredAt || "",
            first_offer_status: firstOffer[r.id]?.status || "",
            first_offer_accepted_at: firstOffer[r.id]?.acceptedAt || "",
            first_offer_declined_at: firstOffer[r.id]?.declinedAt || "",
            second_offer_at: secondOffer[r.id]?.offeredAt || "",
            second_offer_status: secondOffer[r.id]?.status || "",
            second_offer_accepted_at: secondOffer[r.id]?.acceptedAt || "",
            second_offer_declined_at: secondOffer[r.id]?.declinedAt || "",
          }))
          exportRepreneursToCSV(enriched, "repreneurs.csv")
        },
      }),
      [sorted],
    )

    // Pagination
    const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginated = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const handleSort = (field: SortField) => {
      if (sortField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("desc")
      }
      setCurrentPage(1)
    }

    const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <ArrowUpDown className="ml-1 size-3 text-muted-foreground/60" />
      return sortDirection === "asc" ? <ArrowUp className="size-3 ml-1" /> : <ArrowDown className="size-3 ml-1" />
    }

    const SortableHead = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
      <TableHead
        className={className}
        aria-sort={sortField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          className="flex h-full w-full items-center rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => handleSort(field)}
        >
          {label}
          <SortIcon field={field} />
        </button>
      </TableHead>
    )

    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <CollectionFilterBar
          search={filters.search}
          onSearchChange={filters.setSearch}
          searchPlaceholder="Search repreneurs..."
          definitions={filterDefinitions}
          values={filters.values}
          onFilterChange={filters.setFilter}
          onFilterRemove={filters.removeFilter}
          onClearFilters={filters.clearFilters}
          onReset={filters.reset}
          resultCount={sorted.length}
          totalCount={repreneurs.length}
          resultLabel="repreneur"
          className="rounded-none border-x-0 border-t-0"
        />

        <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" label="Name" />
                  <SortableHead field="email" label="Email" />
                  <SortableHead field="status" label="Status" className="w-[100px]" />
                  <SortableHead field="who" label="WHO" className="w-[80px]" />
                  <SortableHead field="when" label="WHEN" className="w-[80px]" />
                  <SortableHead field="assessment" label="Assessment" className="w-[100px]" />
                  <SortableHead field="journey" label="Journey" className="w-[110px]" />
                  <SortableHead field="created_at" label="Added" className="w-[110px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No repreneurs match these filters. Remove a filter to widen the list.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      tabIndex={0}
                      onClick={() => router.push(`/repreneurs/${r.id}`)}
                      onMouseEnter={() => router.prefetch(`/repreneurs/${r.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          router.push(`/repreneurs/${r.id}`)
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span aria-hidden="true">
                            <RepreneurAvatar
                              repreneurId={r.id}
                              avatarUrl={r.avatar_url}
                              firstName={r.first_name}
                              lastName={r.last_name}
                              size="sm"
                            />
                          </span>
                          <span className="truncate font-semibold text-foreground">
                            {r.first_name} {r.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.email}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.lifecycle_status} />
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(r.who_score ?? r.tier1_score)}`}>
                          {r.who_score ?? r.tier1_score ?? "\u2014"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(r.when_score)}`}>{r.when_score ?? "\u2014"}</span>
                      </TableCell>
                      <TableCell>
                        {r.assessment_pending ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Pending
                          </Badge>
                        ) : r.assessment_decision === "engagement" ? (
                          <Badge className="border-0 bg-emerald-50 text-xs text-emerald-700">Pass</Badge>
                        ) : r.assessment_decision === "engagement_sous_conditions" ? (
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-0">Review</Badge>
                        ) : r.assessment_decision === "non_engagement" ? (
                          <Badge className="text-xs bg-red-100 text-red-700 border-0">Fail</Badge>
                        ) : (
                          <span className="text-muted-foreground/60">{"\u2014"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.journey_stage ? (
                          <JourneyStageBadge stage={r.journey_stage} showIcon={false} showTooltip={false} />
                        ) : (
                          <span className="text-xs text-muted-foreground/60">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {now === null
                          ? initialDateLabel(r.created_at)
                          : formatDistance(new Date(r.created_at), new Date(now), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
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
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (page === 1 || page === totalPages) return true
                    if (Math.abs(page - currentPage) <= 1) return true
                    return false
                  })
                  .map((page, index, arr) => {
                    const showEllipsis = index > 0 && page - arr[index - 1] > 1
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
  },
)
