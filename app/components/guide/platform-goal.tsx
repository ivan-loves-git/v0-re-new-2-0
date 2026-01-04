"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target } from "lucide-react"

export function PlatformGoal() {
  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Target className="h-5 w-5" />
          What is Wave 1.0?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-gray-700">
        <p>
          <strong>Wave 1.0 is Re-New's internal management platform</strong> — built to replace
          Flatchr and give the team a purpose-built tool for managing repreneurs as long-term
          clients, not one-time candidates.
        </p>
        <p>
          Unlike a traditional ATS (Applicant Tracking System), Wave treats each repreneur as
          a relationship to nurture over time. A repreneur might start as a lead, become a
          qualified prospect after an interview, and eventually convert to a paying client
          across multiple offers.
        </p>
        <p>
          The platform is the <strong>operational cockpit of Re-New</strong> — providing visibility
          into leads, active prospects, clients, and the full pipeline of activity.
        </p>
      </CardContent>
    </Card>
  )
}
