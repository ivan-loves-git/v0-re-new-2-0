"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Package, ChevronDown, Info, ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import type { Repreneur, LifecycleStatus } from "@/lib/types/repreneur"
import { CollectionFilterBar } from "@/components/wave/collection-filter-bar"
import type { CollectionFilterDefinition } from "@/lib/collection-filter-state"
import { useCollectionFilters } from "@/hooks/use-collection-filters"

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
}

interface StaticPipelineBoardProps {
  repreneurs: RepreneurWithOffers[]
}

const INITIAL_VISIBLE = 15
const LOAD_MORE_COUNT = 10

const COLUMNS: { status: LifecycleStatus; title: string }[] = [
  { status: "lead", title: "Leads" },
  { status: "qualified", title: "Qualified" },
  { status: "client", title: "Clients" },
  { status: "to_reactivate", title: "To be reactivated" },
  { status: "declined", title: "Declined" },
  { status: "rejected", title: "Rejected" },
]

function AssessmentDot({ decision, pending }: { decision?: string | null; pending?: boolean }) {
  if (pending) {
    return <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">Pending</Badge>
  }
  if (!decision) return null
  switch (decision) {
    case "engagement":
      return <Badge className="text-[10px] py-0 px-1.5 bg-green-100 text-green-700 border-0">Pass</Badge>
    case "engagement_sous_conditions":
      return <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-700 border-0">Review</Badge>
    case "non_engagement":
      return <Badge className="text-[10px] py-0 px-1.5 bg-red-100 text-red-700 border-0">Fail</Badge>
    default:
      return null
  }
}

function ScoreBadge({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const who = repreneur.who_score ?? repreneur.tier1_score ?? 0
  const when = repreneur.when_score ?? 0
  const total = who + when
  if (total === 0) return null

  const color = total >= 140 ? "text-green-700 bg-green-50" :
    total >= 100 ? "text-blue-700 bg-blue-50" :
    total >= 60 ? "text-yellow-700 bg-yellow-50" :
    "text-muted-foreground bg-muted"

  return (
    <span aria-label={`Combined WHO and WHEN score: ${total} points`} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold ${color}`}>
      {total} pts
    </span>
  )
}

function PipelineCard({ repreneur }: { repreneur: RepreneurWithOffers }) {
  const router = useRouter()

  const renderStatusInfo = () => {
    switch (repreneur.lifecycle_status) {
      case "qualified":
        return <AssessmentDot decision={repreneur.assessment_decision} pending={repreneur.assessment_pending} />
      case "client":
        if (repreneur.offer_names && repreneur.offer_names.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {repreneur.offer_names.slice(0, 2).map((name, idx) => (
                <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                  <Package className="size-2.5 mr-0.5" />
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
      case "declined":
        if (repreneur.declined_at) {
          return (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(repreneur.declined_at), { addSuffix: true })}
            </span>
          )
        }
        return null
      case "rejected":
        if (repreneur.rejected_at) {
          return (
            <span className="text-xs text-muted-foreground">
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
    <button
      type="button"
      className="mb-2 w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-border/90 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push(`/repreneurs/${repreneur.id}`)}
      onMouseEnter={() => router.prefetch(`/repreneurs/${repreneur.id}`)}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">
            <RepreneurAvatar
              repreneurId={repreneur.id}
              avatarUrl={repreneur.avatar_url}
              firstName={repreneur.first_name}
              lastName={repreneur.last_name}
              size="sm"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight text-foreground">
              {repreneur.first_name} {repreneur.last_name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{repreneur.email}</p>
          </div>
          <ScoreBadge repreneur={repreneur} />
        </div>
        {renderStatusInfo()}
      </div>
    </button>
  )
}

function PipelineColumn({
  title,
  repreneurs,
}: {
  title: string
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
    <section className="min-w-[272px] max-w-[336px] flex-1 snap-start overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge variant="secondary" className="tabular-nums">
            {repreneurs.length}
          </Badge>
        </div>
      </div>
      <div className="min-h-[calc(100vh-320px)] max-h-[calc(100vh-200px)] overflow-y-auto bg-muted/15 p-2.5">
        {visibleRepreneurs.map((repreneur) => (
          <PipelineCard key={repreneur.id} repreneur={repreneur} />
        ))}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMore}
            className="mt-2 w-full text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-4 mr-1" />
            Show {Math.min(remainingCount, LOAD_MORE_COUNT)} more ({remainingCount} hidden)
          </Button>
        )}

        {repreneurs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()}</p>
        )}
      </div>
    </section>
  )
}

type SortMode = "score" | "date"

export function StaticPipelineBoard({ repreneurs }: StaticPipelineBoardProps) {
  const [sortMode, setSortMode] = useState<SortMode>("score")

  // Extract unique sources from repreneurs
  const sources = useMemo(() => {
    const uniqueSources = new Set<string>()
    repreneurs.forEach((r) => {
      if (r.source) uniqueSources.add(r.source)
    })
    return Array.from(uniqueSources).sort()
  }, [repreneurs])

  const filterDefinitions = useMemo<CollectionFilterDefinition[]>(() => [
    { key: "source", label: "Source", options: sources.map((source) => ({ value: source, label: source })) },
    {
      key: "added",
      label: "Added",
      options: [
        { value: "7", label: "Last 7 days" },
        { value: "30", label: "Last 30 days" },
        { value: "90", label: "Last 90 days" },
      ],
    },
  ], [sources])
  const filters = useCollectionFilters({ definitions: filterDefinitions })
  const sourceFilter = filters.values.source || ""
  const dateRange = filters.values.added || "all"

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
      if (sourceFilter && r.source !== sourceFilter) {
        return false
      }

      // Date range filter
      if (dateRange !== "all") {
        const days = parseInt(dateRange)
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        if (new Date(r.created_at) < cutoffDate) {
          return false
        }
      }

      return true
    })
  }, [repreneurs, filters.search, sourceFilter, dateRange])

  // Group by status and sort by selected mode
  const groupedByStatus = useMemo(() => {
    const getTotal = (r: RepreneurWithOffers) => {
      const who = r.who_score ?? r.tier1_score ?? 0
      const when = r.when_score ?? 0
      return who + when
    }

    return COLUMNS.reduce((acc, col) => {
      const filtered = filteredRepreneurs.filter((r) => r.lifecycle_status === col.status)

      if (sortMode === "score") {
        filtered.sort((a, b) => {
          const scoreA = getTotal(a)
          const scoreB = getTotal(b)
          if (scoreA === 0 && scoreB === 0) return 0
          if (scoreA === 0) return 1
          if (scoreB === 0) return -1
          return scoreB - scoreA
        })
      } else {
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }

      acc[col.status] = filtered
      return acc
    }, {} as Record<LifecycleStatus, RepreneurWithOffers[]>)
  }, [filteredRepreneurs, sortMode])

  return (
    <div className="flex flex-col gap-4">
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
        resultCount={filteredRepreneurs.length}
        totalCount={repreneurs.length}
        resultLabel="repreneur"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={() => setSortMode(sortMode === "score" ? "date" : "score")}
          >
            <ArrowUpDown className="size-3.5" />
            {sortMode === "score" ? "By score" : "By date"}
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-md border bg-muted/25 px-3 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">
            Status changes are action-driven. To move a repreneur:{" "}
            <span className="font-medium">qualify manually</span> (→ Qualified),{" "}
            <span className="font-medium">assign an offer</span> (→ Client),{" "}
            <span className="font-medium">Decline</span> (internal, no email), or{" "}
            <span className="font-medium">Reject</span> (sends email).
          </p>
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-3">
        {COLUMNS.map((column) => (
          <PipelineColumn
            key={column.status}
            title={column.title}
            repreneurs={groupedByStatus[column.status] || []}
          />
        ))}
      </div>
    </div>
  )
}
