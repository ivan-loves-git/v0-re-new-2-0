"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target } from "lucide-react"

export function PlatformGoal() {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-blue-50">
            <Target className="h-4 w-4 text-blue-600" />
          </div>
          What is Wave 1.0?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-gray-600">
        <p>
          <strong className="text-gray-900">Wave 1.0 is Re-New's internal management platform</strong> — built to replace
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
          The platform is the <strong className="text-gray-900">operational cockpit of Re-New</strong> — providing visibility
          into leads, active prospects, clients, and the full pipeline of activity.
        </p>
      </CardContent>
    </Card>
  )
}
