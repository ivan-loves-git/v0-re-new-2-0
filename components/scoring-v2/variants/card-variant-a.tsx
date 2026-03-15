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

interface CardVariantAProps {
  data: DualScoreData
  repreneurId?: string
}

// Variant A: Stacked vertically (WHO on top, WHEN below) - closest to current design
export function CardVariantA({ data, repreneurId }: CardVariantAProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
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
                <strong>WHO (0-100):</strong> Profile quality and execution capacity based on experience, leadership, and investment history.
              </p>
              <p className="text-sm mt-2">
                <strong>WHEN (0-100):</strong> Project maturity and financial coherence based on deal size, structure, and equity fit.
              </p>
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WHO Score */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHO</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="size-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="max-w-xs p-3">
                <p className="text-sm">Profile quality: experience, leadership, crisis management, investment decisions.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{data.who ?? "—"}</span>
            <span className="text-sm text-gray-500">points</span>
            {repreneurId && (
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 h-6 px-2 ml-auto" asChild>
                <Link href={`/repreneurs/${repreneurId}/questionnaire`}>
                  <Pencil className="size-3" />
                </Link>
              </Button>
            )}
          </div>
          <Badge variant="outline" className="text-xs mt-2">
            {getWhoDescription(data.who)}
          </Badge>
        </div>

        <div className="border-t" />

        {/* WHEN Score */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHEN</span>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="size-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="max-w-xs p-3">
                <p className="text-sm">Project maturity: deal size, capital structure, equity contribution, project status.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{data.when ?? "—"}</span>
            <span className="text-sm text-gray-500">points</span>
          </div>
          <Badge variant="outline" className="text-xs mt-2">
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
