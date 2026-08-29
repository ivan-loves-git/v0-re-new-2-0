import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ListChecks,
  MapPin,
  Pencil,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MaSourcePanel } from "@/components/opportunities/ma-source-panel"
import { OpportunityDetailTabs } from "@/components/opportunities/opportunity-detail-tabs"
import { OpportunityClosureControls } from "@/components/opportunities/opportunity-closure-controls"
import { OpportunityMaWorkflowPanel } from "@/components/opportunities/opportunity-ma-workflow-panel"
import { OpportunityDocumentsPanel } from "@/components/opportunities/opportunity-documents-panel"
import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import { OpportunityMatchesPanel } from "@/components/opportunities/opportunity-matches-panel"
import { OpportunityPursuitPanel } from "@/components/opportunities/opportunity-pursuit-panel"
import { OpportunitySourceReviewPanel } from "@/components/opportunities/opportunity-source-review-panel"
import { OpportunityAiNextActions } from "@/components/opportunities/opportunity-ai-next-actions"
import {
  OpportunityDemoBadge,
  OpportunityDemoControl,
} from "@/components/opportunities/opportunity-demo-control"
import { OpportunityBroadDiscoveryControl } from "@/components/opportunities/opportunity-broad-discovery-control"
import {
  OpportunityStatusBadge,
  OpportunityVisibilityBadge,
} from "@/components/opportunities/opportunity-status-badge"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"
import type { PendingUnusedRetainedDocumentCleanup } from "@/lib/actions/opportunity-documents"
import type { StaffCurrentPursuit } from "@/lib/data/current-pursuit"
import type {
  OpportunityActionResult,
  OpportunityClosureHistoryEntry,
  OpportunityClosureReason,
  OpportunityDocument,
  MaOfficeIntakeOffice,
  OpportunityGeographyOption,
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityNdaArtifact,
  OpportunityPauseHistoryEntry,
  OpportunityPauseReason,
  OpportunityPursuitEvent,
  OpportunityWithSource,
} from "@/lib/types/opportunity"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  getOpportunityPursuitStageLabel,
} from "@/lib/types/opportunity"
import {
  formatOpportunitySourceDate,
  formatOpportunitySourceMonth,
} from "@/lib/utils/opportunity-source-date"

const OPPORTUNITY_DETAIL_TAB_VALUES = [
  "overview",
  "recommendations",
  "pursuit",
  "ma",
  "edit",
  "documents",
]
const OPPORTUNITY_DETAIL_TABS = new Set(OPPORTUNITY_DETAIL_TAB_VALUES)

interface OpportunityDetailProps {
  opportunity: OpportunityWithSource
  documents: OpportunityDocument[]
  pendingCleanups: PendingUnusedRetainedDocumentCleanup[]
  ndaArtifacts: OpportunityNdaArtifact[]
  matches: OpportunityMatch[]
  matchCandidates: OpportunityMatchCandidate[]
  pursuitEvents: OpportunityPursuitEvent[]
  pursuitProjection: StaffCurrentPursuit | null
  maWorkflow: MaOpportunityWorkflow
  updateAction: (formData: FormData) => Promise<OpportunityActionResult | void>
  resolveSourceAction: (formData: FormData) => Promise<OpportunityActionResult>
  closureHistory: OpportunityClosureHistoryEntry[]
  pauseHistory: OpportunityPauseHistoryEntry[]
  closeAction: (
    reason: OpportunityClosureReason,
  ) => Promise<OpportunityActionResult>
  pauseAction: (
    reason: OpportunityPauseReason,
  ) => Promise<OpportunityActionResult>
  demoClassificationAction: (
    isDemo: boolean,
  ) => Promise<OpportunityActionResult>
  officeOptions: MaOfficeIntakeOffice[]
  geographyOptions: OpportunityGeographyOption[]
  geographyMandatesEnabled: boolean
  defaultTab?: string
}

function formatNumber(value: number | null | undefined, suffix: string) {
  if (value === null || value === undefined) return "-"
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${suffix}`
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
  return (
    [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ") ||
    repreneur.email
  )
}

function candidateDisplayName(candidate: OpportunityMatchCandidate) {
  return (
    [candidate.first_name, candidate.last_name].filter(Boolean).join(" ") ||
    candidate.email
  )
}

function recommendationVariant(
  recommendation: OpportunityMatchCandidate["platform_recommendation"],
): "default" | "destructive" | "secondary" | "outline" {
  if (recommendation === "strong_fit") return "default"
  if (recommendation === "not_fit") return "destructive"
  if (recommendation === "possible_fit") return "secondary"
  return "outline"
}

export function OpportunityDetail({
  opportunity,
  documents,
  pendingCleanups,
  ndaArtifacts,
  matches,
  matchCandidates,
  pursuitEvents,
  pursuitProjection,
  maWorkflow,
  updateAction,
  resolveSourceAction,
  closureHistory,
  pauseHistory,
  closeAction,
  pauseAction,
  demoClassificationAction,
  officeOptions,
  geographyOptions,
  geographyMandatesEnabled,
  defaultTab,
}: OpportunityDetailProps) {
  const initialTab =
    defaultTab && OPPORTUNITY_DETAIL_TABS.has(defaultTab)
      ? defaultTab
      : "overview"
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
    .sort(
      (left, right) =>
        (right.platform_score ?? -1) - (left.platform_score ?? -1),
    )
    .slice(0, 4)
  const activePursuit = matches.find(
    (match) => match.status === "active_pursuit",
  )
  const nextAction = activePursuit
    ? {
        title: `Continue the active pursuit with ${repreneurDisplayName(activePursuit)}`,
        reason:
          "Review the pursuit stage, NDA position, documents, and the next deal milestone.",
        href: `/opportunities/${opportunity.id}?tab=pursuit`,
        label: "Open pursuit",
      }
    : topMatches.length > 0 || topCandidates.length > 0
      ? {
          title: "Review repreneur recommendations",
          reason: `${topMatches.length + topCandidates.length} prioritised profiles are ready for a staff decision.`,
          href: `/opportunities/${opportunity.id}?tab=recommendations`,
          label: "Review matches",
        }
      : {
          title: "Complete the opportunity profile",
          reason:
            "Add enough internal and repreneur-visible context to support confident matching.",
          href: `/opportunities/${opportunity.id}?tab=edit`,
          label: "Open edit",
        }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <OpportunityStatusBadge status={opportunity.status} />
            <OpportunityVisibilityBadge
              visibility={opportunity.repreneur_exposure}
            />
            {opportunity.is_demo ? <OpportunityDemoBadge /> : null}
          </div>
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {opportunity.reference}
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-8 tracking-[-0.025em] text-foreground sm:text-[28px] sm:leading-9">
              {opportunity.public_title || opportunity.sector || "Opportunity"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {opportunity.location ?? "No location"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" />
              Added {formatOpportunitySourceDate(opportunity.date_added, opportunity.date_added_precision)}
              {opportunity.date_added_precision === "month"
                ? " (month-only source date)"
                : ` / Month: ${formatOpportunitySourceMonth(opportunity.date_added)}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" />
              {opportunity.headcount_range ?? opportunity.headcount ?? "-"}{" "}
              people
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <OpportunityBroadDiscoveryControl
            opportunity={opportunity}
          />
          <OpportunityDemoControl
            isDemo={opportunity.is_demo}
            action={demoClassificationAction}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/opportunities/${opportunity.id}?tab=edit`}>
              <Pencil data-icon="inline-start" />
              Edit opportunity
            </Link>
          </Button>
        </div>
      </header>

      {opportunity.source_review_required ? (
        <OpportunitySourceReviewPanel
          opportunity={opportunity}
          officeOptions={officeOptions}
          action={resolveSourceAction}
        />
      ) : null}

      <OpportunityDetailTabs
        defaultValue={initialTab}
        validTabs={OPPORTUNITY_DETAIL_TAB_VALUES}
      >
        <div className="overflow-x-auto border-b border-border/80">
          <TabsList className="w-max border-b-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="pursuit">Pursuit</TabsTrigger>
            <TabsTrigger value="ma">M&A</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-5">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2">
                <ListChecks />
                Next Best Action
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium text-foreground">
                  {nextAction.title}
                </p>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {nextAction.reason}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={nextAction.href}>
                    {nextAction.label}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/opportunities/${opportunity.id}?tab=documents`}>
                    Open documents
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <OpportunityAiNextActions opportunityId={opportunity.id} />

          <OpportunityClosureControls
            opportunityStatus={opportunity.status}
            sourceReviewRequired={opportunity.source_review_required === true}
            closureHistory={closureHistory}
            pauseHistory={pauseHistory}
            closeAction={closeAction}
            pauseAction={pauseAction}
          />

          <dl className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-3 sm:divide-x">
            <div className="flex flex-col gap-1 p-4">
              <dt className="text-xs font-medium text-muted-foreground">
                Revenue
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">
                {formatNumber(opportunity.revenue_meur, "M EUR")}
              </dd>
            </div>
            <div className="flex flex-col gap-1 border-t p-4 sm:border-t-0">
              <dt className="text-xs font-medium text-muted-foreground">
                EBITDA
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">
                {formatNumber(opportunity.ebitda_keur, "K EUR")}
              </dd>
            </div>
            <div className="flex flex-col gap-1 border-t p-4 sm:border-t-0">
              <dt className="text-xs font-medium text-muted-foreground">
                Headcount
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">
                {opportunity.headcount_range ?? opportunity.headcount ?? "-"}
              </dd>
            </div>
          </dl>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Opportunity Information</CardTitle>
                  <CardDescription>
                    Internal operating context and the controlled
                    repreneur-facing version.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 lg:grid-cols-2 lg:gap-0">
                  <section
                    className="flex min-w-0 flex-col gap-4 lg:pr-5"
                    aria-labelledby="staff-view-title"
                  >
                    <div className="flex flex-col gap-1">
                      <h3
                        id="staff-view-title"
                        className="text-sm font-semibold text-foreground"
                      >
                        Staff View
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Internal opportunity context.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Sector / activity
                      </p>
                      <p className="font-medium">
                        {[opportunity.sector, opportunity.activity]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Description
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {opportunity.description || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Internal notes
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {opportunity.internal_notes || "-"}
                      </p>
                    </div>
                  </section>

                  <section
                    className="flex min-w-0 flex-col gap-4 border-t pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
                    aria-labelledby="public-view-title"
                  >
                    <div className="flex flex-col gap-1">
                      <h3
                        id="public-view-title"
                        className="text-sm font-semibold text-foreground"
                      >
                        Repreneur-visible Version
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Content eligible for matching or later disclosure.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <OpportunityVisibilityBadge
                        visibility={opportunity.repreneur_exposure}
                      />
                      <Badge variant="outline">
                        Source hidden unless approved
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Public title
                      </p>
                      <p className="font-medium">
                        {opportunity.public_title || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Teaser summary
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {opportunity.teaser_summary || "-"}
                      </p>
                    </div>
                  </section>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Recommended Repreneurs</CardTitle>
                    <CardDescription>
                      Top match context for this opportunity.
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/opportunities/${opportunity.id}?tab=recommendations`}
                    >
                      Open recommendations
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {topMatches.length > 0 ? (
                    <div className="divide-y rounded-md border">
                      {topMatches.map((match) => (
                        <div
                          key={match.id}
                          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-1">
                            <Link
                              href={`/repreneurs/${match.repreneur_id}`}
                              className="font-medium hover:underline"
                            >
                              {repreneurDisplayName(match)}
                            </Link>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>
                                {getOpportunityMatchRecommendationLabel(
                                  match.human_recommendation,
                                )}
                              </span>
                              <span>
                                Platform {formatScore(match.platform_score)}
                              </span>
                              {match.pursuit_stage ? (
                                <span>
                                  {getOpportunityPursuitStageLabel(
                                    match.pursuit_stage,
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {getOpportunityMatchStatusLabel(match.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {topCandidates.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="wave-micro-label">
                        Platform suggestions not saved yet
                      </p>
                      <div className="divide-y rounded-md border border-dashed">
                        {topCandidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <Link
                                href={`/repreneurs/${candidate.id}`}
                                className="font-medium hover:underline"
                              >
                                {candidateDisplayName(candidate)}
                              </Link>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>
                                  Platform{" "}
                                  {formatScore(candidate.platform_score)}
                                </span>
                                {(candidate.platform_reasons ?? [])
                                  .slice(0, 1)
                                  .map((reason) => (
                                    <span key={reason}>{reason}</span>
                                  ))}
                              </div>
                            </div>
                            <Badge
                              variant={recommendationVariant(
                                candidate.platform_recommendation,
                              )}
                            >
                              {candidate.platform_recommendation
                                ? getOpportunityMatchRecommendationLabel(
                                    candidate.platform_recommendation,
                                  )
                                : "Not evaluated"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {topMatches.length === 0 && topCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No repreneur recommendations or platform suggestions are
                      available yet.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <MaSourcePanel
              source={opportunity.source}
              sourceLabel={opportunity.source_label}
              sourceContacts={opportunity.source_contacts}
              sourceOffice={opportunity.source_office}
              officeContacts={opportunity.office_contacts}
            />
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <OpportunityMatchesPanel
            opportunityId={opportunity.id}
            matches={matches}
            candidates={matchCandidates}
          />
        </TabsContent>

        <TabsContent value="pursuit">
          <OpportunityPursuitPanel
            opportunityId={opportunity.id}
            matches={matches}
            documents={documents}
            ndaArtifacts={ndaArtifacts}
            projection={pursuitProjection}
            legacyEventCount={pursuitEvents.length}
          />
        </TabsContent>

        <TabsContent value="ma">
          <OpportunityMaWorkflowPanel
            opportunityId={opportunity.id}
            workflow={maWorkflow}
          />
        </TabsContent>

        <TabsContent value="edit">
          <OpportunityForm
            opportunity={opportunity}
            action={updateAction}
            submitLabel="Save changes"
            officeOptions={officeOptions}
            geographyOptions={geographyOptions}
            geographyMandatesEnabled={geographyMandatesEnabled}
          />
        </TabsContent>

        <TabsContent value="documents">
          <OpportunityDocumentsPanel
            opportunityId={opportunity.id}
            documents={documents}
            pendingCleanups={pendingCleanups}
            canonicalNdaDocumentIds={ndaArtifacts.map(
              (artifact) => artifact.document_id,
            )}
          />
        </TabsContent>
      </OpportunityDetailTabs>
    </div>
  )
}
