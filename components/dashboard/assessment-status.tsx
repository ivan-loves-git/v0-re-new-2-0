"use client"

import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CardInfoButton } from "./card-info-button"
import { CardLinkButton } from "./card-link-button"

export interface AssessmentEntry {
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
    title: "Leadership assessment status",
    description: "The latest leadership assessment for each repreneur, grouped by outcome.",
    why: "This keeps outstanding assessment work and decision quality visible together.",
  },
}

function assessmentState(entry: AssessmentEntry) {
  if (!entry.completed) {
    return { label: "Pending", icon: Clock3, className: "border-border bg-muted/50 text-muted-foreground" }
  }
  if (entry.decision === "engagement") {
    return { label: "Pass", icon: CheckCircle2, className: "border-success/20 bg-success/5 text-success" }
  }
  if (entry.decision === "engagement_sous_conditions") {
    return { label: "Review", icon: AlertCircle, className: "border-warning/25 bg-warning/5 text-warning" }
  }
  return { label: "Fail", icon: XCircle, className: "border-destructive/20 bg-destructive/5 text-destructive" }
}

export function AssessmentStatus({ assessments, totalRepreneurs }: AssessmentStatusProps) {
  const completed = assessments.filter((assessment) => assessment.completed)
  const pending = assessments.filter((assessment) => !assessment.completed)
  const notSent = Math.max(0, totalRepreneurs - assessments.length)

  const rows = [
    {
      label: "Pass",
      count: completed.filter((assessment) => assessment.decision === "engagement").length,
      icon: CheckCircle2,
      className: "border-success/20 bg-success/5 text-success",
    },
    {
      label: "Review",
      count: completed.filter((assessment) => assessment.decision === "engagement_sous_conditions").length,
      icon: AlertCircle,
      className: "border-warning/25 bg-warning/5 text-warning",
    },
    {
      label: "Fail",
      count: completed.filter((assessment) => assessment.decision === "non_engagement").length,
      icon: XCircle,
      className: "border-destructive/20 bg-destructive/5 text-destructive",
    },
    {
      label: "Pending",
      count: pending.length,
      icon: Clock3,
      className: "border-border bg-muted/50 text-muted-foreground",
    },
  ]

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-muted-foreground" />
          Assessments
          <CardInfoButton info={kpiInfo.assessmentStatus} />
        </CardTitle>
        <CardLinkButton href="/analytics_re" tooltip="View assessment analytics" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 py-3">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <div
              key={row.label}
              className={cn("flex min-h-10 items-center gap-2.5 rounded-md border px-3", row.className)}
            >
              <Icon className="size-4" />
              <span className="text-sm font-medium">{row.label}</span>
              <span className="ml-auto text-sm font-semibold tabular-nums">{row.count}</span>
            </div>
          )
        })}

        <div className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
          <div>
            <p className="text-base font-semibold tabular-nums">{completed.length}</p>
            <p className="text-[11px] text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">{pending.length}</p>
            <p className="text-[11px] text-muted-foreground">Pending</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums">{notSent}</p>
            <p className="text-[11px] text-muted-foreground">Not sent</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentAssessmentResults({ assessments }: { assessments: AssessmentEntry[] }) {
  const recent = assessments.slice(0, 5)

  return (
    <Card className="h-full gap-0 py-0">
      <CardHeader className="flex min-h-14 flex-row items-center justify-between border-b py-3">
        <CardTitle>Recent results</CardTitle>
        <CardLinkButton href="/analytics_re" tooltip="View all assessment results" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col py-2">
        {recent.length > 0 ? (
          recent.map((assessment) => {
            const state = assessmentState(assessment)
            const Icon = state.icon
            return (
              <Link
                key={assessment.id}
                href={`/repreneurs/${assessment.repreneur_id}`}
                className="group flex min-h-[46px] items-center gap-3 border-b py-2 last:border-b-0 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Icon className={cn("size-4 shrink-0", state.className.split(" ").at(-1))} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {assessment.first_name} {assessment.last_name}
                </span>
                <Badge variant="outline" className={cn("shrink-0", state.className)}>
                  {state.label}
                </Badge>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )
          })
        ) : (
          <div className="grid flex-1 place-items-center py-8 text-sm text-muted-foreground">
            No assessment results yet
          </div>
        )}
      </CardContent>
    </Card>
  )
}
