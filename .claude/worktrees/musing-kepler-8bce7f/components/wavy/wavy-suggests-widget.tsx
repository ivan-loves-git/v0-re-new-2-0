"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, MessageCircle, Waves } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Suggestion {
  id: string
  firstName: string
  lastName: string
  email: string
  journeyStage: string | null
  daysSinceContact: number
}

interface WavySuggestsWidgetProps {
  suggestions: Suggestion[]
  totalCount: number
}

export function WavySuggestsWidget({ suggestions, totalCount }: WavySuggestsWidgetProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="size-5 text-blue-500" />
            <CardTitle className="text-base">Wavy Suggests</CardTitle>
            {totalCount > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {totalCount}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tools/wavy">
              Open Wavy
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
        <CardDescription>
          Repreneurs who need a follow-up (14+ days since last contact)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {suggestions.slice(0, 5).map((suggestion) => (
            <Link
              key={suggestion.id}
              href={`/tools/wavy?repreneur=${suggestion.id}`}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <MessageCircle className="size-4" />
                </div>
                <div>
                  <p className="font-medium">
                    {suggestion.firstName} {suggestion.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.journeyStage?.replace(/_/g, " ") || "Unknown stage"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant={suggestion.daysSinceContact > 30 ? "destructive" : "secondary"}
                  className="rounded-full"
                >
                  {suggestion.daysSinceContact}d ago
                </Badge>
              </div>
            </Link>
          ))}
        </div>
        {totalCount > 5 && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            +{totalCount - 5} more repreneurs need follow-up
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Server component wrapper that fetches data
export async function WavySuggestsWidgetServer() {
  try {
    // Use absolute URL for server-side fetch
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/wavy/suggestions`, {
      cache: "no-store",
      headers: {
        Cookie: "", // Will need to forward cookies for auth
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return (
      <WavySuggestsWidget
        suggestions={data.suggestions}
        totalCount={data.totalCount}
      />
    )
  } catch (error) {
    console.error("Failed to fetch Wavy suggestions:", error)
    return null
  }
}
