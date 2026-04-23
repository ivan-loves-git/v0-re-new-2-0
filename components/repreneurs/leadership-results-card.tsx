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
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts"

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
  Leadership_mature: "bg-green-100 text-green-700",
  Leadership_equilibre: "bg-green-100 text-green-700",
  Leadership_durable: "bg-green-100 text-green-700",
  Finance_mature: "bg-blue-100 text-blue-700",
  Humain_mature: "bg-purple-100 text-purple-700",
  Responsabilite_mature: "bg-emerald-100 text-emerald-700",
  Self_awareness: "bg-indigo-100 text-indigo-700",
  Ethique: "bg-teal-100 text-teal-700",
  Leadership_risk: "bg-red-100 text-red-700",
  Finance_risk: "bg-red-100 text-red-700",
  Humain_risk: "bg-red-100 text-red-700",
  Burnout_risk: "bg-red-100 text-red-700",
  Ethique_risk: "bg-red-100 text-red-700",
  Responsabilite_risk: "bg-red-100 text-red-700",
}

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-5" />
            Leadership Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            No assessment yet. Send the assessment link to the repreneur.
          </p>
          <Button onClick={handleSendAssessment} disabled={isPending} size="sm">
            <Send className="size-4 mr-2" />
            {isPending ? "Creating..." : "Create Assessment Link"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Pending assessment — show link to copy
  if (!assessment && generatedToken) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-5" />
            Leadership Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" />
              Pending
            </Badge>
            <span className="text-sm text-muted-foreground">Waiting for repreneur to complete</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="size-4 mr-1" /> : <Copy className="size-4 mr-1" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/assessment/${generatedToken}`, "_blank")}
            >
              <ExternalLink className="size-4 mr-1" />
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Brain className="size-5" />
            Leadership Assessment
          </div>
          <div className="flex items-center gap-2">
            <LeadershipAnswersDialog assessment={assessment} />
            {decisionDisplay && (
              <Badge className={cn("gap-1 border-0", decisionDisplay.bgColor, decisionDisplay.color)}>
                {decisionDisplay.label}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bloc A Radar */}
        {radarData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Leadership Profile
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }} />
                  <Radar
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bloc B Score + Tags */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Situational Maturity
          </p>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold">
              {assessment.bloc_b_total ?? 0}
            </span>
            <span className="text-sm text-gray-500">/16 points</span>
            {assessment.bloc_b_minus2_count !== null && assessment.bloc_b_minus2_count > 0 && (
              <Badge variant="outline" className="text-red-600 border-red-200">
                {assessment.bloc_b_minus2_count} red flag{assessment.bloc_b_minus2_count > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <Badge
                  key={`${tag}-${i}`}
                  variant="secondary"
                  className={cn("text-xs", TAG_COLORS[tag] || "bg-gray-100 text-gray-600")}
                >
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Bloc C Risk Index */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Personal Risk Index
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">
              {assessment.bloc_c_risk_index ?? 0}
            </span>
            <span className="text-sm text-gray-500">/5</span>
            <Badge
              variant="outline"
              className={cn(
                (assessment.bloc_c_risk_index ?? 0) < 3
                  ? "text-green-600 border-green-200"
                  : "text-red-600 border-red-200"
              )}
            >
              {(assessment.bloc_c_risk_index ?? 0) < 3 ? "Low risk" : "Elevated risk"}
            </Badge>
          </div>
        </div>

        {/* Completed date */}
        {assessment.completed_at && (
          <p className="text-xs text-gray-400">
            Completed {new Date(assessment.completed_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
