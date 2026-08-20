"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, Medal, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { subDays } from "date-fns"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"
import { useHydratedNow } from "@/hooks/use-hydrated-now"

interface TopRepreneur {
  id: string
  first_name: string
  last_name: string
  lifecycle_status: string
  tier1_score: number | null
  who_score?: number | null
  when_score?: number | null
  created_at: string
}

interface TopTier1RepreneursProps {
  repreneurs: TopRepreneur[]
  itemsPerPage?: number
}

const ITEMS_PER_PAGE = 5
const ITEM_HEIGHT = 42

const kpiInfo = {
  topTier1: {
    title: "Top Rated Repreneurs",
    description: "Repreneurs ranked by combined WHO + WHEN score (0-200). WHO measures profile quality and execution capacity. WHEN measures project maturity and financial coherence.",
    why: "Quickly identify your most qualified leads. Higher combined scores indicate better preparation for business acquisition, helping you prioritize outreach and meetings.",
  },
}

export function TopTier1Repreneurs({ repreneurs, itemsPerPage = ITEMS_PER_PAGE }: TopTier1RepreneursProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [timeRange, setTimeRange] = useState<string>("all")
  const now = useHydratedNow()

  const filteredRepreneurs = useMemo(() => {
    if (timeRange === "all") return repreneurs
    const days = parseInt(timeRange)
    if (now === null) return repreneurs
    const cutoff = subDays(new Date(now), days)
    return repreneurs.filter((r) => new Date(r.created_at) >= cutoff)
  }, [repreneurs, timeRange, now])

  const totalPages = Math.ceil(filteredRepreneurs.length / itemsPerPage)

  const startIndex = currentPage * itemsPerPage
  const visibleRepreneurs = filteredRepreneurs.slice(startIndex, startIndex + itemsPerPage)

  const getMedalColor = (index: number) => {
    const actualIndex = startIndex + index
    switch (actualIndex) {
      case 0:
        return "text-warning"
      case 1:
        return "text-muted-foreground"
      case 2:
        return "text-warning/80"
      default:
        return "text-muted-foreground/50"
    }
  }

  // Combined score (WHO + WHEN) ranges from 0-200
  const getScoreColor = (score: number) => {
    if (score >= 140) return "text-success"
    if (score >= 100) return "text-info"
    if (score >= 60) return "text-warning"
    return "text-muted-foreground"
  }

  const getScores = (repreneur: TopRepreneur) => {
    const who = repreneur.who_score ?? repreneur.tier1_score ?? 0
    const when = repreneur.when_score ?? 0
    return { who, when, total: who + when }
  }

  // Fixed height for consistent layout regardless of page content
  const listHeight = ITEMS_PER_PAGE * ITEM_HEIGHT

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-warning" />
          Top Rated
          <CardInfoButton info={kpiInfo.topTier1} />
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => { setTimeRange(v); setCurrentPage(0) }}>
            <SelectTrigger className="h-8 w-[116px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
        <SelectItem value="all">All time</SelectItem>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="14">Last 14 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <CardLinkButton href="/pipeline" tooltip="View Pipeline" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col py-2">
        <div style={{ minHeight: listHeight }}>
          {visibleRepreneurs.length > 0 ? (
            <TooltipProvider delayDuration={0}>
              {visibleRepreneurs.map((repreneur, index) => {
                const actualIndex = startIndex + index
                const scores = getScores(repreneur)
                return (
                  <Tooltip key={repreneur.id}>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/repreneurs/${repreneur.id}`}
                        className="flex h-[42px] items-center gap-3 border-b px-1 transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <div className="flex items-center justify-center w-6">
                          {actualIndex < 3 ? (
                            <Medal className={`size-5 ${getMedalColor(index)}`} />
                          ) : (
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{actualIndex + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {repreneur.first_name} {repreneur.last_name}
                          </p>
                        </div>
                        <div className={`min-w-9 text-right text-sm font-semibold tabular-nums ${getScoreColor(scores.total)}`}>
                          {scores.total}
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">WHO:</span>
                          <span className="font-medium">{scores.who}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">WHEN:</span>
                          <span className="font-medium">{scores.when || "—"}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No scored repreneurs
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-auto flex items-center justify-center gap-2 border-t pt-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              aria-label="Previous ranked repreneurs"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              aria-label="Next ranked repreneurs"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
