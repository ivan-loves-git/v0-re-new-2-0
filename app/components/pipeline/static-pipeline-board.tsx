"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Star, Target, Package, ChevronDown, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { KanbanFilters, type KanbanFiltersState } from "./kanban-filters"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
}

interface StaticPipelineBoardProps {
  repreneurs: RepreneurWithOffers[]
}

const INITIAL_VISIBLE = 15
const LOAD_MORE_COUNT = 10

const COLUMNS: { status: LifecycleStatus; title: string; color: string; bgColor: string }[] = [
  { status: "lead", title: "Leads", color: "bg-blue-100", bgColor: "bg-blue-50/50" },
  { status: "qualified", title: "Qualified", color: "bg-yellow-100", bgColor: "bg-yellow-50/50" },
  { status: "client", title: "Clients", color: "bg-green-100", bgColor: "bg-green-50/50" },
  { status: "rejected", title: "Rejected", color: "bg-red-100", bgColor: "bg-red-50/50" },
]

function StarDisplay({ stars }: { stars: number | null | undefined }) {
  if (!stars) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${
            star <= stars ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-gray-300"
          }`}
        />
      ))}
    </div>
  )
}

function PipelineCard({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const router = useRouter()

  const renderStatusInfo = () => {
    switch (repreneur.lifecycle_status) {
      case "lead":
        if (repreneur.tier1_score !== null && repreneur.tier1_score !== undefined) {
          return (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Target className="h-3 w-3" />
              <span className="font-medium">{repreneur.tier1_score} pts</span>
            </div>
          )
        }
        return null
      case "qualified":
        return <StarDisplay stars={repreneur.tier2_stars} />
      case "client":
        if (repreneur.offer_names && repreneur.offer_names.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {repreneur.offer_names.slice(0, 2).map((name, idx) => (
                <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                  <Package className="h-2.5 w-2.5 mr-0.5" />
                  {name}
                </Badge>
              ))}
              {repreneur.offer_names.length > 2 && (
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  +{repreneur.offer_names.length - 2}
                </Badge>
              )}
            </div>
          )
        }
        return null
      case "rejected":
        if (repreneur.rejected_at) {
          return (
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(repreneur.rejected_at), { addSuffix: true })}
            </span>
          )
        }
        return null
      default:
        return null
    }
  }

  return (
    <Card
      className="p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow bg-white"
      onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <RepreneurAvatar
            repreneurId={repreneur.id}
            avatarUrl={repreneur.avatar_url}
            firstName={repreneur.first_name}
            lastName={repreneur.last_name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm leading-tight truncate">
              {repreneur.first_name} {repreneur.last_name}
            </h3>
            <p className="text-xs text-gray-500 truncate">{repreneur.email}</p>
          </div>
        </div>
        {renderStatusInfo()}
      </div>
    </Card>
  )
}

function PipelineColumn({
  status,
  title,
  color,
  bgColor,
  repreneurs,
}: {
  status: LifecycleStatus
  title: string
  color: string
  bgColor: string
  repreneurs: RepreneurWithOffers[]
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  const visibleRepreneurs = repreneurs.slice(0, visibleCount)
  const hasMore = repreneurs.length > visibleCount
  const remainingCount = repreneurs.length - visibleCount

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + LOAD_MORE_COUNT)
  }

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={`p-3 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <Badge variant="secondary" className="bg-white">
            {repreneurs.length}
          </Badge>
        </div>
      </div>
      <div className={`${bgColor} p-3 rounded-b-lg min-h-[calc(100vh-320px)] max-h-[calc(100vh-200px)] overflow-y-auto`}>
        {visibleRepreneurs.map((repreneur) => (
          <PipelineCard key={repreneur.id} repreneur={repreneur} />
        ))}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMore}
            className="w-full mt-2 text-gray-500 hover:text-gray-700"
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show {Math.min(remainingCount, LOAD_MORE_COUNT)} more ({remainingCount} hidden)
          </Button>
        )}

        {repreneurs.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No {title.toLowerCase()}</p>
        )}
      </div>
    </div>
  )
}

export function StaticPipelineBoard({ repreneurs }: StaticPipelineBoardProps) {
  const [filters, setFilters] = useState<KanbanFiltersState>({
    search: "",
    source: "",
    dateRange: "all",
  })

  // Extract unique sources from repreneurs
  const sources = useMemo(() => {
    const uniqueSources = new Set<string>()
    repreneurs.forEach((r) => {
      if (r.source) uniqueSources.add(r.source)
    })
    return Array.from(uniqueSources).sort()
  }, [repreneurs])

  // Filter repreneurs based on current filters
  const filteredRepreneurs = useMemo(() => {
    return repreneurs.filter((r) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
        const email = r.email.toLowerCase()
        if (!fullName.includes(searchLower) && !email.includes(searchLower)) {
          return false
        }
      }

      // Source filter
      if (filters.source && r.source !== filters.source) {
        return false
      }

      // Date range filter
      if (filters.dateRange !== "all") {
        const days = parseInt(filters.dateRange)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        if (new Date(r.created_at) < cutoffDate) {
          return false
        }
      }

      return true
    })
  }, [repreneurs, filters])

  // Group by status
  const groupedByStatus = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.status] = filteredRepreneurs.filter((r) => r.lifecycle_status === col.status)
      return acc
    }, {} as Record<LifecycleStatus, RepreneurWithOffers[]>)
  }, [filteredRepreneurs])

  const totalFiltered = filteredRepreneurs.length
  const totalAll = repreneurs.length
  const isFiltered = totalFiltered !== totalAll

  return (
    <div>
      <KanbanFilters filters={filters} onFiltersChange={setFilters} sources={sources} />

      {isFiltered && (
        <p className="text-sm text-gray-500 mb-4">
          Showing {totalFiltered} of {totalAll} repreneurs
        </p>
      )}

      <TooltipProvider>
        <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Status changes are action-driven. To move a repreneur:{" "}
            <span className="font-medium">set Tier 2 rating</span> (→ Qualified),{" "}
            <span className="font-medium">assign an offer</span> (→ Client), or{" "}
            <span className="font-medium">use the Reject button</span> (→ Rejected).
          </p>
        </div>
      </TooltipProvider>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <PipelineColumn
            key={column.status}
            status={column.status}
            title={column.title}
            color={column.color}
            bgColor={column.bgColor}
            repreneurs={groupedByStatus[column.status] || []}
          />
        ))}
      </div>
    </div>
  )
}
