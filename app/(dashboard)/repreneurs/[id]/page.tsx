import { notFound } from "next/navigation"
import { connection } from "next/server"
import Link from "next/link"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Clock3,
  Crown,
  FileText,
  Flag,
  History,
  Info,
  KeyRound,
  ListChecks,
  Mail,
  Map,
  Phone,
  Rocket,
  Star,
  Target,
  Compass,
} from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth-server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { MissingFieldsBadge } from "@/components/repreneurs/missing-fields-badge"
import { NeedsCompletionBadge } from "@/components/repreneurs/needs-completion-badge"
import { MILESTONES, STAGE_GROUPS, getStageConfig } from "@/lib/constants/tier-config"
import { deriveJourneyStage, countMilestones, extractMilestones } from "@/lib/utils/journey-derivation"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { EditableTextField } from "@/components/repreneurs/editable-text-field"
import { EditableRepreneurIdentity } from "@/components/repreneurs/editable-repreneur-identity"
import { EditableMultiSelect } from "@/components/repreneurs/editable-multi-select"
import { RepreneurNotes } from "@/components/repreneurs/repreneur-notes"
import { RepreneurOffersList } from "@/components/offers/repreneur-offers-list"
import { Tier3MilestonesCard } from "@/components/repreneurs/tier3-milestones-card"
import { RepreneurActionsMenu } from "@/components/repreneurs/repreneur-actions-menu"
import { ActivityHistory } from "@/components/repreneurs/activity-history"
import { DocumentsCard } from "@/components/repreneurs/documents-card"
import { LeadershipResultsCard } from "@/components/repreneurs/leadership-results-card"
import { PortalAccessCard } from "@/components/repreneurs/portal-access-card"
import { RepreneurOpportunityMatchesCard } from "@/components/repreneurs/repreneur-opportunity-matches-card"
import { RepreneurDetailTabs } from "@/components/repreneurs/repreneur-detail-tabs"
import { RepreneurRadarChart } from "@/components/repreneurs/repreneur-radar-chart"
import { getLatestAssessment, getPendingAssessment } from "@/lib/actions/leadership-assessment"
import { listOpportunityCandidatesForRepreneur, listOpportunityMatchesForRepreneur } from "@/lib/actions/opportunity-matches"
import { getRepreneurPortalAccessStatus } from "@/lib/actions/portal-access"
import { WhoScoreEditor } from "@/components/repreneurs/who-score-editor"
import { WhenScoreEditor } from "@/components/repreneurs/when-score-editor"
import { ScoringAccuracy } from "@/components/repreneurs/scoring-accuracy"
import { SECTORS } from "@/lib/constants/sectors"
import { WHO_QUESTIONS, WHEN_QUESTIONS, NEEDS_QUESTIONS } from "@/lib/config/questionnaire-v2"
import type { Note, Activity, Repreneur } from "@/lib/types/repreneur"
import type { RepreneurOffer, Offer, OfferMilestone } from "@/lib/types/offer"
import {
  getOpportunityMatchRecommendationLabel,
  getOpportunityMatchStatusLabel,
  type RepreneurOpportunityMatch,
} from "@/lib/types/opportunity"

// Cache for 30 seconds

// Source options for dropdown
const SOURCE_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Direct contact" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
]

type QuestionOptionMap = Record<string, { options?: ReadonlyArray<{ value: string; label: string }> }>

function humanizeIdentifier(value: string): string {
  const label = value.replaceAll("_", " ").trim()
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : value
}

// Helper functions for WHO/WHEN scoring display
function getWhoDescription(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Not calculated"
  if (score >= 80) return "Excellent profile"
  if (score >= 60) return "Strong candidate"
  if (score >= 40) return "Moderate profile"
  return "Early stage"
}

function getWhenDescription(score: number | null | undefined): string {
  if (score === null || score === undefined) return "Not calculated"
  if (score >= 80) return "Project framed"
  if (score >= 60) return "Good clarity"
  if (score >= 40) return "Needs refinement"
  return "Explorer"
}

function getRecommendationLabel(recommendation: string | null | undefined, whoScore?: number | null, whenScore?: number | null): string {
  // If explicit recommendation exists, use it
  if (recommendation) {
    switch (recommendation) {
      case "deal_flow": return "Deal Flow"
      case "interview_validate_thesis": return "Interview (Thesis)"
      case "interview_validate_execution": return "Interview (Execution)"
      case "starter_pack": return "Starter Pack"
      case "priority_interview": return "Priority Interview"
      default: return humanizeIdentifier(recommendation)
    }
  }
  // Fallback: derive from scores
  const total = (whoScore ?? 0) + (whenScore ?? 0)
  if (total >= 160) return "Deal Flow"
  if (total >= 120) return "Interview"
  if (total > 0) return "Starter Pack"
  return "Pending"
}

function getRecommendationColor(recommendation: string | null | undefined): string {
  switch (recommendation) {
    case "deal_flow":
    case "priority_interview":
      return "border-success/30 bg-success/10 text-success"
    case "interview_validate_thesis":
    case "interview_validate_execution":
      return "border-info/30 bg-info/10 text-info"
    default:
      return "border-warning/30 bg-warning/10 text-warning"
  }
}

// Helper functions to get V2 questionnaire labels
function getV2Label(
  questions: QuestionOptionMap,
  questionId: string,
  value: string | null | undefined
): string | null {
  if (!value) return null
  const options = questions[questionId]?.options
  if (!options) return null
  const option = options.find((o) => o.value === value)
  return option?.label || humanizeIdentifier(value)
}

function formatV2Array(
  questions: QuestionOptionMap,
  questionId: string,
  values: string[] | null | undefined
): string | null {
  if (!values || values.length === 0) return null
  const options = questions[questionId]?.options
  if (!options) return null
  return values
    .map((v) => options.find((o) => o.value === v)?.label || humanizeIdentifier(v))
    .join(", ")
}

const REPRENEUR_DETAIL_TAB_VALUES = ["overview", "qualification", "readiness", "opportunities", "engagement", "timeline"]

const MATCH_STATUS_PRIORITY: Record<string, number> = {
  active_pursuit: 0,
  interested: 1,
  proposed: 2,
  shortlisted: 3,
  draft: 4,
  declined: 5,
  dropped: 6,
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date)
}

function muted(value: string | null | undefined, fallback = "Not set") {
  return value && value.trim() ? value : fallback
}

function opportunityTitle(match: RepreneurOpportunityMatch) {
  return match.opportunity?.public_title || match.opportunity?.activity || match.opportunity?.sector || "Untitled opportunity"
}

function matchPriority(match: RepreneurOpportunityMatch) {
  return MATCH_STATUS_PRIORITY[match.status] ?? 9
}

function StageIconGlyph({ stage, className }: { stage: ReturnType<typeof deriveJourneyStage>; className?: string }) {
  if (stage === "explorer") return <Compass className={className} />
  if (stage === "learner") return <Map className={className} />
  if (stage === "ready") return <Flag className={className} />
  if (stage === "execution") return <Rocket className={className} />
  return <Crown className={className} />
}

function getStageTone(stage: ReturnType<typeof deriveJourneyStage>): string {
  if (stage === "explorer") return "border-border bg-muted text-muted-foreground"
  if (stage === "learner") return "border-primary/30 bg-primary/10 text-primary"
  if (stage === "ready") return "border-success/30 bg-success/10 text-success"
  if (stage === "execution") return "border-info/30 bg-info/10 text-info"
  return "border-warning/30 bg-warning/10 text-warning"
}

function getActivityLabel(activityType: Activity["activity_type"]) {
  switch (activityType) {
    case "welcome_email":
      return "Welcome email"
    case "interview":
      return "Interview"
    case "offer_submitted":
      return "Offer submitted"
    case "offer_rejected":
      return "Offer rejected"
    case "offer_approved":
      return "Offer approved"
    case "meeting":
      return "Meeting"
    case "no_show":
      return "No show"
    default:
      return activityType
  }
}

function FieldSummary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>
}

export default async function RepreneurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()

  const { id } = await params
  const supabase = await createServerClient()

  // First fetch repreneur (required to validate page exists)
  const { data: repreneur } = await supabase.from("repreneurs").select("*").eq("id", id).single()

  if (!repreneur) {
    notFound()
  }

  const profile = repreneur as Repreneur

  // Get current user from Better Auth
  const currentUser = await getCurrentUser()

  // Parallel fetch all related data - runs simultaneously instead of sequentially
  const [
    notesResult,
    repreneurOffersResult,
    allOffersResult,
    activitiesResult
  ] = await Promise.all([
    // Fetch notes
    supabase
      .from("notes")
      .select("*")
      .eq("repreneur_id", id)
      .order("created_at", { ascending: false }),
    // Fetch repreneur offers with offer details
    supabase
      .from("repreneur_offers")
      .select(`*, offer:offers(*)`)
      .eq("repreneur_id", id)
      .order("offered_at", { ascending: false }),
    // Fetch all active offers for assignment
    supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    // Fetch activities
    supabase
      .from("activities")
      .select("*")
      .eq("repreneur_id", id)
      .order("created_at", { ascending: false })
  ])

  const notes = notesResult.data || []
  const repreneurOffers = repreneurOffersResult.data || []
  const allOffers = allOffersResult.data || []
  const activities = activitiesResult.data || []

  // Try to fetch milestones separately (table may not exist yet)
  let milestonesMap: Record<string, OfferMilestone[]> = {}
  if (repreneurOffers.length > 0) {
    try {
      const { data: allMilestones } = await supabase
        .from("offer_milestones")
        .select("*")
        .in("repreneur_offer_id", repreneurOffers.map(ro => ro.id))

      if (allMilestones) {
        milestonesMap = (allMilestones as OfferMilestone[]).reduce(
          (acc: Record<string, OfferMilestone[]>, m) => {
            if (!acc[m.repreneur_offer_id]) acc[m.repreneur_offer_id] = []
            acc[m.repreneur_offer_id].push(m)
            return acc
          },
          {}
        )
      }
    } catch {
      // offer_milestones table may not exist yet
      console.log("Milestones table not available yet")
    }
  }

  // Fetch leadership assessment data
  const [leadershipAssessment, pendingAssessment, portalAccessStatus, opportunityMatches, opportunityCandidates] = await Promise.all([
    getLatestAssessment(id),
    getPendingAssessment(id),
    getRepreneurPortalAccessStatus(id),
    listOpportunityMatchesForRepreneur(id),
    listOpportunityCandidatesForRepreneur(id),
  ])

  // Build user email map
  const userEmailMap: Record<string, string> = {}
  if (currentUser) {
    userEmailMap[currentUser.id] = currentUser.email?.split('@')[0] || currentUser.name || 'Team'
  }

  // Transform notes to include creator email (use userEmailMap like activities)
  const notesWithEmail = notes.map((note) => ({
    ...note,
    created_by_email: userEmailMap[note.created_by] || "Team",
  }))

  // Merge milestones into offers
  const repreneurOffersWithMilestones = repreneurOffers.map(ro => ({
    ...ro,
    milestones: milestonesMap[ro.id] || []
  }))

  // Transform activities to include creator email
  const activitiesWithEmail = activities.map((activity) => ({
    ...activity,
    created_by_email: userEmailMap[activity.created_by] || "Team",
  }))

  const milestones = extractMilestones(repreneur)
  const milestoneCount = countMilestones(milestones)
  const derivedStage = deriveJourneyStage(milestones)
  const stageConfig = getStageConfig(derivedStage)
  const whoScore = profile.who_score ?? profile.tier1_score ?? null
  const whenScore = profile.when_score ?? null
  const recommendationLabel = getRecommendationLabel(profile.recommendation, whoScore, whenScore)
  const scoringFlags = profile.scoring_flags ?? []
  const tier2Overall = profile.tier2_overall
  const currentNeeds = formatV2Array(NEEDS_QUESTIONS as QuestionOptionMap, "q17", profile.q17_current_needs)
  const targetRegions = formatV2Array(WHEN_QUESTIONS as QuestionOptionMap, "q12", profile.q12_geo_zones)
  const targetSectorsV2 = formatV2Array(WHEN_QUESTIONS as QuestionOptionMap, "q13", profile.q13_target_sectors_v2)
  const dealSize = formatV2Array(WHEN_QUESTIONS as QuestionOptionMap, "q14", profile.q14_deal_size)
  const equity = getV2Label(WHEN_QUESTIONS as QuestionOptionMap, "q16", profile.q16_equity)
  const experience = getV2Label(WHO_QUESTIONS as QuestionOptionMap, "q06", profile.q06_experience)
  const topOpportunityMatches = [...opportunityMatches]
    .sort((left, right) => {
      const priorityDelta = matchPriority(left) - matchPriority(right)
      if (priorityDelta !== 0) return priorityDelta
      return (right.platform_score ?? -1) - (left.platform_score ?? -1)
    })
    .slice(0, 3)
  const openOpportunityCount = opportunityMatches.filter((match) => !["declined", "dropped"].includes(match.status)).length
  const recentHistory = [
    ...activitiesWithEmail.map((activity) => ({
      id: `activity-${activity.id}`,
      date: activity.event_date || activity.created_at,
      title: getActivityLabel(activity.activity_type),
      detail: activity.notes,
    })),
    ...notesWithEmail.map((note) => ({
      id: `note-${note.id}`,
      date: note.created_at,
      title: `${note.note_type.charAt(0).toUpperCase()}${note.note_type.slice(1)} note`,
      detail: note.content,
    })),
  ]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 4)
  const stageProgress = STAGE_GROUPS.map((group) => {
    const groupMilestones = MILESTONES.filter((milestone) => milestone.stageGroup === group.group)
    const completed = groupMilestones.filter((milestone) => milestones[milestone.key]).length
    return { ...group, completed, total: groupMilestones.length }
  })
  const activeOfferCount = repreneurOffersWithMilestones.filter((offer) => offer.status !== "declined").length
  const assessmentStatus = leadershipAssessment ? "Complete" : pendingAssessment ? "Pending" : "Not sent"
  const nextMatch = topOpportunityMatches[0]
  const nextBestAction = profile.needs_data_completion && !whoScore
    ? {
        title: "Complete qualification data",
        reason: "WHO/WHEN scoring is incomplete, so recommendations and readiness are harder to trust.",
        href: `/repreneurs/${id}?tab=qualification`,
        label: "Open qualification",
      }
    : nextMatch
      ? {
          title: `Review match fit for ${opportunityTitle(nextMatch)}`,
          reason: `${getOpportunityMatchRecommendationLabel(nextMatch.platform_recommendation)} with ${nextMatch.platform_score ?? "no"} platform score. Confirm the human view and pursuit status.`,
          href: nextMatch.opportunity?.id ? `/opportunities/${nextMatch.opportunity.id}?tab=recommendations` : `/repreneurs/${id}?tab=opportunities`,
          label: "Open match",
        }
      : !portalAccessStatus.enabled && repreneur.lifecycle_status === "client"
        ? {
            title: "Enable portal access",
            reason: "This repreneur is already a client, but external portal access is not enabled yet.",
            href: `/repreneurs/${id}?tab=engagement`,
            label: "Open engagement",
          }
        : {
            title: "Log the next relationship step",
            reason: "Keep the team aligned on the latest interaction and next follow-up.",
            href: `/repreneurs/${id}?tab=timeline`,
            label: "Open timeline",
          }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/repreneurs/explore">
            <ArrowLeft data-icon="inline-start" />
            Back to repreneurs
          </Link>
        </Button>
      </div>

      {/* Record identity and current operating state */}
      <header className="grid gap-6 border-b border-border/80 pb-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="flex min-w-0 items-start gap-4">
          <RepreneurAvatar
            repreneurId={id}
            avatarUrl={repreneur.avatar_url}
            firstName={repreneur.first_name}
            lastName={repreneur.last_name}
            size="xl"
            editable
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <EditableRepreneurIdentity
              repreneurId={id}
              firstName={repreneur.first_name}
              lastName={repreneur.last_name}
            />
            {/* Email and Phone - stacked on mobile */}
            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <EditableTextField
                  repreneurId={id}
                  field="email"
                  value={repreneur.email}
                  label="Email"
                  type="email"
                  placeholder="email@example.com"
                />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Phone className="size-4 text-muted-foreground shrink-0" />
                <EditableTextField
                  repreneurId={id}
                  field="phone"
                  value={repreneur.phone}
                  label="Phone"
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                />
              </div>
            </div>
            <MissingFieldsBadge repreneur={repreneur} />
            {profile.needs_data_completion && (
              <NeedsCompletionBadge repreneurId={id} compact />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 xl:justify-end">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <StatusBadge status={repreneur.lifecycle_status} />
          </div>
          {/* Journey Stage */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Journey</Label>
            <Badge variant="outline" className={`gap-1.5 ${getStageTone(derivedStage)}`}>
              <StageIconGlyph stage={derivedStage} className="size-3.5" />
              {stageConfig.label}
              <span className="text-xs opacity-75">({milestoneCount}/17)</span>
            </Badge>
          </div>
          {/* Actions menu */}
          <div className="pb-px">
            <RepreneurActionsMenu
              repreneurId={repreneur.id}
              currentStatus={repreneur.lifecycle_status}
              repreneurName={`${repreneur.first_name} ${repreneur.last_name}`}
            />
          </div>
        </div>
      </header>

      <RepreneurDetailTabs defaultValue="overview" validTabs={REPRENEUR_DETAIL_TAB_VALUES}>
        <div className="overflow-x-auto border-b border-border/80">
          <TabsList className="w-max border-b-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="qualification">Qualification</TabsTrigger>
            <TabsTrigger value="readiness">Readiness</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex flex-col gap-5">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-5" />
                Next Best Action
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-base font-medium">{nextBestAction.title}</p>
                <p className="max-w-3xl text-sm text-muted-foreground">{nextBestAction.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={nextBestAction.href}>{nextBestAction.label}</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/repreneurs/${id}?tab=timeline`}>Open timeline</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <Card className="xl:col-start-1 xl:row-start-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="size-5" />
                  Relationship Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FieldSummary label="Status">
                  <StatusBadge status={repreneur.lifecycle_status} />
                </FieldSummary>
                <FieldSummary label="Journey">
                  <Badge variant="outline" className={`gap-1.5 ${getStageTone(derivedStage)}`}>
                    <StageIconGlyph stage={derivedStage} className="size-3.5" />
                    {stageConfig.label}
                    <span className="text-xs opacity-75">({milestoneCount}/17)</span>
                  </Badge>
                </FieldSummary>
                <FieldSummary label="Source">
                  {SOURCE_OPTIONS.find((option) => option.value === repreneur.source)?.label ?? (repreneur.source ? humanizeIdentifier(repreneur.source) : muted(null))}
                </FieldSummary>
                <FieldSummary label="Portal">
                  {portalAccessStatus.enabled ? "Enabled" : <EmptyText>Disabled</EmptyText>}
                </FieldSummary>
                <div className="sm:col-span-2">
                  <FieldSummary label="Current needs">
                    {currentNeeds || <EmptyText>Not answered</EmptyText>}
                  </FieldSummary>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-start-2 xl:row-start-1">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="size-5" />
                  Qualification Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">WHO</p>
                    <p className="text-2xl font-semibold">{whoScore ?? "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">WHEN</p>
                    <p className="text-2xl font-semibold">{whenScore ?? "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">T2</p>
                    <p className="text-2xl font-semibold">{tier2Overall ? tier2Overall.toFixed(1) : "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getRecommendationColor(profile.recommendation)} variant="outline">
                    {recommendationLabel}
                  </Badge>
                  {scoringFlags.length > 0 ? (
                    <Badge variant="outline" className="border-destructive/30 text-destructive">
                      {scoringFlags.length} flag{scoringFlags.length > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No scoring flags</Badge>
                  )}
                  <Badge variant="outline">Assessment {assessmentStatus}</Badge>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/repreneurs/${id}?tab=qualification`}>Open qualification</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="xl:col-start-1 xl:row-start-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="size-5" />
                  Acquisition Project
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FieldSummary label="Target sectors">
                  {targetSectorsV2 || repreneur.sector_preferences?.join(", ") || <EmptyText>Not set</EmptyText>}
                </FieldSummary>
                <FieldSummary label="Regions">
                  {targetRegions || <EmptyText>Not set</EmptyText>}
                </FieldSummary>
                <FieldSummary label="Deal size">
                  {dealSize || <EmptyText>Not set</EmptyText>}
                </FieldSummary>
                <FieldSummary label="Equity">
                  {equity || <EmptyText>Not set</EmptyText>}
                </FieldSummary>
              </CardContent>
            </Card>

            <Card className="xl:col-start-1 xl:row-start-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BriefcaseBusiness className="size-5" />
                  Open Opportunities
                </CardTitle>
                <Badge variant="outline">{openOpportunityCount} open</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {topOpportunityMatches.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No opportunity matches connected yet.
                  </p>
                ) : (
                  topOpportunityMatches.map((match) => (
                    <div key={match.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{opportunityTitle(match)}</p>
                        <p className="text-xs text-muted-foreground">
                          {[match.opportunity?.reference, match.opportunity?.sector, match.opportunity?.location].filter(Boolean).join(" · ") || "No reference details"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{getOpportunityMatchRecommendationLabel(match.platform_recommendation)}</Badge>
                        <Badge variant="secondary">{getOpportunityMatchStatusLabel(match.status)}</Badge>
                      </div>
                    </div>
                  ))
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/repreneurs/${id}?tab=opportunities`}>Open opportunities</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="xl:col-start-2 xl:row-start-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flag className="size-5" />
                  Readiness Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stageProgress.map((group) => (
                  <div key={group.group} className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{group.title}</p>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    </div>
                    <Badge variant="outline">{group.completed}/{group.total}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="xl:col-start-2 xl:row-start-3">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-5" />
                  Recent History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentHistory.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No notes or activities yet.
                  </p>
                ) : (
                  recentHistory.map((item) => (
                    <div key={item.id} className="flex gap-3 border-b pb-3 last:border-0 last:pb-0">
                      <div className="mt-0.5 rounded-full bg-muted p-2">
                        <Clock3 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(item.date)}</p>
                        {item.detail ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="gap-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-5" />
                Documents and Access
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant={repreneur.cv_url ? "outline" : "secondary"}>CV {repreneur.cv_url ? "uploaded" : "missing"}</Badge>
              <Badge variant={repreneur.ldc_url ? "outline" : "secondary"}>LDC {repreneur.ldc_url ? "uploaded" : "missing"}</Badge>
              <Badge variant="outline">Assessment {assessmentStatus}</Badge>
              <Badge variant={portalAccessStatus.enabled ? "outline" : "secondary"}>Portal {portalAccessStatus.enabled ? "active" : "disabled"}</Badge>
              <Badge variant="outline">{activeOfferCount} offer{activeOfferCount === 1 ? "" : "s"}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={`/repreneurs/${id}?tab=engagement`}>Open engagement</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualification" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="size-5" />
                    WHO / WHEN Scores
                  </CardTitle>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge className={getRecommendationColor(profile.recommendation)} variant="outline">
                      {recommendationLabel}
                    </Badge>
                    {scoringFlags.length > 0 && (
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive">
                              <AlertTriangle className="size-3" />
                              <span className="text-xs font-medium">{scoringFlags.length}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="mb-1 text-xs font-medium text-destructive">Flags override recommendation</p>
                            {scoringFlags.map((flag) => (
                              <p key={flag} className="text-xs">{flag}</p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.needs_data_completion && !whoScore && (
                  <NeedsCompletionBadge repreneurId={id} />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="wave-micro-label">WHO</span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label="About the WHO score" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <Info className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm">Profile quality: experience, leadership, crisis management.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <WhoScoreEditor repreneur={repreneur} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{whoScore ?? "—"}</span>
                      <span className="text-sm text-muted-foreground">pts</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getWhoDescription(whoScore)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="wave-micro-label">WHEN</span>
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label="About the WHEN score" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <Info className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm">Project maturity: deal size, structure, equity fit.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <WhenScoreEditor repreneur={repreneur} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{whenScore ?? "—"}</span>
                      <span className="text-sm text-muted-foreground">pts</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getWhenDescription(whenScore)}
                    </Badge>
                  </div>
                </div>

                <ScoringAccuracy
                  repreneurId={id}
                  whoAccuracy={profile.who_accuracy}
                  whenAccuracy={profile.when_accuracy}
                  accuracyNotes={profile.accuracy_notes}
                  accuracyRatedAt={profile.accuracy_rated_at}
                />
              </CardContent>
            </Card>

            <RepreneurRadarChart repreneur={profile} />
          </div>

          <LeadershipResultsCard
            repreneurId={id}
            assessment={leadershipAssessment}
            pendingToken={pendingAssessment?.token || null}
          />
        </TabsContent>

        <TabsContent value="readiness" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-5" />
                Acquisition Project
              </CardTitle>
              <CardDescription>Target profile, financial fit, and current support needs.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FieldSummary label="Investment Capacity">
                {equity || <EmptyText>Not set</EmptyText>}
              </FieldSummary>
              <FieldSummary label="Deal Size">
                {dealSize || <EmptyText>Not set</EmptyText>}
              </FieldSummary>
              <FieldSummary label="Region">
                {targetRegions || <EmptyText>Not set</EmptyText>}
              </FieldSummary>
              <FieldSummary label="Experience">
                {experience || <EmptyText>Not specified</EmptyText>}
              </FieldSummary>
              <div>
                <Label className="text-xs text-muted-foreground">Sectors</Label>
                <EditableMultiSelect
                  repreneurId={id}
                  field="sector_preferences"
                  value={repreneur.sector_preferences}
                  options={SECTORS}
                  placeholder="Select sectors..."
                />
              </div>
              <FieldSummary label="Targets Identified">
                {repreneur.q12_has_identified_targets !== undefined
                  ? (repreneur.q12_has_identified_targets ? "Yes" : "No")
                  : <EmptyText>Not answered</EmptyText>}
              </FieldSummary>
              <div className="md:col-span-3">
                <FieldSummary label="Current Needs">
                  {currentNeeds || <EmptyText>Not answered</EmptyText>}
                </FieldSummary>
              </div>
              {profile.q11_priority_choice && (
                <div className="md:col-span-3">
                  <FieldSummary label="Acquisition Priority">
                    {profile.q11_priority_choice === "preferred"
                      ? "Preferred career option"
                      : "One option among others"}
                  </FieldSummary>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Flag className="size-5" />
                  Readiness Milestones
                </CardTitle>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="About readiness milestones" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm">
                        17 readiness milestones in 4 groups. Completing all milestones in a group advances the journey stage:
                        Explorer, Learner, Ready, Execution, Post-acquisition.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <Tier3MilestonesCard
                repreneurId={repreneur.id}
                repreneur={repreneur}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <RepreneurOpportunityMatchesCard repreneurId={id} matches={opportunityMatches} candidates={opportunityCandidates} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <PortalAccessCard
              repreneurId={repreneur.id}
              status={portalAccessStatus}
            />
            <DocumentsCard
              repreneurId={id}
              cvUrl={repreneur.cv_url}
              ldcUrl={repreneur.ldc_url}
            />
          </div>
          <RepreneurOffersList
            repreneurId={id}
            repreneurOffers={repreneurOffersWithMilestones as RepreneurOffer[]}
            allOffers={(allOffers || []) as Offer[]}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ActivityHistory repreneurId={id} activities={activitiesWithEmail as Activity[]} />
            <RepreneurNotes repreneurId={id} notes={notesWithEmail as Note[]} />
          </div>
        </TabsContent>
      </RepreneurDetailTabs>
    </div>
  )
}
