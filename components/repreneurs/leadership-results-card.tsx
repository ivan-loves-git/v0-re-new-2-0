"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Brain, Copy, Check, Send, ExternalLink, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createAssessment } from "@/lib/actions/leadership-assessment"
import { getDecisionDisplay } from "@/lib/utils/leadership-scoring"
import type { LeadershipAssessment } from "@/lib/types/leadership-assessment"
import { LeadershipAnswersDialog } from "./leadership-answers-dialog"
import { WaveRadarChart } from "@/components/wave/charts"
import { formatDisplayDate } from "@/lib/utils/display-date-time"

interface LeadershipResultsCardProps {
  repreneurId: string
  assessment: LeadershipAssessment | null
  pendingToken: string | null
}

const RADAR_LABELS: Record<string, string> = {
  drive: "Drive",
  prudence: "Prudence",
  autorite: "Authority",
  collectif: "Collective",
  controle: "Control",
  delegation: "Delegation",
  court_terme: "Short-term",
  long_terme: "Long-term",
}

const TAG_COLORS: Record<string, string> = {
  Leadership_mature: "border-success/20 bg-success/5 text-success",
  Leadership_equilibre: "border-success/20 bg-success/5 text-success",
  Leadership_durable: "border-success/20 bg-success/5 text-success",
  Finance_mature: "border-info/20 bg-info/5 text-info",
  Humain_mature: "border-primary/20 bg-primary/5 text-primary",
  Responsabilite_mature: "border-success/20 bg-success/5 text-success",
  Self_awareness: "border-primary/20 bg-primary/5 text-primary",
  Ethique: "border-success/20 bg-success/5 text-success",
  Leadership_risk: "border-destructive/20 bg-destructive/5 text-destructive",
  Finance_risk: "border-destructive/20 bg-destructive/5 text-destructive",
  Humain_risk: "border-destructive/20 bg-destructive/5 text-destructive",
  Burnout_risk: "border-destructive/20 bg-destructive/5 text-destructive",
  Ethique_risk: "border-destructive/20 bg-destructive/5 text-destructive",
  Responsabilite_risk: "border-destructive/20 bg-destructive/5 text-destructive",
}

const DECISION_COLORS = {
  engagement: "border-success/20 bg-success/5 text-success",
  engagement_sous_conditions: "border-warning/25 bg-warning/5 text-warning",
  non_engagement: "border-destructive/20 bg-destructive/5 text-destructive",
} as const

export function LeadershipResultsCard({
  repreneurId,
  assessment,
  pendingToken,
}: LeadershipResultsCardProps) {
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [generatedToken, setGeneratedToken] = useState<string | null>(pendingToken)

  const handleSendAssessment = () => {
    startTransition(async () => {
      const result = await createAssessment(repreneurId)
      if (result.success && result.token) {
        setGeneratedToken(result.token)
        toast.success("Assessment link created")
      } else {
        toast.error(result.error || "Failed to create assessment")
      }
    })
  }

  const handleCopyLink = () => {
    const token = generatedToken || pendingToken
    if (!token) return
    const url = `${window.location.origin}/assessment/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Link copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  // No assessment and no pending — show send button
  if (!assessment && !generatedToken) {
    return (
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            Leadership assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            No assessment yet. Send the assessment link to the repreneur.
          </p>
          <Button onClick={handleSendAssessment} disabled={isPending} size="sm">
            <Send className="size-4" data-icon="inline-start" />
            {isPending ? "Creating..." : "Create Assessment Link"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Pending assessment — show link to copy
  if (!assessment && generatedToken) {
    return (
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            Leadership assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" />
              Pending
            </Badge>
            <span className="text-sm text-muted-foreground">Waiting for repreneur to complete</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="size-4" data-icon="inline-start" /> : <Copy className="size-4" data-icon="inline-start" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/assessment/${generatedToken}`, "_blank")}
            >
              <ExternalLink className="size-4" data-icon="inline-start" />
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Completed assessment — show results
  if (!assessment) return null

  const decision = assessment.decision
  const decisionDisplay = decision ? getDecisionDisplay(decision) : null
  const radar = assessment.bloc_a_radar
  const tags = assessment.bloc_b_tags || []

  // Prepare radar chart data
  const radarData = radar
    ? Object.entries(radar).map(([key, value]) => ({
        axis: RADAR_LABELS[key] || key,
        value: value as number,
      }))
    : []

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b py-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-muted-foreground" />
            Leadership assessment
          </CardTitle>
          <LeadershipAnswersDialog assessment={assessment} />
        </div>
        {decisionDisplay && decision && (
          <Badge variant="outline" className={cn("shrink-0", DECISION_COLORS[decision])}>
            {decisionDisplay.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5 py-4">
        {/* Bloc A Radar */}
        {radarData.length > 0 && (
          <div>
            <p className="wave-eyebrow mb-2">
              Leadership Profile
            </p>
            <WaveRadarChart
              data={radarData}
              label="Leadership profile"
              categoryKey="axis"
              series={[{ key: "value", label: "Leadership", color: "var(--chart-1)" }]}
              className="h-48"
            />
          </div>
        )}

        {/* Bloc B Score + Tags */}
        <div>
          <p className="wave-eyebrow mb-2">
            Situational Maturity
          </p>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {assessment.bloc_b_total ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">/16 points</span>
            {assessment.bloc_b_minus2_count !== null && assessment.bloc_b_minus2_count > 0 && (
              <Badge variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive">
                {assessment.bloc_b_minus2_count} red flag{assessment.bloc_b_minus2_count > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <Badge
                  key={`${tag}-${i}`}
                  variant="outline"
                  className={cn("text-xs", TAG_COLORS[tag] || "border-border bg-muted/50 text-muted-foreground")}
                >
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Bloc C Risk Index */}
        <div>
          <p className="wave-eyebrow mb-2">
            Personal Risk Index
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {assessment.bloc_c_risk_index ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">/5</span>
            <Badge
              variant="outline"
              className={cn(
                (assessment.bloc_c_risk_index ?? 0) < 3
                  ? "border-success/20 bg-success/5 text-success"
                  : "border-destructive/20 bg-destructive/5 text-destructive"
              )}
            >
              {(assessment.bloc_c_risk_index ?? 0) < 3 ? "Low risk" : "Elevated risk"}
            </Badge>
          </div>
        </div>

        {/* Completed date */}
        {assessment.completed_at && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Completed {formatDisplayDate(assessment.completed_at, "en-GB")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
