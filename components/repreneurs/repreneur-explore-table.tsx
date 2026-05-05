"use client"

import { useState, useMemo, forwardRef, useImperativeHandle } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { subDays } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
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
  if (score == null) return "text-gray-400"
  if (score >= 70) return "text-green-600"
  if (score >= 50) return "text-blue-600"
  if (score >= 30) return "text-yellow-600"
  return "text-gray-500"
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

export const RepreneurExploreTable = forwardRef<RepreneurExploreTableRef, RepreneurExploreTableProps>(function RepreneurExploreTable({ repreneurs }, ref) {
  const router = useRouter()

  // Filter state
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState("")
  const [dateRange, setDateRange] = useState("all")
  const [minScore, setMinScore] = useState("all")
  const [journeyFilter, setJourneyFilter] = useState<JourneyStage | "all">("all")
  const [personaFilter, setPersonaFilter] = useState<PersonaType | "all">("all")
  const [recommendationFilter, setRecommendationFilter] = useState("")

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

  const hasActiveFilters = search || statusFilter !== "all" || sourceFilter || dateRange !== "all" || minScore !== "all" || journeyFilter !== "all" || personaFilter !== "all" || recommendationFilter

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setSourceFilter("")
    setDateRange("all")
    setMinScore("all")
    setJourneyFilter("all")
    setPersonaFilter("all")
    setRecommendationFilter("")
    setCurrentPage(1)
  }

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

      if (dateRange !== "all") {
        const days = parseInt(dateRange)
        const cutoff = subDays(new Date(), days)
        if (new Date(r.created_at) < cutoff) return false
      }

      if (journeyFilter !== "all" && r.journey_stage !== journeyFilter) return false

      if (personaFilter !== "all" && r.persona !== personaFilter) return false

      if (recommendationFilter && r.recommendation !== recommendationFilter) return false

      return true
    })
  }, [repreneurs, search, statusFilter, sourceFilter, dateRange, minScore, journeyFilter, personaFilter, recommendationFilter])

  // Sorted data
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
          break
        case "email":
          comparison = a.email.localeCompare(b.email)
          break
        case "status":
          comparison = a.lifecycle_status.localeCompare(b.lifecycle_status)
          break
        case "who":
          comparison = (a.who_score ?? a.tier1_score ?? 0) - (b.who_score ?? b.tier1_score ?? 0)
          break
        case "when":
          comparison = (a.when_score ?? 0) - (b.when_score ?? 0)
          break
        case "assessment": {
          const decisionOrder: Record<string, number> = { engagement: 3, engagement_sous_conditions: 2, non_engagement: 1 }
          const aOrder = a.assessment_decision ? (decisionOrder[a.assessment_decision] || 0) : (a.assessment_pending ? -1 : -2)
          const bOrder = b.assessment_decision ? (decisionOrder[b.assessment_decision] || 0) : (b.assessment_pending ? -1 : -2)
          comparison = aOrder - bOrder
          break
        }
        case "journey":
          comparison = (a.journey_stage ?? "").localeCompare(b.journey_stage ?? "")
          break
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filtered, sortField, sortDirection])

  useImperativeHandle(ref, () => ({
    triggerExport: async () => {
      const { interviewCounts, interviewBooked, firstInterviewAt, offerData, firstOffer, secondOffer } = await getExportEnrichmentData()
      const enriched: EnrichedRepreneur[] = sorted.map(r => ({
        ...r,
        interview_count: interviewCounts[r.id] || 0,
        interview_booked: interviewBooked[r.id] ? "Yes" : "No",
        offer_names: offerData[r.id]?.names || "",
        offer_status: offerData[r.id]?.status || "",
        decline_reason: r.decline_reason_category
          ? DECLINE_REASON_OPTIONS.find(o => o.value === r.decline_reason_category)?.label || r.decline_reason_category
          : "",
        first_contact_at: r.created_at ? r.created_at.slice(0, 10) : "",
        first_interview_at: firstInterviewAt[r.id] || "",
        first_offer_at: firstOffer[r.id]?.offeredAt || "",
        first_offer_status: firstOffer[r.id]?.status || "",
        first_offer_accepted_at: firstOffer[r.id]?.acceptedAt || "",
        second_offer_at: secondOffer[r.id]?.offeredAt || "",
        second_offer_status: secondOffer[r.id]?.status || "",
        second_offer_accepted_at: secondOffer[r.id]?.acceptedAt || "",
      }))
      exportRepreneursToCSV(enriched, "repreneurs.csv")
    },
  }), [sorted])

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
    if (sortField !== field) return <ArrowUpDown className="size-3 ml-1 text-gray-400" />
    return sortDirection === "asc"
      ? <ArrowUp className="size-3 ml-1" />
      : <ArrowDown className="size-3 ml-1" />
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar - Row 1: Core filters */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
            className="pl-9 w-[160px]"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as LifecycleStatus | "all"); setCurrentPage(1) }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="lead">Lead</SelectItem>
        <SelectItem value="qualified">Qualified</SelectItem>
        <SelectItem value="client">Client</SelectItem>
        <SelectItem value="declined">Declined</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {sources.length > 0 && (
          <Select
            value={sourceFilter || "all"}
            onValueChange={(v) => { setSourceFilter(v === "all" ? "" : v); setCurrentPage(1) }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
        <SelectItem value="all">All sources</SelectItem>
        {sources.map((source) => (
          <SelectItem key={source} value={source}>{source}</SelectItem>
        ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        {DATE_RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
        ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={minScore} onValueChange={(v) => { setMinScore(v); setCurrentPage(1) }}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        {SCORE_RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
        ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={journeyFilter} onValueChange={(v) => { setJourneyFilter(v as JourneyStage | "all"); setCurrentPage(1) }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        <SelectItem value="all">All journeys</SelectItem>
        {JOURNEY_OPTIONS.map((j) => (
          <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
        ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={personaFilter} onValueChange={(v) => { setPersonaFilter(v as PersonaType | "all"); setCurrentPage(1) }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        <SelectItem value="all">All personas</SelectItem>
        {PERSONA_OPTIONS.map((p) => (
          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
        ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={recommendationFilter || "all"}
          onValueChange={(v) => { setRecommendationFilter(v === "all" ? "" : v); setCurrentPage(1) }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All recommendations" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
        <SelectItem value="all">All recommendations</SelectItem>
        {RECOMMENDATION_OPTIONS.map((r) => (
          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
        ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="size-4 mr-1" />
            Clear
          </Button>
        )}

      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {sorted.length} repreneur{sorted.length !== 1 ? "s" : ""}{hasActiveFilters ? ` (filtered from ${repreneurs.length})` : ""}
      </p>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("name")}>
                <div className="flex items-center">Name<SortIcon field="name" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort("email")}>
                <div className="flex items-center">Email<SortIcon field="email" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[100px]" onClick={() => handleSort("status")}>
                <div className="flex items-center">Status<SortIcon field="status" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[80px]" onClick={() => handleSort("who")}>
                <div className="flex items-center">WHO<SortIcon field="who" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[80px]" onClick={() => handleSort("when")}>
                <div className="flex items-center">WHEN<SortIcon field="when" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[100px]" onClick={() => handleSort("assessment")}>
                <div className="flex items-center">Assessment<SortIcon field="assessment" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[110px]" onClick={() => handleSort("journey")}>
                <div className="flex items-center">Journey<SortIcon field="journey" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[110px]" onClick={() => handleSort("created_at")}>
                <div className="flex items-center">Added<SortIcon field="created_at" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                  No repreneurs match your filters
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/repreneurs/${r.id}`)}
                  onMouseEnter={() => router.prefetch(`/repreneurs/${r.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <RepreneurAvatar
                        repreneurId={r.id}
                        avatarUrl={r.avatar_url}
                        firstName={r.first_name}
                        lastName={r.last_name}
                        size="sm"
                      />
                      <span className="font-medium text-gray-900 truncate">
                        {r.first_name} {r.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 truncate max-w-[200px]">{r.email}</TableCell>
                  <TableCell><StatusBadge status={r.lifecycle_status} /></TableCell>
                  <TableCell>
                    <span className={`font-medium ${getScoreColor(r.who_score ?? r.tier1_score)}`}>
                      {r.who_score ?? r.tier1_score ?? "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${getScoreColor(r.when_score)}`}>
                      {r.when_score ?? "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {r.assessment_pending ? (
                      <Badge variant="outline" className="text-xs text-gray-500 border-gray-300">Pending</Badge>
                    ) : r.assessment_decision === "engagement" ? (
                      <Badge className="text-xs bg-green-100 text-green-700 border-0">Pass</Badge>
                    ) : r.assessment_decision === "engagement_sous_conditions" ? (
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-0">Review</Badge>
                    ) : r.assessment_decision === "non_engagement" ? (
                      <Badge className="text-xs bg-red-100 text-red-700 border-0">Fail</Badge>
                    ) : (
                      <span className="text-gray-400">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.journey_stage ? (
                      <JourneyStageBadge stage={r.journey_stage} showIcon={false} showTooltip={false} />
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)} of {sorted.length}
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
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
                      {showEllipsis && <span className="px-2 text-gray-400">...</span>}
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
})
