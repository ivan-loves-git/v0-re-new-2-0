"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Star, Target, Package, ChevronDown, ChevronRight } from "lucide-react"
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
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"
import { MissingFieldsBadge } from "./missing-fields-badge"

const ITEMS_PER_PAGE = 10

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
}

interface RepreneurTableProps {
  repreneurs: RepreneurWithOffers[]
  viewMode?: "flat" | "grouped"
}

type SortField = "name" | "email" | "created_at" | "tier1_score" | "tier2_stars"
type SortDirection = "asc" | "desc"

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

function StarDisplay({ stars }: { stars: number | null | undefined }) {
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
}

function ScoreDisplay({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-gray-400 text-sm">N/A</span>
  }
  return (
    <div className="flex items-center gap-1">
      <Target className="h-4 w-4 text-gray-400" />
      <span className="font-medium">{score}</span>
    </div>
  )
}

function OfferDisplay({ offers }: { offers: string[] | undefined }) {
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
}

export function RepreneurTable({ repreneurs, viewMode = "grouped" }: RepreneurTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | "all">("all")
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<LifecycleStatus>>(new Set())
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

  // Sort repreneurs
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
      case "tier1_score":
        comparison = (a.tier1_score || 0) - (b.tier1_score || 0)
        break
      case "tier2_stars":
        comparison = (a.tier2_stars || 0) - (b.tier2_stars || 0)
        break
    }
    return sortDirection === "asc" ? comparison : -comparison
  })

  // Group by status
  const groupedByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = sorted.filter((r) => r.lifecycle_status === status)
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                  Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("email")}>
                  Email {sortField === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("tier1_score")}>
                  Score {sortField === "tier1_score" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("tier2_stars")}>
                  Rating {sortField === "tier2_stars" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("created_at")}>
                  Created {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
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
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <RepreneurAvatar
                          repreneurId={repreneur.id}
                          avatarUrl={repreneur.avatar_url}
                          firstName={repreneur.first_name}
                          lastName={repreneur.last_name}
                          size="sm"
                        />
                        <span className="font-medium text-gray-900">
                          {repreneur.first_name} {repreneur.last_name}
                        </span>
                        <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{repreneur.email}</TableCell>
                    <TableCell>
                      <StatusBadge status={repreneur.lifecycle_status} />
                    </TableCell>
                    <TableCell>
                      <ScoreDisplay score={repreneur.tier1_score} />
                    </TableCell>
                    <TableCell>
                      <StarDisplay stars={repreneur.tier2_stars} />
                    </TableCell>
                    <TableCell className="text-gray-600">
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
          const currentPage = groupPages[status]
          const totalPages = Math.ceil(group.length / ITEMS_PER_PAGE)
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
          const endIndex = startIndex + ITEMS_PER_PAGE
          const paginatedGroup = group.slice(startIndex, endIndex)

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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%] cursor-pointer" onClick={() => handleSort("name")}>
                          Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="w-[25%] cursor-pointer" onClick={() => handleSort("email")}>
                          Email {sortField === "email" && (sortDirection === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="w-[30%]">{getStatusColumnHeader(status)}</TableHead>
                        <TableHead className="w-[20%] text-right cursor-pointer" onClick={() => handleSort("created_at")}>
                          Created {sortField === "created_at" && (sortDirection === "asc" ? "↑" : "↓")}
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
                            <div className="flex items-center gap-3">
                              <RepreneurAvatar
                                repreneurId={repreneur.id}
                                avatarUrl={repreneur.avatar_url}
                                firstName={repreneur.first_name}
                                lastName={repreneur.last_name}
                                size="sm"
                              />
                              <span className="font-medium text-gray-900">
                                {repreneur.first_name} {repreneur.last_name}
                              </span>
                              <MissingFieldsBadge repreneur={repreneur} variant="icon-only" />
                            </div>
                          </TableCell>
                          <TableCell className="w-[25%] text-gray-600">{repreneur.email}</TableCell>
                          <TableCell className="w-[30%]">{renderStatusColumn(repreneur)}</TableCell>
                          <TableCell className="w-[20%] text-right text-gray-600">
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
                        Showing {startIndex + 1}-{Math.min(endIndex, group.length)} of {group.length}
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
