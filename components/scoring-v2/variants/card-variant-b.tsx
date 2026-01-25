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

interface CardVariantBProps {
  data: DualScoreData
  repreneurId?: string
}

// Variant B: Side by side horizontally - designed to combine with Tier 2 below
export function CardVariantB({ data, repreneurId }: CardVariantBProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Rating
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-4 w-4" />
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

          {/* Right side: Recommendation + Flags + Edit */}
          <div className="flex items-center gap-2">
            <Badge className={getRecommendationBadgeClass(data.recommendation)} variant="outline">
              {getRecommendationLabel(data.recommendation)}
            </Badge>
            {data.flags.length > 0 && <FlagBadges flags={data.flags} compact />}
            {repreneurId && (
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 h-6 px-2" asChild>
                <Link href={`/repreneurs/${repreneurId}/questionnaire`}>
                  <Pencil className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Two scores side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* WHO */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHO</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs p-3">
                  <p className="text-sm">Profile quality: experience, leadership, crisis management.</p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{data.who ?? "—"}</span>
              <span className="text-sm text-gray-500">pts</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {getWhoDescription(data.who)}
            </Badge>
          </div>

          {/* WHEN */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHEN</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs p-3">
                  <p className="text-sm">Project maturity: deal size, structure, equity fit.</p>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{data.when ?? "—"}</span>
              <span className="text-sm text-gray-500">pts</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {getWhenDescription(data.when)}
            </Badge>
          </div>
        </div>

        {/* Incomplete warning - subtle */}
        {data.needsDataCompletion && (
          <p className="text-xs text-amber-600 mt-3">
            Some data missing
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
