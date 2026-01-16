"use client"

import { useState, memo } from "react"
import { useRouter } from "next/navigation"
import { Search, Star, Target, Package, ChevronDown, ChevronRight, Compass, Map, Flag, Trophy } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "./status-badge"
import { Badge } from "@/components/ui/badge"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { Repreneur, LifecycleStatus, JourneyStage } from "@/lib/types/repreneur"
import { deriveJourneyStage, countMilestones, extractMilestones } from "@/lib/utils/journey-derivation"
import { getStageConfig } from "@/lib/constants/tier-config"
import { MissingFieldsBadge } from "./missing-fields-badge"

const ITEMS_PER_PAGE = 8

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
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

const STATUS_ORDER: LifecycleStatus[] = ["lead", "qualified", "client", "rejected"]

const STATUS_LABELS: Record<LifecycleStatus, string> = {
  lead: "Leads",
  qualified: "Qualified",
  client: "Clients",
  rejected: "Rejected",
}

const STATUS_COLORS: Record<LifecycleStatus, string> = {
  lead: "bg-blue-50 border-blue-200",
  qualified: "bg-yellow-50 border-yellow-200",
  client: "bg-green-50 border-green-200",
  rejected: "bg-red-50 border-red-200",
}

const StarDisplay = memo(function StarDisplay({ stars }: { stars: number | null | undefined }) {
  if (!stars) return <span className="text-gray-400 text-sm">Not rated</span>
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= stars ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-gray-300"
          }`}
        />
      ))}
    </div>
  )
})

const ScoreDisplay = memo(function ScoreDisplay({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-gray-400 text-sm">N/A</span>
  }
  return (
    <div className="flex items-center gap-1">
      <Target className="h-4 w-4 text-gray-400" />
      <span className="font-medium">{score}</span>
    </div>
  )
})

const OfferDisplay = memo(function OfferDisplay({ offers }: { offers: string[] | undefined }) {
  if (!offers || offers.length === 0) {
    return <span className="text-gray-400 text-sm">No offers</span>
  }

  // Show first offer + count of additional offers
  const firstOffer = offers[0]
  const additionalCount = offers.length - 1

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className="text-xs">
        <Package className="h-3 w-3 mr-1" />
        {firstOffer}
      </Badge>
      {additionalCount > 0 && (
        <span className="text-xs text-gray-500">+{additionalCount}</span>
      )}
    </div>
  )
})

const JourneyDisplay = memo(function JourneyDisplay({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const milestones = extractMilestones(repreneur)
  const milestoneCount = countMilestones(milestones)
  const derivedStage = deriveJourneyStage(milestoneCount, repreneur.persona)
  const stageConfig = getStageConfig(derivedStage)

  const StageIcon = derivedStage === "explorer" ? Compass :
                   derivedStage === "learner" ? Map :
                   derivedStage === "ready" ? Flag : Trophy

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`gap-1 text-xs ${stageConfig.bgColor} ${stageConfig.color} border-0`}>
        <StageIcon className="h-3 w-3" />
        {stageConfig.label}
      </Badge>
      <span className="text-xs text-gray-500">({milestoneCount}/10)</span>
    </div>
  )
})

const DEFAULT_GROUP_SORT: GroupSortState = { field: "created_at", direction: "desc" }

export function RepreneurTable({ repreneurs, viewMode = "grouped" }: RepreneurTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | "all">("all")
  // Global sort for flat view
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  // Per-group sort for grouped view
  const [groupSorts, setGroupSorts] = useState<Record<LifecycleStatus, GroupSortState>>({
    lead: { ...DEFAULT_GROUP_SORT },
    qualified: { ...DEFAULT_GROUP_SORT },
    client: { ...DEFAULT_GROUP_SORT },
    rejected: { ...DEFAULT_GROUP_SORT },
  })
  // Initialize with empty groups collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LifecycleStatus>>(() => {
    const emptyStatuses = STATUS_ORDER.filter(
      status => !repreneurs.some(r => r.lifecycle_status === status)
    )
    return new Set(emptyStatuses)
  })
  const [groupPages, setGroupPages] = useState<Record<LifecycleStatus, number>>({
    lead: 1,
    qualified: 1,
    client: 1,
    rejected: 1,
  })

  const filtered = repreneurs.filter((r) => {
    const matchesSearch =
      r.first_name.toLowerCase().includes(search.toLowerCase()) ||
      r.last_name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === "all" || r.lifecycle_status === statusFilter

    return matchesSearch && matchesStatus
  })

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
              comparison = (a.tier1_score || 0) - (b.tier1_score || 0)
              break
            case "qualified":
              comparison = (a.tier2_stars || 0) - (b.tier2_stars || 0)
              break
            case "client":
              comparison = (a.offer_names?.length || 0) - (b.offer_names?.length || 0)
              break
            case "rejected":
              const aDate = a.rejected_at ? new Date(a.rejected_at).getTime() : 0
              const bDate = b.rejected_at ? new Date(b.rejected_at).getTime() : 0
              comparison = aDate - bDate
              break
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
  const groupedByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = filtered.filter((r) => r.lifecycle_status === status)
    return acc
  }, {} as Record<LifecycleStatus, RepreneurWithOffers[]>)

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
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setGroupPages({ lead: 1, qualified: 1, client: 1, rejected: 1 })
  }

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
          [status]: { ...current, direction: current.direction === "asc" ? "desc" : "asc" },
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
        return <ScoreDisplay score={repreneur.tier1_score} />
      case "qualified":
        return <StarDisplay stars={repreneur.tier2_stars} />
      case "client":
        return <OfferDisplay offers={repreneur.offer_names} />
      case "rejected":
        return (
          <span className="text-sm text-gray-500">
            {repreneur.rejected_at
              ? new Date(repreneur.rejected_at).toLocaleDateString()
              : "Unknown"}
          </span>
        )
      default:
        return null
    }
  }

  const getStatusColumnHeader = (status: LifecycleStatus) => {
    switch (status) {
      case "lead":
        return "Tier 1 Score"
      case "qualified":
        return "Tier 2 Rating"
      case "client":
        return "Offers"
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as LifecycleStatus | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    No repreneurs found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((repreneur) => (
                  <TableRow
                    key={repreneur.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
                    onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
                  >
                    <TableCell className="w-[25%]">
                      <div className="flex items-center gap-3 min-w-0">
                        <RepreneurAvatar
                          repreneurId={repreneur.id}
                          avatarUrl={repreneur.avatar_url}
                          firstName={repreneur.first_name}
                          lastName={repreneur.last_name}
                          size="sm"
                        />
                        <span className="font-medium text-gray-900 truncate">
                          {repreneur.first_name} {repreneur.last_name}
                        </span>
                        <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                      </div>
                    </TableCell>
                    <TableCell className="w-[25%] text-gray-600 truncate">{repreneur.email}</TableCell>
                    <TableCell className="w-[15%]">
                      <StatusBadge status={repreneur.lifecycle_status} />
                    </TableCell>
                    <TableCell className="w-[20%]">
                      <JourneyDisplay repreneur={repreneur} />
                    </TableCell>
                    <TableCell className="w-[15%] text-gray-600">
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
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as LifecycleStatus | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
            <div key={status} className={`rounded-lg border ${STATUS_COLORS[status]}`}>
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left"
                onClick={() => toggleGroup(status)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="font-semibold text-gray-900">{STATUS_LABELS[status]}</span>
                  <Badge variant="secondary" className="ml-2">
                    {group.length}
                  </Badge>
                </div>
              </button>

              {!isCollapsed && group.length > 0 && (
                <div className="bg-white rounded-b-lg">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="w-[25%] cursor-pointer hover:bg-gray-50"
                          onClick={() => handleGroupSort(status, "name")}
                        >
                          Name{getSortIndicator(status, "name")}
                        </TableHead>
                        <TableHead
                          className="w-[25%] cursor-pointer hover:bg-gray-50"
                          onClick={() => handleGroupSort(status, "email")}
                        >
                          Email{getSortIndicator(status, "email")}
                        </TableHead>
                        <TableHead
                          className="w-[18%] cursor-pointer hover:bg-gray-50"
                          onClick={() => handleGroupSort(status, "status_column")}
                        >
                          {getStatusColumnHeader(status)}{getSortIndicator(status, "status_column")}
                        </TableHead>
                        <TableHead className="w-[18%]">
                          Journey
                        </TableHead>
                        <TableHead
                          className="w-[14%] text-right cursor-pointer hover:bg-gray-50"
                          onClick={() => handleGroupSort(status, "created_at")}
                        >
                          Created{getSortIndicator(status, "created_at")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedGroup.map((repreneur) => (
                        <TableRow
                          key={repreneur.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
                          onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
                        >
                          <TableCell className="w-[25%]">
                            <div className="flex items-center gap-3 min-w-0">
                              <RepreneurAvatar
                                repreneurId={repreneur.id}
                                avatarUrl={repreneur.avatar_url}
                                firstName={repreneur.first_name}
                                lastName={repreneur.last_name}
                                size="sm"
                              />
                              <span className="font-medium text-gray-900 truncate">
                                {repreneur.first_name} {repreneur.last_name}
                              </span>
                              <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                            </div>
                          </TableCell>
                          <TableCell className="w-[25%] text-gray-600 truncate">{repreneur.email}</TableCell>
                          <TableCell className="w-[18%]">{renderStatusColumn(repreneur)}</TableCell>
                          <TableCell className="w-[18%]">
                            <JourneyDisplay repreneur={repreneur} />
                          </TableCell>
                          <TableCell className="w-[14%] text-right text-gray-600">
                            {new Date(repreneur.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <span className="text-sm text-gray-500">
                        Showing {startIndex + 1}-{Math.min(endIndex, sortedGroup.length)} of {sortedGroup.length}
                      </span>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
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
                                  {showEllipsisBefore && (
                                    <span className="px-2 text-gray-400">...</span>
                                  )}
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
                              onClick={() => currentPage < totalPages && setGroupPage(status, currentPage + 1)}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}

              {!isCollapsed && group.length === 0 && (
                <div className="bg-white rounded-b-lg px-4 py-6 text-center text-gray-500">
                  No {STATUS_LABELS[status].toLowerCase()} found
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
