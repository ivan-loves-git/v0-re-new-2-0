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
  getScoreBgColor,
} from "../types"

interface CardVariantCProps {
  data: DualScoreData
  repreneurId?: string
}

// Variant C: With progress bars (visual score indicator)
export function CardVariantC({ data, repreneurId }: CardVariantCProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5" />
            Rating
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="size-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-xs p-3">
                <p className="text-sm">
                  <strong>WHO (0-100):</strong> Profile quality and execution capacity.
                </p>
                <p className="text-sm mt-2">
                  <strong>WHEN (0-100):</strong> Project maturity and financial coherence.
                </p>
              </PopoverContent>
            </Popover>
          </CardTitle>
          {repreneurId && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-muted-foreground h-6 px-2" asChild>
              <Link href={`/repreneurs/${repreneurId}/questionnaire`}>
                <Pencil className="size-3 mr-1" />
                <span className="text-xs">Edit</span>
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WHO with progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="wave-micro-label">WHO</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="size-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" className="max-w-xs p-3">
                  <p className="text-sm">Profile quality: experience, leadership, crisis management.</p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{data.who ?? "—"}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(data.who)}`}
              style={{ width: `${data.who ?? 0}%` }}
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {getWhoDescription(data.who)}
          </Badge>
        </div>

        {/* WHEN with progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="wave-micro-label">WHEN</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="size-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" className="max-w-xs p-3">
                  <p className="text-sm">Project maturity: deal size, structure, equity fit.</p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{data.when ?? "—"}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(data.when)}`}
              style={{ width: `${data.when ?? 0}%` }}
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {getWhenDescription(data.when)}
          </Badge>
        </div>

        {/* Flags */}
        {data.flags.length > 0 && (
          <>
            <div className="border-t" />
            <FlagBadges flags={data.flags} />
          </>
        )}

        {/* Recommendation */}
        <div className="border-t pt-3">
          <Badge className={getRecommendationBadgeClass(data.recommendation)}>
            {getRecommendationLabel(data.recommendation)}
          </Badge>
        </div>

        {/* Incomplete warning */}
        {data.needsDataCompletion && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
            Some data missing - complete questionnaire for full score
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function getWhoDescription(score: number | null): string {
  if (score === null) return "Not calculated"
  if (score >= 80) return "Excellent profile"
  if (score >= 60) return "Strong candidate"
  if (score >= 40) return "Moderate profile"
  return "Early stage"
}

function getWhenDescription(score: number | null): string {
  if (score === null) return "Not calculated"
  if (score >= 80) return "Project framed"
  if (score >= 60) return "Good clarity"
  if (score >= 40) return "Needs refinement"
  return "Explorer"
}

function getRecommendationBadgeClass(rec: string): string {
  switch (rec) {
    case "deal_flow":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
    case "interview_validate_thesis":
    case "interview_validate_execution":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
    default:
      return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
  }
}
