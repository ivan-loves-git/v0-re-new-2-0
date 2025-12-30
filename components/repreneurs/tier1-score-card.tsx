"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Target, Star, Calculator, Pencil, CheckCircle } from "lucide-react"
import { scoreToStarRating, getScoreDescription } from "@/lib/utils/tier1-scoring"
import type { Repreneur } from "@/lib/types/repreneur"

interface Tier1ScoreCardProps {
  repreneur: Repreneur
}

export function Tier1ScoreCard({ repreneur }: Tier1ScoreCardProps) {
  const hasScore = repreneur.tier1_score !== null && repreneur.tier1_score !== undefined
  const isCompleted = !!repreneur.questionnaire_completed_at

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tier 1 Score
            </CardTitle>
            {isCompleted && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                Calculated from questionnaire
              </CardDescription>
            )}
          </div>
          {hasScore && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          )}
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
            <Badge variant="outline" className="text-xs">
              {getScoreDescription(repreneur.tier1_score!)}
            </Badge>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No score calculated yet. Complete the intake questionnaire to generate an automated score.
            </p>
            <Button className="w-full" asChild>
              <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Tier 1 Score
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
