"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"

interface TopCandidate {
  id: string
  first_name: string
  last_name: string
  lifecycle_status: string
  tier1_score: number | null
}

interface TopTier1CandidatesProps {
  candidates: TopCandidate[]
  itemsPerPage?: number
}

const ITEMS_PER_PAGE = 5
const ITEM_HEIGHT = 44 // height of each candidate row in pixels

export function TopTier1Candidates({ candidates, itemsPerPage = ITEMS_PER_PAGE }: TopTier1CandidatesProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const totalPages = Math.ceil(candidates.length / itemsPerPage)

  const startIndex = currentPage * itemsPerPage
  const visibleCandidates = candidates.slice(startIndex, startIndex + itemsPerPage)

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

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 bg-green-50"
    if (score >= 50) return "text-yellow-600 bg-yellow-50"
    if (score >= 30) return "text-orange-600 bg-orange-50"
    return "text-gray-600 bg-gray-50"
  }

  // Fixed height for consistent layout regardless of page content
  const listHeight = ITEMS_PER_PAGE * ITEM_HEIGHT

  return (
    <Card className="h-full flex flex-col gap-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-gray-900" />
          Top Tier 1
          <CardInfoButton info="Tier 1 score is calculated from questionnaire responses: experience, leadership, M&A knowledge, readiness, and financial capacity." />
        </CardTitle>
        <CardLinkButton href="/pipeline" tooltip="View Pipeline" />
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-2" style={{ minHeight: listHeight }}>
          {visibleCandidates.length > 0 ? (
            visibleCandidates.map((candidate, index) => {
              const actualIndex = startIndex + index
              return (
                <Link
                  key={candidate.id}
                  href={`/repreneurs/${candidate.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-gray-50 transition-colors h-10"
                >
                  <div className="flex items-center justify-center w-6">
                    {actualIndex < 3 ? (
                      <Medal className={`h-5 w-5 ${getMedalColor(index)}`} />
                    ) : (
                      <span className="text-sm text-gray-400 font-medium">{actualIndex + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {candidate.first_name} {candidate.last_name}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded text-sm font-bold ${getScoreColor(candidate.tier1_score || 0)}`}>
                    {candidate.tier1_score || 0}
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No scored candidates
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3 mt-2 border-t">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
