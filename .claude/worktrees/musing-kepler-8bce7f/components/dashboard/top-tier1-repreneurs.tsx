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
const ITEM_HEIGHT = 44 // height of each repreneur row in pixels

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

  const filteredRepreneurs = useMemo(() => {
    if (timeRange === "all") return repreneurs
    const days = parseInt(timeRange)
    const cutoff = subDays(new Date(), days)
    return repreneurs.filter((r) => new Date(r.created_at) >= cutoff)
  }, [repreneurs, timeRange])

  const totalPages = Math.ceil(filteredRepreneurs.length / itemsPerPage)

  const startIndex = currentPage * itemsPerPage
  const visibleRepreneurs = filteredRepreneurs.slice(startIndex, startIndex + itemsPerPage)

  const getMedalColor = (index: number) => {
    const actualIndex = startIndex + index
    switch (actualIndex) {
      case 0:
        return "text-yellow-500"
      case 1:
        return "text-gray-400"
      case 2:
        return "text-amber-600"
      default:
        return "text-gray-300"
    }
  }

  // Combined score (WHO + WHEN) ranges from 0-200
  const getScoreColor = (score: number) => {
    if (score >= 140) return "text-green-600 bg-green-50"
    if (score >= 100) return "text-blue-600 bg-blue-50"
    if (score >= 60) return "text-yellow-600 bg-yellow-50"
    return "text-gray-600 bg-gray-50"
  }

  const getScores = (repreneur: TopRepreneur) => {
    const who = repreneur.who_score ?? repreneur.tier1_score ?? 0
    const when = repreneur.when_score ?? 0
    return { who, when, total: who + when }
  }

  // Fixed height for consistent layout regardless of page content
  const listHeight = ITEMS_PER_PAGE * ITEM_HEIGHT

  return (
    <Card className="h-full flex flex-col gap-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-5 text-gray-900" />
          Top Rated
          <CardInfoButton info={kpiInfo.topTier1} />
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => { setTimeRange(v); setCurrentPage(0) }}>
            <SelectTrigger className="h-7 w-[120px] text-xs">
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
      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-2" style={{ minHeight: listHeight }}>
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
                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-gray-50 transition-colors h-10"
                      >
                        <div className="flex items-center justify-center w-6">
                          {actualIndex < 3 ? (
                            <Medal className={`size-5 ${getMedalColor(index)}`} />
                          ) : (
                            <span className="text-sm text-gray-400 font-medium">{actualIndex + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {repreneur.first_name} {repreneur.last_name}
                          </p>
                        </div>
                        <div className={`px-2 py-1 rounded text-sm font-bold ${getScoreColor(scores.total)}`}>
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
          <div className="flex items-center justify-center gap-2 pt-3 mt-2 border-t">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-gray-500">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
