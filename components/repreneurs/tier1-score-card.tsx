"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Filter, Star, Calculator, Info } from "lucide-react"
import { scoreToStarRating, getScoreDescription } from "@/lib/utils/tier1-scoring"
import type { Repreneur } from "@/lib/types/repreneur"

interface Tier1ScoreCardProps {
  repreneur: Repreneur
}

export function Tier1ScoreCard({ repreneur }: Tier1ScoreCardProps) {
  const hasScore = repreneur.tier1_score !== null && repreneur.tier1_score !== undefined

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Tier 1 Rating
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-xs p-3">
                <p className="text-sm">
                  Tier 1 is an automated score (0-100 points) calculated from the intake questionnaire.
                  It evaluates professional background, M&A experience, acquisition readiness, and financial capacity.
                </p>
              </PopoverContent>
            </Popover>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Calculated from questionnaire
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {hasScore ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{repreneur.tier1_score}</span>
              <span className="text-sm text-gray-500">points</span>
              <div className="flex items-center gap-1 ml-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < scoreToStarRating(repreneur.tier1_score!)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getScoreDescription(repreneur.tier1_score!)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-400 hover:text-gray-600 h-6 px-2"
                asChild
              >
                <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                  Edit data
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No score calculated yet. Complete the intake questionnaire to generate an automated score.
            </p>
            <Button className="w-full" asChild>
              <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Tier 1 Rating
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
