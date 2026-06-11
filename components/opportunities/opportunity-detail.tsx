import Link from "next/link"
import { CalendarDays, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MaSourcePanel } from "@/components/opportunities/ma-source-panel"
import { OpportunityDetailTabs } from "@/components/opportunities/opportunity-detail-tabs"
import { OpportunityMaWorkflowPanel } from "@/components/opportunities/opportunity-ma-workflow-panel"
import { OpportunityDocumentsPanel } from "@/components/opportunities/opportunity-documents-panel"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import { OpportunityMatchesPanel } from "@/components/opportunities/opportunity-matches-panel"
import { OpportunityPursuitPanel } from "@/components/opportunities/opportunity-pursuit-panel"
import { OpportunityStatusBadge, OpportunityVisibilityBadge } from "@/components/opportunities/opportunity-status-badge"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import type {
  OpportunityActionResult,
  OpportunityDocument,
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityPursuitEvent,
  OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
} from "@/lib/types/opportunity"

const OPPORTUNITY_DETAIL_TAB_VALUES = ["overview", "recommendations", "pursuit", "ma", "edit", "documents"]
const OPPORTUNITY_DETAIL_TABS = new Set(OPPORTUNITY_DETAIL_TAB_VALUES)

interface OpportunityDetailProps {
  opportunity: OpportunityWithSource
  documents: OpportunityDocument[]
  matches: OpportunityMatch[]
  matchCandidates: OpportunityMatchCandidate[]
  pursuitEvents: OpportunityPursuitEvent[]
  maWorkflow: MaOpportunityWorkflow
  updateAction: (formData: FormData) => Promise<OpportunityActionResult | void>
  defaultTab?: string
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

function formatMonth(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date)
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return `${Math.round(value)}%`
}

function matchPriority(match: OpportunityMatch) {
  if (match.status === "active_pursuit") return 0
  if (match.status === "interested") return 1
  if (match.status === "proposed") return 2
  if (match.status === "shortlisted") return 3
  return 4
}

function repreneurDisplayName(match: OpportunityMatch) {
  const repreneur = match.repreneur
  if (!repreneur) return "Unknown repreneur"
  return [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") || repreneur.email
}

function candidateDisplayName(candidate: OpportunityMatchCandidate) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(" ") || candidate.email
}

function recommendationVariant(recommendation: OpportunityMatchCandidate["platform_recommendation"]): "default" | "destructive" | "secondary" | "outline" {
  if (recommendation === "strong_fit") return "default"
  if (recommendation === "not_fit") return "destructive"
  if (recommendation === "possible_fit") return "secondary"
  return "outline"
}

export function OpportunityDetail({
  opportunity,
  documents,
  matches,
  matchCandidates,
  pursuitEvents,
  maWorkflow,
  updateAction,
  defaultTab,
}: OpportunityDetailProps) {
  const initialTab = defaultTab && OPPORTUNITY_DETAIL_TABS.has(defaultTab) ? defaultTab : "overview"
  const topMatches = [...matches]
    .sort((left, right) => {
      const priorityDelta = matchPriority(left) - matchPriority(right)
      if (priorityDelta !== 0) return priorityDelta
      return (right.platform_score ?? -1) - (left.platform_score ?? -1)
    })
    .slice(0, 4)
  const savedRepreneurIds = new Set(matches.map((match) => match.repreneur_id))
  const topCandidates = [...matchCandidates]
    .filter((candidate) => !savedRepreneurIds.has(candidate.id))
    .sort((left, right) => (right.platform_score ?? -1) - (left.platform_score ?? -1))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <OpportunityStatusBadge status={opportunity.status} />
            <OpportunityVisibilityBadge visibility={opportunity.repreneur_exposure} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{opportunity.reference}</p>
            <h1 className="text-2xl font-semibold tracking-normal">{opportunity.public_title || opportunity.sector || "Opportunity"}</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {opportunity.location ?? "No location"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Added {formatDate(opportunity.date_added)} / Month: {formatMonth(opportunity.date_added)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount_range ?? opportunity.headcount ?? "-"} people
            </span>
          </div>
        </div>
      </div>

      <OpportunityDetailTabs defaultValue={initialTab} validTabs={OPPORTUNITY_DETAIL_TAB_VALUES}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="pursuit">Pursuit</TabsTrigger>
          <TabsTrigger value="ma">M&A</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Revenue</CardDescription>
                <CardTitle>{formatNumber(opportunity.revenue_meur, "M EUR")}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>EBITDA</CardDescription>
                <CardTitle>{formatNumber(opportunity.ebitda_keur, "K EUR")}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Headcount</CardDescription>
                <CardTitle>{opportunity.headcount_range ?? opportunity.headcount ?? "-"}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Staff View</CardTitle>
                  <CardDescription>Internal opportunity context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Sector / activity</p>
                    <p className="font-medium">{[opportunity.sector, opportunity.activity].filter(Boolean).join(" / ") || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.description || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Internal notes</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.internal_notes || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Repreneur-visible Version</CardTitle>
                  <CardDescription>Content eligible for matching or later disclosure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <OpportunityVisibilityBadge visibility={opportunity.repreneur_exposure} />
                    <Badge variant="outline">Source hidden unless approved</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Public title</p>
                    <p className="font-medium">{opportunity.public_title || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teaser summary</p>
                    <p className="whitespace-pre-wrap text-sm">{opportunity.teaser_summary || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Recommended Repreneurs</CardTitle>
                    <CardDescription>Top match context for this opportunity.</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/opportunities/${opportunity.id}?tab=recommendations`}>
                      Open recommendations
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topMatches.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {topMatches.map((match) => (
                        <div key={match.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <Link href={`/repreneurs/${match.repreneur_id}`} className="font-medium hover:underline">
                              {repreneurDisplayName(match)}
                            </Link>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{getOpportunityMatchRecommendationLabel(match.human_recommendation)}</span>
                              <span>Platform {formatScore(match.platform_score)}</span>
                              {match.pursuit_stage ? (
                                <span>{getOpportunityPursuitStageLabel(match.pursuit_stage)}</span>
                              ) : null}
                            </div>
                          </div>
                          <Badge variant="outline">{getOpportunityMatchStatusLabel(match.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {topCandidates.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                        Platform suggestions not saved yet
                      </p>
                      <div className="divide-y rounded-md border border-dashed">
                        {topCandidates.map((candidate) => (
                          <div key={candidate.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <Link href={`/repreneurs/${candidate.id}`} className="font-medium hover:underline">
                                {candidateDisplayName(candidate)}
                              </Link>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>Platform {formatScore(candidate.platform_score)}</span>
                                {(candidate.platform_reasons ?? []).slice(0, 1).map((reason) => (
                                  <span key={reason}>{reason}</span>
                                ))}
                              </div>
                            </div>
                            <Badge variant={recommendationVariant(candidate.platform_recommendation)}>
                              {candidate.platform_recommendation
                                ? getOpportunityMatchRecommendationLabel(candidate.platform_recommendation)
                                : "Not evaluated"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {topMatches.length === 0 && topCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No repreneur recommendations or platform suggestions are available yet.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <MaSourcePanel
              source={opportunity.source}
              sourceLabel={opportunity.source_label}
            />
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <OpportunityMatchesPanel opportunityId={opportunity.id} matches={matches} candidates={matchCandidates} />
        </TabsContent>

        <TabsContent value="pursuit">
          <OpportunityPursuitPanel opportunityId={opportunity.id} matches={matches} events={pursuitEvents} documents={documents} />
        </TabsContent>

        <TabsContent value="ma">
          <OpportunityMaWorkflowPanel opportunityId={opportunity.id} workflow={maWorkflow} />
        </TabsContent>

        <TabsContent value="edit">
          <OpportunityForm opportunity={opportunity} action={updateAction} submitLabel="Save changes" />
        </TabsContent>

        <TabsContent value="documents">
          <OpportunityDocumentsPanel opportunityId={opportunity.id} documents={documents} />
        </TabsContent>
      </OpportunityDetailTabs>
    </div>
  )
}
