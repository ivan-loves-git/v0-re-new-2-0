"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal } from "lucide-react"
import Link from "next/link"
import { StatusBadge } from "@/components/repreneurs/status-badge"

interface TopRepreneur {
  id: string
  first_name: string
  last_name: string
  lifecycle_status: string
  overall_score: number
}

interface TopScoredRepreneursProps {
  repreneurs: TopRepreneur[]
}

export function TopScoredRepreneurs({ repreneurs }: TopScoredRepreneursProps) {
  const getMedalColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500" // Gold
      case 1:
        return "text-gray-400"   // Silver
      case 2:
        return "text-amber-600"  // Bronze
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5" />
          Top Repreneurs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {repreneurs.length > 0 ? (
            repreneurs.slice(0, 5).map((repreneur, index) => (
              <Link
                key={repreneur.id}
                href={`/repreneurs/${repreneur.id}`}
                className="flex items-center gap-3 p-2 rounded-lg border hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-center w-6">
                  {index < 3 ? (
                    <Medal className={`h-5 w-5 ${getMedalColor(index)}`} />
                  ) : (
                    <span className="text-sm text-gray-400 font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {repreneur.first_name} {repreneur.last_name}
                  </p>
                  <StatusBadge status={repreneur.lifecycle_status} />
                </div>
                <div className={`px-2 py-1 rounded-md text-sm font-bold ${getScoreColor(repreneur.overall_score)}`}>
                  {repreneur.overall_score}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No scored repreneurs yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
