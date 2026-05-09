"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"

interface AssessmentEntry {
  id: string
  first_name: string
  last_name: string
  repreneur_id: string
  decision: string | null
  completed: boolean
}

interface AssessmentStatusProps {
  assessments: AssessmentEntry[]
  totalRepreneurs: number
}

const kpiInfo = {
  assessmentStatus: {
    title: "Leadership Assessment Status",
    description: "Overview of leadership potential assessments across all repreneurs. Shows completed assessments by decision outcome and pending assessments waiting for completion.",
    why: "Tracks assessment coverage and outcomes. Helps identify repreneurs who still need assessment and monitors the distribution of engagement decisions.",
  },
}

export function AssessmentStatus({ assessments, totalRepreneurs }: AssessmentStatusProps) {
  const completed = assessments.filter(a => a.completed)
  const pending = assessments.filter(a => !a.completed)
  const notSent = totalRepreneurs - assessments.length

  const engagement = completed.filter(a => a.decision === "engagement")
  const conditional = completed.filter(a => a.decision === "engagement_sous_conditions")
  const nonEngagement = completed.filter(a => a.decision === "non_engagement")

  const rows = [
    { label: "Pass", count: engagement.length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", items: engagement },
    { label: "Review", count: conditional.length, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", items: conditional },
    { label: "Fail", count: nonEngagement.length, icon: XCircle, color: "text-red-600", bg: "bg-red-50", items: nonEngagement },
    { label: "Pending", count: pending.length, icon: Clock, color: "text-gray-500", bg: "bg-gray-50", items: pending },
  ]

  return (
    <Card className="h-full flex flex-col gap-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-5 text-gray-900" />
          Assessments
          <CardInfoButton info={kpiInfo.assessmentStatus} />
        </CardTitle>
        <CardLinkButton href="/analytics" tooltip="View Analytics" />
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-gray-50 border">
            <p className="text-2xl font-bold">{completed.length}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50 border">
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50 border">
            <p className="text-2xl font-bold">{notSent}</p>
            <p className="text-xs text-gray-500">Not sent</p>
          </div>
        </div>

        {/* Breakdown rows */}
        <div className="space-y-2 flex-1">
          {rows.map(row => {
            if (row.count === 0) return null
            const Icon = row.icon
            return (
              <div key={row.label} className={`flex items-center gap-3 p-2 rounded-lg border ${row.bg}`}>
                <Icon className={`size-4 ${row.color}`} />
                <span className={`text-sm font-medium ${row.color}`}>{row.label}</span>
                <Badge variant="secondary" className="ml-auto">{row.count}</Badge>
              </div>
            )
          })}
          {completed.length === 0 && pending.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assessments yet
            </p>
          )}
        </div>

        {/* Recent completed assessments */}
        {completed.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-2">Recent results</p>
            <div className="space-y-1">
              {completed.slice(0, 3).map(a => (
                <Link
                  key={a.id}
                  href={`/repreneurs/${a.repreneur_id}`}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm truncate flex-1">{a.first_name} {a.last_name}</span>
                  {a.decision === "engagement" && (
                    <Badge className="text-[10px] py-0 bg-green-100 text-green-700 border-0">Pass</Badge>
                  )}
                  {a.decision === "engagement_sous_conditions" && (
                    <Badge className="text-[10px] py-0 bg-amber-100 text-amber-700 border-0">Review</Badge>
                  )}
                  {a.decision === "non_engagement" && (
                    <Badge className="text-[10px] py-0 bg-red-100 text-red-700 border-0">Fail</Badge>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
