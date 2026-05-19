import Link from "next/link"
import { ArrowRight, CheckCircle2, Circle, Mail, Sparkles, Target, TrendingUp } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { RecommendationBadge } from "@/components/scoring-v2/recommendation-badge"
import { RepreneurRadarChart } from "@/components/repreneurs/repreneur-radar-chart"
import { getStageConfig, MILESTONES } from "@/lib/constants/tier-config"
import { extractMilestones, getStageProgress } from "@/lib/utils/journey-derivation"
import type { LeadershipAssessment } from "@/lib/types/leadership-assessment"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurProfileSummaryProps {
  repreneur: Repreneur | null
  leadershipAssessment: LeadershipAssessment | null
  dealsHref?: string
  showContactAction?: boolean
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return `${Math.round(Number(value))}`
}

function scoreTone(value: number | null | undefined) {
  if (value === null || value === undefined) return "To complete"
  if (value >= 80) return "Strong"
  if (value >= 60) return "Promising"
  if (value >= 40) return "In progress"
  return "To strengthen"
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function buildStrengths(repreneur: Repreneur, leadershipAssessment: LeadershipAssessment | null) {
  const strengths: string[] = []

  if ((repreneur.who_score ?? 0) >= 80) {
    strengths.push("Your operator profile is strong and credible for seller conversations.")
  } else if ((repreneur.who_score ?? 0) >= 60) {
    strengths.push("Your professional background already gives Re-New material to position you seriously.")
  }

  if ((repreneur.when_score ?? 0) >= 70) {
    strengths.push("Your acquisition project is framed enough to support real opportunity discussions.")
  }

  if ((repreneur.tier2_overall ?? 0) >= 4) {
    strengths.push("Your interview-based competency profile is above the readiness threshold.")
  }

  if (repreneur.ms_leadership_assessment_passed || leadershipAssessment?.decision === "engagement") {
    strengths.push("Your leadership assessment supports your ability to lead through an acquisition.")
  }

  if (arrayValue(repreneur.q13_target_sectors_v2).length > 0 || arrayValue(repreneur.sector_preferences).length > 0) {
    strengths.push("Your sector preferences are visible enough to help Re-New filter relevant opportunities.")
  }

  return strengths.slice(0, 4)
}

function buildImprovements(repreneur: Repreneur, leadershipAssessment: LeadershipAssessment | null) {
  const improvements: string[] = []

  if ((repreneur.when_score ?? 0) < 60) {
    improvements.push("Clarify the acquisition thesis: target size, geography, role, and structure.")
  }

  if (!repreneur.q16_equity && !repreneur.investment_capacity) {
    improvements.push("Confirm your available equity range so opportunity sizing is more precise.")
  }

  if (!repreneur.ms_advisory_team_identified) {
    improvements.push("Identify the first legal/accounting advisors you would use during a process.")
  }

  if (!leadershipAssessment) {
    improvements.push("Complete the leadership assessment when Re-New sends it to unlock a richer profile.")
  }

  if ((repreneur.who_score ?? 0) < 60) {
    improvements.push("Add more evidence of leadership, crisis management, and decision ownership.")
  }

  return improvements.slice(0, 4)
}

function completedMilestones(repreneur: Repreneur) {
  const milestones = extractMilestones(repreneur)
  return MILESTONES.filter((milestone) => milestones[milestone.key])
}

function targetDescription(repreneur: Repreneur) {
  const sectors = arrayValue(repreneur.q13_target_sectors_v2).concat(arrayValue(repreneur.sector_preferences))
  const locations = arrayValue(repreneur.q12_geo_zones).concat(arrayValue(repreneur.target_location))
  const dealSizes = arrayValue(repreneur.q14_deal_size)

  return {
    sectors: sectors.length > 0 ? sectors.slice(0, 4).join(", ") : "To refine",
    locations: locations.length > 0 ? locations.slice(0, 4).join(", ") : "To refine",
    dealSize: dealSizes.length > 0 ? dealSizes.join(", ") : repreneur.target_acquisition_size || "To refine",
  }
}

export function RepreneurProfileSummary({
  repreneur,
  leadershipAssessment,
  dealsHref = "/portal/deals",
  showContactAction = true,
}: RepreneurProfileSummaryProps) {
  if (!repreneur) {
    return (
      <Alert>
        <Mail />
        <AlertTitle>No linked repreneur profile</AlertTitle>
        <AlertDescription>
          This login is not connected to a repreneur profile yet. Ask the Re-New team to link your email before using the portal.
        </AlertDescription>
      </Alert>
    )
  }

  const milestones = extractMilestones(repreneur)
  const stage = getStageProgress(milestones)
  const stageConfig = getStageConfig(stage.currentStage)
  const strengths = buildStrengths(repreneur, leadershipAssessment)
  const improvements = buildImprovements(repreneur, leadershipAssessment)
  const completed = completedMilestones(repreneur)
  const target = targetDescription(repreneur)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <RepreneurAvatar
            repreneurId={repreneur.id}
            avatarUrl={repreneur.avatar_url}
            firstName={repreneur.first_name}
            lastName={repreneur.last_name}
            size="xl"
          />
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Your Re-New profile</p>
              <h1 className="text-2xl font-semibold tracking-normal">
                {repreneur.first_name} {repreneur.last_name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{stageConfig.label}</Badge>
              <RecommendationBadge recommendation={repreneur.recommendation ?? null} showTooltip={false} size="sm" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={dealsHref}>
              View proposed deals
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          {showContactAction && (
            <Button asChild variant="outline">
              <a href="mailto:contact@re-new.team?subject=Profile refinement call">
                <Mail data-icon="inline-start" />
                Ask for a profile call
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>WHO score</CardDescription>
            <CardTitle className="text-3xl">{formatScore(repreneur.who_score)}</CardTitle>
            <CardAction>
              <Badge variant="outline">{scoreTone(repreneur.who_score)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Profile quality and execution capacity.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>WHEN score</CardDescription>
            <CardTitle className="text-3xl">{formatScore(repreneur.when_score)}</CardTitle>
            <CardAction>
              <Badge variant="outline">{scoreTone(repreneur.when_score)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Project maturity and financing coherence.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Next stage</CardDescription>
            <CardTitle>{stage.nextStage ? getStageConfig(stage.nextStage).label : "Complete"}</CardTitle>
            <CardAction>
              <Badge variant="outline">{Math.round(stage.progress)}%</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={stage.progress} />
            <p className="text-sm text-muted-foreground">
              {stage.nextStage ? `${stage.milestonesForNext} milestone(s) to unlock the next stage.` : "All milestone groups complete."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RepreneurRadarChart repreneur={repreneur} />

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Sparkles data-icon="inline-start" />
              Strengths
            </CardTitle>
            <CardDescription>Signals Re-New can use to position you with confidence.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(strengths.length > 0 ? strengths : ["Your profile is ready to be enriched as Re-New validates your next steps."]).map((item) => (
              <div key={item} className="flex gap-3 rounded-md border p-3 text-sm">
                <CheckCircle2 className="mt-0.5 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Target data-icon="inline-start" />
              Target thesis
            </CardTitle>
            <CardDescription>What your current profile says you are looking for.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Sectors</span>
              <span className="text-sm font-medium">{target.sectors}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Geography</span>
              <span className="text-sm font-medium">{target.locations}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Deal size</span>
              <span className="text-sm font-medium">{target.dealSize}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <TrendingUp data-icon="inline-start" />
              Improve next
            </CardTitle>
            <CardDescription>Focus areas that can make your profile stronger.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(improvements.length > 0 ? improvements : ["Keep your profile current as new opportunities and milestones appear."]).map((item) => (
              <div key={item} className="flex gap-3 rounded-md border p-3 text-sm">
                <Circle className="mt-0.5 text-muted-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visible progress</CardTitle>
          <CardDescription>Completed readiness milestones currently recorded by Re-New.</CardDescription>
        </CardHeader>
        <CardContent>
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No readiness milestones have been marked complete yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {completed.map((milestone) => (
                <div key={milestone.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <CheckCircle2 className="text-primary" />
                  <span>{milestone.label}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
