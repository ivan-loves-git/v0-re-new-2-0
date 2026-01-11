"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Star, Medal, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"

interface TopRepreneur {
  id: string
  first_name: string
  last_name: string
  lifecycle_status: string
  tier2_stars: number | null
}

interface TopTier2RepreneursProps {
  repreneurs: TopRepreneur[]
  itemsPerPage?: number
}

const ITEMS_PER_PAGE = 5
const ITEM_HEIGHT = 44 // height of each repreneur row in pixels

const kpiInfo = {
  topTier2: {
    title: "Tier 2 Rating Ranking",
    description: "Repreneurs ranked by their Tier 2 star rating (1-5 stars). This is a subjective assessment assigned by the Re-New team after meeting with the repreneur.",
    why: "Combines human judgment with data. High Tier 2 ratings indicate repreneurs who made a strong impression in interviews and have strong potential for success.",
  },
}

export function TopTier2Repreneurs({ repreneurs, itemsPerPage = ITEMS_PER_PAGE }: TopTier2RepreneursProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const totalPages = Math.ceil(repreneurs.length / itemsPerPage)

  const startIndex = currentPage * itemsPerPage
  const visibleRepreneurs = repreneurs.slice(startIndex, startIndex + itemsPerPage)

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

  const renderStars = (stars: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i <= stars
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-200"
            }`}
          />
        ))}
      </div>
    )
  }

  // Fixed height for consistent layout regardless of page content
  const listHeight = ITEMS_PER_PAGE * ITEM_HEIGHT

  return (
    <Card className="h-full flex flex-col gap-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-5 w-5 text-gray-900" />
          Top Tier 2
          <CardInfoButton info={kpiInfo.topTier2} />
        </CardTitle>
        <CardLinkButton href="/pipeline" tooltip="View Pipeline" />
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        <div className="space-y-2" style={{ minHeight: listHeight }}>
          {visibleRepreneurs.length > 0 ? (
            visibleRepreneurs.map((repreneur, index) => {
              const actualIndex = startIndex + index
              return (
                <Link
                  key={repreneur.id}
                  href={`/repreneurs/${repreneur.id}`}
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
                      {repreneur.first_name} {repreneur.last_name}
                    </p>
                  </div>
                  {renderStars(repreneur.tier2_stars || 0)}
                </Link>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No rated repreneurs
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
