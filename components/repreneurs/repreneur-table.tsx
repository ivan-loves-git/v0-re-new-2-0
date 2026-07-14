"use client"

import { useState, useMemo, memo, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Target,
  Package,
  ChevronDown,
  ChevronRight,
  Compass,
  Map,
  Flag,
  Rocket,
  Crown,
  CalendarCheck,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "./status-badge"
import { Badge } from "@/components/ui/badge"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { Repreneur, LifecycleStatus, JourneyStage, PersonaType } from "@/lib/types/repreneur"
import { exportRepreneursToCSV, type EnrichedRepreneur } from "@/lib/utils/csv-export"
import { getExportEnrichmentData } from "@/lib/actions/repreneurs"
import { DECLINE_REASON_OPTIONS } from "@/lib/types/repreneur"
import { deriveJourneyStage, countMilestones, extractMilestones } from "@/lib/utils/journey-derivation"
import { getStageConfig } from "@/lib/constants/tier-config"
import { MissingFieldsBadge } from "./missing-fields-badge"
import { NeedsCompletionBadge } from "./needs-completion-badge"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"
import { useCollectionFilters } from "@/hooks/use-collection-filters"

const ITEMS_PER_PAGE = 8

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
  /** True when an `interview` activity with a future event_date exists for this repreneur. */
  has_scheduled_interview?: boolean
}

interface RepreneurTableProps {
  repreneurs: RepreneurWithOffers[]
  viewMode?: "flat" | "grouped"
}

type SortField = "name" | "email" | "created_at" | "status_column"
type SortDirection = "asc" | "desc"

interface GroupSortState {
  field: SortField
  direction: SortDirection
}

const STATUS_ORDER: LifecycleStatus[] = ["lead", "qualified", "client", "to_reactivate", "declined", "rejected"]

const STATUS_LABELS: Record<LifecycleStatus, string> = {
  lead: "Leads",
  qualified: "Qualified",
  client: "Clients",
  to_reactivate: "To be reactivated",
  declined: "Declined",
  rejected: "Rejected",
}

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
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

const AssessmentBadge = memo(function AssessmentBadge({
  decision,
  pending,
}: {
  decision: string | null | undefined
  pending?: boolean
}) {
  if (pending) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Pending
      </Badge>
    )
  }
  if (!decision) {
    return <span className="text-sm text-muted-foreground/60">—</span>
  }
  switch (decision) {
    case "engagement":
      return <Badge className="border-0 bg-emerald-50 text-xs text-emerald-700">Pass</Badge>
    case "engagement_sous_conditions":
      return <Badge className="text-xs bg-amber-100 text-amber-700 border-0">Review</Badge>
    case "non_engagement":
      return <Badge className="text-xs bg-red-100 text-red-700 border-0">Fail</Badge>
    default:
      return <span className="text-sm text-muted-foreground/60">—</span>
  }
})

// Display combined WHO+WHEN score with tooltip breakdown
const ScoreDisplay = memo(function ScoreDisplay({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const whoScore = (repreneur as any).who_score ?? repreneur.tier1_score
  const whenScore = (repreneur as any).when_score
  const combined = (whoScore ?? 0) + (whenScore ?? 0)

  if (whoScore === null && whenScore === null) {
    return <span className="text-sm text-muted-foreground/60">N/A</span>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Combined score ${combined}. WHO ${whoScore ?? "not scored"}, WHEN ${whenScore ?? "not scored"}`}
            className="flex items-center gap-1 rounded-sm cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Target className="size-4 text-muted-foreground/60" />
            <span className="font-medium">{combined}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">WHO:</span>
              <span className="font-medium">{whoScore ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">WHEN:</span>
              <span className="font-medium">{whenScore ?? "—"}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

const OfferDisplay = memo(function OfferDisplay({ offers }: { offers: string[] | undefined }) {
  if (!offers || offers.length === 0) {
    return <span className="text-sm text-muted-foreground/60">No offers</span>
  }

  // Show first offer + count of additional offers
  const firstOffer = offers[0]
  const additionalCount = offers.length - 1

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className="text-xs">
        <Package className="size-3 mr-1" />
        {firstOffer}
      </Badge>
      {additionalCount > 0 && <span className="text-xs text-muted-foreground">+{additionalCount}</span>}
    </div>
  )
})

const JourneyDisplay = memo(function JourneyDisplay({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const milestones = extractMilestones(repreneur)
  const milestoneCount = countMilestones(milestones)
  const derivedStage = deriveJourneyStage(milestones)
  const stageConfig = getStageConfig(derivedStage)

  const StageIcon =
    derivedStage === "explorer"
      ? Compass
      : derivedStage === "learner"
        ? Map
        : derivedStage === "ready"
          ? Flag
          : derivedStage === "execution"
            ? Rocket
            : Crown

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`gap-1 text-xs ${stageConfig.bgColor} ${stageConfig.color} border-0`}>
        <StageIcon className="size-3" />
        {stageConfig.label}
      </Badge>
      <span className="text-xs tabular-nums text-muted-foreground">{milestoneCount}/17</span>
    </div>
  )
})

const DEFAULT_GROUP_SORT: GroupSortState = {
  field: "created_at",
  direction: "desc",
}

export interface RepreneurTableRef {
  triggerExport: () => void
}

export const RepreneurTable = forwardRef<RepreneurTableRef, RepreneurTableProps>(function RepreneurTable(
  { repreneurs, viewMode = "grouped" },
  ref,
) {
  const router = useRouter()
  // Global sort for flat view
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  // Per-group sort for grouped view
  const [groupSorts, setGroupSorts] = useState<Record<LifecycleStatus, GroupSortState>>({
    lead: { ...DEFAULT_GROUP_SORT },
    qualified: { ...DEFAULT_GROUP_SORT },
    client: { ...DEFAULT_GROUP_SORT },
    to_reactivate: { ...DEFAULT_GROUP_SORT },
    declined: { ...DEFAULT_GROUP_SORT },
    rejected: { ...DEFAULT_GROUP_SORT },
  })
  // Initialize with empty groups collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LifecycleStatus>>(() => {
    const emptyStatuses = STATUS_ORDER.filter((status) => !repreneurs.some((r) => r.lifecycle_status === status))
    return new Set(emptyStatuses)
  })
  const [groupPages, setGroupPages] = useState<Record<LifecycleStatus, number>>({
    lead: 1,
    qualified: 1,
    client: 1,
    to_reactivate: 1,
    declined: 1,
    rejected: 1,
  })

  const resetGroupPages = () => {
    setGroupPages({
      lead: 1,
      qualified: 1,
      client: 1,
      to_reactivate: 1,
      declined: 1,
      rejected: 1,
    })
  }

  // Extract unique sources
  const sources = useMemo(() => {
    const uniqueSources = new Set<string>()
    repreneurs.forEach((r) => {
      if (r.source) uniqueSources.add(r.source)
    })
    return Array.from(uniqueSources).sort()
  }, [repreneurs])

  const offers = useMemo(() => {
    const uniqueOffers = new Set<string>()
    repreneurs.forEach((r) => {
      r.offer_names?.forEach((offerName) => {
        if (offerName) uniqueOffers.add(offerName)
      })
    })
    return Array.from(uniqueOffers).sort()
  }, [repreneurs])

  const filterDefinitions = useMemo<CollectionFilterDefinition[]>(() => [
    {
      key: "status",
      label: "Status",
      options: STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    },
    { key: "source", label: "Source", options: sources.map((source) => ({ value: source, label: source })) },
    { key: "offer", label: "Offer", options: offers.map((offer) => ({ value: offer, label: offer })) },
    { key: "added", label: "Added", options: DATE_RANGES.filter((option) => option.value !== "all") },
    { key: "score", label: "Minimum score", options: SCORE_RANGES.filter((option) => option.value !== "all") },
    { key: "journey", label: "Journey", options: JOURNEY_OPTIONS },
    { key: "persona", label: "Persona", options: PERSONA_OPTIONS },
    { key: "recommendation", label: "Recommendation", options: RECOMMENDATION_OPTIONS },
    {
      key: "interview",
      label: "Interview",
      options: [
        { value: "booked", label: "Interview booked" },
        { value: "none", label: "No interview" },
      ],
    },
  ], [offers, sources])

  const filters = useCollectionFilters({ definitions: filterDefinitions, onChange: resetGroupPages })
  const search = filters.search
  const statusFilter = (filters.values.status || "all") as LifecycleStatus | "all"
  const sourceFilter = filters.values.source || ""
  const offerFilter = filters.values.offer || ""
  const dateRange = filters.values.added || "all"
  const minScore = filters.values.score || "all"
  const journeyFilter = (filters.values.journey || "all") as JourneyStage | "all"
  const personaFilter = (filters.values.persona || "all") as PersonaType | "all"
  const recommendationFilter = filters.values.recommendation || ""
  const interviewFilter = (filters.values.interview || "all") as "all" | "booked" | "none"

  const filtered = repreneurs.filter((r) => {
    const matchesSearch =
      r.first_name.toLowerCase().includes(search.toLowerCase()) ||
      r.last_name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === "all" || r.lifecycle_status === statusFilter

    const matchesSource = !sourceFilter || r.source === sourceFilter
    const matchesOffer = !offerFilter || Boolean(r.offer_names?.includes(offerFilter))

    let matchesDate = true
    if (dateRange !== "all") {
      const days = parseInt(dateRange)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      matchesDate = new Date(r.created_at) >= cutoffDate
    }

    let matchesScore = true
    if (minScore !== "all") {
      const who = r.who_score ?? r.tier1_score ?? 0
      const when = r.when_score ?? 0
      matchesScore = who + when >= parseInt(minScore)
    }

    const matchesJourney = journeyFilter === "all" || r.journey_stage === journeyFilter

    const matchesPersona = personaFilter === "all" || r.persona === personaFilter

    const matchesRecommendation = !recommendationFilter || r.recommendation === recommendationFilter

    const matchesInterview =
      interviewFilter === "all"
        ? true
        : interviewFilter === "booked"
          ? Boolean(r.has_scheduled_interview)
          : !r.has_scheduled_interview

    return (
      matchesSearch &&
      matchesStatus &&
      matchesSource &&
      matchesOffer &&
      matchesDate &&
      matchesScore &&
      matchesJourney &&
      matchesPersona &&
      matchesRecommendation &&
      matchesInterview
    )
  })

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
        const enriched: EnrichedRepreneur[] = filtered.map((r) => ({
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
    [filtered],
  )

  // Sort function for a group
  const sortGroup = (items: RepreneurWithOffers[], status: LifecycleStatus) => {
    const { field, direction } = groupSorts[status]
    return [...items].sort((a, b) => {
      let comparison = 0
      switch (field) {
        case "name":
          comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
          break
        case "email":
          comparison = a.email.localeCompare(b.email)
          break
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case "status_column":
          // Sort by the status-specific field
          switch (status) {
            case "lead":
              // Sort by combined WHO + WHEN score
              const aWho = (a as any).who_score ?? a.tier1_score ?? 0
              const aWhen = (a as any).when_score ?? 0
              const bWho = (b as any).who_score ?? b.tier1_score ?? 0
              const bWhen = (b as any).when_score ?? 0
              comparison = aWho + aWhen - (bWho + bWhen)
              break
            case "qualified": {
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
            case "client":
              comparison = (a.offer_names?.length || 0) - (b.offer_names?.length || 0)
              break
            case "declined": {
              const aDeclined = a.declined_at ? new Date(a.declined_at).getTime() : 0
              const bDeclined = b.declined_at ? new Date(b.declined_at).getTime() : 0
              comparison = aDeclined - bDeclined
              break
            }
            case "rejected": {
              const aDate = a.rejected_at ? new Date(a.rejected_at).getTime() : 0
              const bDate = b.rejected_at ? new Date(b.rejected_at).getTime() : 0
              comparison = aDate - bDate
              break
            }
            case "to_reactivate": {
              // Sort by created_at descending so the most recently flipped show first.
              comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              break
            }
          }
          break
      }
      return direction === "asc" ? comparison : -comparison
    })
  }

  // Sort for flat view (global sort)
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case "name":
        comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        break
      case "email":
        comparison = a.email.localeCompare(b.email)
        break
      case "created_at":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
    }
    return sortDirection === "asc" ? comparison : -comparison
  })

  // Group by status (unsorted - sorting applied per group later)
  const groupedByStatus = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = filtered.filter((r) => r.lifecycle_status === status)
      return acc
    },
    {} as Record<LifecycleStatus, RepreneurWithOffers[]>,
  )

  const toggleGroup = (status: LifecycleStatus) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(status)) {
      newCollapsed.delete(status)
    } else {
      newCollapsed.add(status)
    }
    setCollapsedGroups(newCollapsed)
  }

  const setGroupPage = (status: LifecycleStatus, page: number) => {
    setGroupPages((prev) => ({ ...prev, [status]: page }))
  }

  // Reset pages when search changes
  // Global sort for flat view
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Per-group sort for grouped view
  const handleGroupSort = (status: LifecycleStatus, field: SortField) => {
    setGroupSorts((prev) => {
      const current = prev[status]
      if (current.field === field) {
        // Toggle direction
        return {
          ...prev,
          [status]: {
            ...current,
            direction: current.direction === "asc" ? "desc" : "asc",
          },
        }
      } else {
        // New field, default to desc
        return {
          ...prev,
          [status]: { field, direction: "desc" },
        }
      }
    })
    // Reset to page 1 when sorting changes
    setGroupPages((prev) => ({ ...prev, [status]: 1 }))
  }

  // Get sort indicator for a column in a group
  const getSortIndicator = (status: LifecycleStatus, field: SortField) => {
    const { field: sortedField, direction } = groupSorts[status]
    if (sortedField !== field) return null
    return direction === "asc" ? " ↑" : " ↓"
  }

  // Render status-specific columns
  const renderStatusColumn = (repreneur: RepreneurWithOffers) => {
    switch (repreneur.lifecycle_status) {
      case "lead":
        return <ScoreDisplay repreneur={repreneur} />
      case "qualified":
        return <AssessmentBadge decision={repreneur.assessment_decision} pending={repreneur.assessment_pending} />
      case "client":
        return <OfferDisplay offers={repreneur.offer_names} />
      case "declined":
        return (
          <span className="text-sm text-muted-foreground">
            {repreneur.declined_at ? new Date(repreneur.declined_at).toLocaleDateString() : "Unknown"}
          </span>
        )
      case "rejected":
        return (
          <span className="text-sm text-muted-foreground">
            {repreneur.rejected_at ? new Date(repreneur.rejected_at).toLocaleDateString() : "Unknown"}
          </span>
        )
      case "to_reactivate":
        return <ScoreDisplay repreneur={repreneur} />
      default:
        return null
    }
  }

  const getStatusColumnHeader = (status: LifecycleStatus) => {
    switch (status) {
      case "lead":
        return "Rating"
      case "qualified":
        return "Assessment"
      case "client":
        return "Offers"
      case "to_reactivate":
        return "Rating"
      case "declined":
        return "Declined Date"
      case "rejected":
        return "Rejected Date"
      default:
        return ""
    }
  }

  if (viewMode === "flat") {
    // Original flat view with all columns
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => filters.setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => filters.setFilter("status", value === "all" ? "" : value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="to_reactivate">To be reactivated</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-white">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%] cursor-pointer" onClick={() => handleSort("name")}>
                  Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-[25%] cursor-pointer" onClick={() => handleSort("email")}>
                  Email {sortField === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-[15%]">Status</TableHead>
                <TableHead className="w-[20%]">Journey</TableHead>
                <TableHead className="w-[15%] cursor-pointer" onClick={() => handleSort("created_at")}>
                  Created {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No repreneurs found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((repreneur) => (
                  <TableRow
                    key={repreneur.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
                    onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
                  >
                    <TableCell className="w-[25%]">
                      <div className="flex items-center gap-3 min-w-0">
                        <span aria-hidden="true">
                          <RepreneurAvatar
                            repreneurId={repreneur.id}
                            avatarUrl={repreneur.avatar_url}
                            firstName={repreneur.first_name}
                            lastName={repreneur.last_name}
                            size="sm"
                          />
                        </span>
                        <span className="font-medium text-foreground truncate">
                          {repreneur.first_name} {repreneur.last_name}
                        </span>
                        <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                        {repreneur.has_scheduled_interview && (
                          <CalendarCheck className="size-3.5 text-emerald-600 shrink-0" aria-label="Interview booked">
                            <title>Interview booked</title>
                          </CalendarCheck>
                        )}
                        {(repreneur as any).needs_data_completion && (
                          <NeedsCompletionBadge repreneurId={repreneur.id} variant="icon-only" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="w-[25%] text-muted-foreground truncate">{repreneur.email}</TableCell>
                    <TableCell className="w-[15%]">
                      <StatusBadge status={repreneur.lifecycle_status} />
                    </TableCell>
                    <TableCell className="w-[20%]">
                      <JourneyDisplay repreneur={repreneur} />
                    </TableCell>
                    <TableCell className="w-[15%] text-muted-foreground">
                      {new Date(repreneur.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Grouped view with collapsible sections
  return (
    <div className="flex flex-col gap-4">
      <CollectionFilterBar
        search={search}
        onSearchChange={filters.setSearch}
        searchPlaceholder="Search repreneurs..."
        definitions={filterDefinitions}
        values={filters.values}
        onFilterChange={filters.setFilter}
        onFilterRemove={filters.removeFilter}
        onClearFilters={filters.clearFilters}
        onReset={filters.reset}
        resultCount={filtered.length}
        totalCount={repreneurs.length}
        resultLabel="repreneur"
      />

      <div className="space-y-4">
        {STATUS_ORDER.filter((status) => statusFilter === "all" || statusFilter === status).map((status) => {
          const group = groupedByStatus[status]
          if (group.length === 0 && statusFilter !== "all") return null

          const isCollapsed = collapsedGroups.has(status)
          const sortedGroup = sortGroup(group, status)
          const currentPage = groupPages[status]
          const totalPages = Math.ceil(sortedGroup.length / ITEMS_PER_PAGE)
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
          const endIndex = startIndex + ITEMS_PER_PAGE
          const paginatedGroup = sortedGroup.slice(startIndex, endIndex)

          return (
            <section key={status} className="wave-panel overflow-hidden">
              <button
                className="flex w-full items-center justify-between bg-muted/25 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => toggleGroup(status)}
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[status]}</span>
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {group.length}
                  </Badge>
                </div>
              </button>

              {!isCollapsed && group.length > 0 && (
                <div className="overflow-x-auto rounded-b-lg bg-card">
                  <Table className="min-w-[860px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%]" aria-sort={groupSorts[status].field === "name" ? (groupSorts[status].direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" className="flex h-full w-full items-center rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleGroupSort(status, "name")}>
                            Name{getSortIndicator(status, "name")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[25%]" aria-sort={groupSorts[status].field === "email" ? (groupSorts[status].direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" className="flex h-full w-full items-center rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleGroupSort(status, "email")}>
                            Email{getSortIndicator(status, "email")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[18%]" aria-sort={groupSorts[status].field === "status_column" ? (groupSorts[status].direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" className="flex h-full w-full items-center rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleGroupSort(status, "status_column")}>
                            {getStatusColumnHeader(status)}
                            {getSortIndicator(status, "status_column")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[18%]">Journey</TableHead>
                        <TableHead className="w-[14%] text-right" aria-sort={groupSorts[status].field === "created_at" ? (groupSorts[status].direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" className="flex h-full w-full items-center justify-end rounded-sm text-right hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleGroupSort(status, "created_at")}>
                            Created{getSortIndicator(status, "created_at")}
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedGroup.map((repreneur) => (
                        <TableRow
                          key={repreneur.id}
                          className="cursor-pointer focus-visible:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          tabIndex={0}
                          onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
                          onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              router.push(`/repreneurs/${repreneur.id}`)
                            }
                          }}
                        >
                          <TableCell className="w-[25%]">
                            <div className="flex items-center gap-3 min-w-0">
                              <span aria-hidden="true">
                                <RepreneurAvatar
                                  repreneurId={repreneur.id}
                                  avatarUrl={repreneur.avatar_url}
                                  firstName={repreneur.first_name}
                                  lastName={repreneur.last_name}
                                  size="sm"
                                />
                              </span>
                              <span className="truncate font-semibold text-foreground">
                                {repreneur.first_name} {repreneur.last_name}
                              </span>
                              <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                              {repreneur.has_scheduled_interview && (
                                <CalendarCheck
                                  className="size-3.5 text-emerald-600 shrink-0"
                                  aria-label="Interview booked"
                                >
                                  <title>Interview booked</title>
                                </CalendarCheck>
                              )}
                              {(repreneur as any).needs_data_completion && (
                                <NeedsCompletionBadge repreneurId={repreneur.id} variant="icon-only" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="w-[25%] truncate text-muted-foreground">{repreneur.email}</TableCell>
                          <TableCell className="w-[18%]">{renderStatusColumn(repreneur)}</TableCell>
                          <TableCell className="w-[18%]">
                            <JourneyDisplay repreneur={repreneur} />
                          </TableCell>
                          <TableCell className="w-[14%] text-right text-xs text-muted-foreground">
                            {new Date(repreneur.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, sortedGroup.length)} of {sortedGroup.length}
                      </span>
                      <Pagination className="sm:mx-0 sm:w-auto">
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              disabled={currentPage === 1}
                              onClick={() => currentPage > 1 && setGroupPage(status, currentPage - 1)}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((page) => {
                              // Show first, last, current, and neighbors
                              if (page === 1 || page === totalPages) return true
                              if (Math.abs(page - currentPage) <= 1) return true
                              return false
                            })
                            .map((page, index, arr) => {
                              // Add ellipsis if there's a gap
                              const showEllipsisBefore = index > 0 && page - arr[index - 1] > 1
                              return (
                                <span key={page} className="flex items-center">
                                  {showEllipsisBefore && <PaginationEllipsis />}
                                  <PaginationItem>
                                    <PaginationLink
                                      onClick={() => setGroupPage(status, page)}
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
                              onClick={() => currentPage < totalPages && setGroupPage(status, currentPage + 1)}
                              className={
                                currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}

              {!isCollapsed && group.length === 0 && (
                <div className="bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  No {STATUS_LABELS[status].toLowerCase()} found
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
})
