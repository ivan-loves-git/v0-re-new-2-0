"use client"

import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Suggestion {
  id: string
  firstName: string
  lastName: string
  email: string
  journeyStage: string | null
  daysSinceContact: number
}

export function FollowUpSuggestionsWidget({
  suggestions,
  totalCount,
}: {
  suggestions: Suggestion[]
  totalCount: number
}) {
  if (suggestions.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Follow-up queue</CardTitle>
            <Badge variant="secondary">{totalCount}</Badge>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tools/wave-ai">Open WAVE AI <ArrowRight /></Link>
          </Button>
        </div>
        <CardDescription>Deterministic list of repreneurs with no recorded contact for at least 14 days.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y rounded-lg border p-0">
        {suggestions.slice(0, 5).map((suggestion) => (
          <Link
            key={suggestion.id}
            href={`/tools/wave-ai?repreneur=${suggestion.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <span className="grid min-w-0">
              <span className="truncate font-medium">{suggestion.firstName} {suggestion.lastName}</span>
              <span className="truncate text-xs text-muted-foreground">{suggestion.journeyStage?.replace(/_/g, " ") || "Unknown stage"}</span>
            </span>
            <Badge variant={suggestion.daysSinceContact > 30 ? "destructive" : "outline"}>{suggestion.daysSinceContact}d</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

