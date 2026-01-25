"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Star, Info, Pencil } from "lucide-react"
import { FlagBadges } from "../flag-badges"
import {
  DualScoreData,
  getRecommendationLabel,
} from "../types"

interface CardVariantDProps {
  data: DualScoreData
  repreneurId?: string
}

// Variant D: Compact - minimal space, good for dense layouts
export function CardVariantD({ data, repreneurId }: CardVariantDProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4" />
            Rating
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-xs p-3">
                <p className="text-sm">
                  <strong>WHO:</strong> Profile quality. <strong>WHEN:</strong> Project maturity.
                </p>
              </PopoverContent>
            </Popover>
          </CardTitle>
          {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Inline scores */}
        <div className="flex items-center gap-6">
          {/* WHO */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">WHO</span>
            <span className={`text-2xl font-bold ${getScoreColorClass(data.who)}`}>
              {data.who ?? "—"}
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-200" />

          {/* WHEN */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">WHEN</span>
            <span className={`text-2xl font-bold ${getScoreColorClass(data.when)}`}>
              {data.when ?? "—"}
            </span>
          </div>

          {/* Edit button */}
          {repreneurId && (
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 h-6 px-2 ml-auto" asChild>
              <Link href={`/repreneurs/${repreneurId}/questionnaire`}>
                <Pencil className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>

        {/* Recommendation */}
        <div className="flex items-center gap-2">
          <Badge className={getRecommendationBadgeClass(data.recommendation)} variant="outline">
            {getRecommendationLabel(data.recommendation)}
          </Badge>
          {data.needsDataCompletion && (
            <span className="text-xs text-amber-600">Incomplete</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function getScoreColorClass(score: number | null): string {
  if (score === null) return "text-gray-400"
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-blue-600"
  if (score >= 40) return "text-amber-600"
  return "text-red-600"
}

function getRecommendationBadgeClass(rec: string): string {
  switch (rec) {
    case "deal_flow":
      return "bg-green-50 text-green-700 border-green-200"
    case "interview_validate_thesis":
    case "interview_validate_execution":
      return "bg-blue-50 text-blue-700 border-blue-200"
    default:
      return "bg-amber-50 text-amber-700 border-amber-200"
  }
}
