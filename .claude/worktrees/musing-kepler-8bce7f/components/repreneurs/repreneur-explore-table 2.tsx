"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Star, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { subDays } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
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
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { JourneyStageBadge } from "@/components/journey/journey-stage-badge"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

const ITEMS_PER_PAGE = 20

type SortField = "name" | "email" | "status" | "who" | "when" | "tier2_stars" | "journey" | "created_at"
type SortDirection = "asc" | "desc"

const STATUS_OPTIONS: { value: LifecycleStatus; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "client", label: "Client" },
  { value: "rejected", label: "Rejected" },
  { value: "declined", label: "Declined" },
]

function getScoreColor(score: number | null | undefined) {
  if (score == null) return "text-gray-400"
  if (score >= 70) return "text-green-600"
  if (score >= 50) return "text-blue-600"
  if (score >= 30) return "text-yellow-600"
  return "text-gray-500"
}

interface RepreneurExploreTableProps {
  repreneurs: Repreneur[]
}

export function RepreneurExploreTable({ repreneurs }: RepreneurExploreTableProps) {
  const router = useRouter()

  // Filter state
  const [search, setSearch] = useState("")
  const [statusFilters, setStatusFilters] = useState<LifecycleStatus[]>([])
  const [minWho, setMinWho] = useState("")
  const [minWhen, setMinWhen] = useState("")
  const [dateRange, setDateRange] = useState("all")

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  const hasActiveFilters = search || statusFilters.length > 0 || minWho || minWhen || dateRange !== "all"

  const clearFilters = () => {
    setSearch("")
    setStatusFilters([])
    setMinWho("")
    setMinWhen("")
    setDateRange("all")
    setCurrentPage(1)
  }

  const toggleStatus = (status: LifecycleStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
    setCurrentPage(1)
  }

  // Filtered data
  const filtered = useMemo(() => {
    return repreneurs.filter((r) => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const name = `${r.first_name} ${r.last_name}`.toLowerCase()
        const email = r.email.toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }

      // Status
      if (statusFilters.length > 0 && !statusFilters.includes(r.lifecycle_status)) return false

      // Score filters
      if (minWho) {
        const who = r.who_score ?? r.tier1_score ?? 0
        if (who < parseInt(minWho)) return false
      }
      if (minWhen) {
        const when = r.when_score ?? 0
        if (when < parseInt(minWhen)) return false
      }

      // Date range
      if (dateRange !== "all") {
        const days = parseInt(dateRange)
        const cutoff = subDays(new Date(), days)
        if (new Date(r.created_at) < cutoff) return false
      }

      return true
    })
  }, [repreneurs, search, statusFilters, minWho, minWhen, dateRange])

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
        case "tier2_stars":
          comparison = (a.tier2_stars ?? 0) - (b.tier2_stars ?? 0)
          break
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
      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white border rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <Badge
                key={opt.value}
                variant={statusFilters.includes(opt.value) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleStatus(opt.value)}
              >
                {opt.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="w-[90px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Min WHO</label>
          <Input
            type="number"
            placeholder="0"
            value={minWho}
            onChange={(e) => { setMinWho(e.target.value); setCurrentPage(1) }}
            min="0"
            max="100"
          />
        </div>

        <div className="w-[90px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Min WHEN</label>
          <Input
            type="number"
            placeholder="0"
            value={minWhen}
            onChange={(e) => { setMinWhen(e.target.value); setCurrentPage(1) }}
            min="0"
            max="100"
          />
        </div>

        <div className="w-[140px]">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Period</label>
          <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setCurrentPage(1) }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
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
              <TableHead className="cursor-pointer hover:bg-gray-50 w-[80px]" onClick={() => handleSort("tier2_stars")}>
                <div className="flex items-center">T2<SortIcon field="tier2_stars" /></div>
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
                    {r.tier2_stars ? (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-3 ${
                              star <= (r.tier2_stars || 0) ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
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
}
