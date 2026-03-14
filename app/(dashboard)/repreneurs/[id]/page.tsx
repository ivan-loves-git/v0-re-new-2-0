import { notFound } from "next/navigation"
import Link from "next/link"
import { DollarSign, Star, Info, Mail, Phone, Compass, Map, Flag, Rocket, Crown, AlertTriangle } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth-server"
import { BackButton } from "@/components/ui/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { MissingFieldsBadge } from "@/components/repreneurs/missing-fields-badge"
import { NeedsCompletionBadge } from "@/components/repreneurs/needs-completion-badge"
import { getStageConfig } from "@/lib/constants/tier-config"
import { deriveJourneyStage, countMilestones, extractMilestones } from "@/lib/utils/journey-derivation"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { EditableTextField } from "@/components/repreneurs/editable-text-field"
import { EditableSelectField } from "@/components/repreneurs/editable-select-field"
import { EditableMultiSelect } from "@/components/repreneurs/editable-multi-select"
import { RepreneurNotes } from "@/components/repreneurs/repreneur-notes"
import { RepreneurOffersList } from "@/components/offers/repreneur-offers-list"
import { Tier3MilestonesCard } from "@/components/repreneurs/tier3-milestones-card"
import { RepreneurActionsMenu } from "@/components/repreneurs/repreneur-actions-menu"
import { ActivityHistory } from "@/components/repreneurs/activity-history"
import { DocumentsCard } from "@/components/repreneurs/documents-card"
import { LeadershipResultsCard } from "@/components/repreneurs/leadership-results-card"
import { getLatestAssessment, getPendingAssessment } from "@/lib/actions/leadership-assessment"
import { WhoScoreEditor } from "@/components/repreneurs/who-score-editor"
import { WhenScoreEditor } from "@/components/repreneurs/when-score-editor"
import { RecommendationBadge } from "@/components/scoring-v2/recommendation-badge"
import { FlagBadges } from "@/components/scoring-v2/flag-badges"
import type { Flag as ScoringFlag } from "@/components/scoring-v2/types"
import { FRENCH_REGIONS } from "@/lib/constants/french-regions"
import { SECTORS } from "@/lib/constants/sectors"
import { INVESTMENT_CAPACITY_RANGES, TARGET_ACQUISITION_SIZE_RANGES } from "@/lib/constants/investment-ranges"
import { WHO_QUESTIONS, WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import type { Note, Activity, Repreneur } from "@/lib/types/repreneur"
import type { RepreneurOffer, Offer, OfferMilestone } from "@/lib/types/offer"

// Cache for 30 seconds
export const revalidate = 30

// Source options for dropdown
const SOURCE_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Direct contact" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
]

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
      default: return recommendation
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
      return "bg-green-100 text-green-800 border-green-200"
    case "interview_validate_thesis":
    case "interview_validate_execution":
      return "bg-blue-100 text-blue-800 border-blue-200"
    default:
      return "bg-amber-100 text-amber-800 border-amber-200"
  }
}

// Helper functions to get V2 questionnaire labels
function getV2Label(
  questions: Record<string, { options: ReadonlyArray<{ value: string; label: string }> }>,
  questionId: string,
  value: string | null | undefined
): string | null {
  if (!value) return null
  const question = questions[questionId]
  if (!question) return null
  const option = question.options.find((o) => o.value === value)
  return option?.label || value
}

function formatV2Array(
  questions: Record<string, { options: ReadonlyArray<{ value: string; label: string }> }>,
  questionId: string,
  values: string[] | null | undefined
): string | null {
  if (!values || values.length === 0) return null
  const question = questions[questionId]
  if (!question) return null
  return values
    .map((v) => question.options.find((o) => o.value === v)?.label || v)
    .join(", ")
}

export default async function RepreneurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  // First fetch repreneur (required to validate page exists)
  const { data: repreneur } = await supabase.from("repreneurs").select("*").eq("id", id).single()

  if (!repreneur) {
    notFound()
  }

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
  const [leadershipAssessment, pendingAssessment] = await Promise.all([
    getLatestAssessment(id),
    getPendingAssessment(id),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackButton label="Back" />
      </div>

      {/* Header with avatar, name, contact and status controls */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <RepreneurAvatar
            repreneurId={id}
            avatarUrl={repreneur.avatar_url}
            firstName={repreneur.first_name}
            lastName={repreneur.last_name}
            size="xl"
            editable
          />
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:gap-6 gap-1">
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
                <EditableTextField
                  repreneurId={id}
                  field="first_name"
                  value={repreneur.first_name}
                  label="First Name"
                  placeholder="First name"
                  textClassName="text-xl sm:text-2xl font-semibold text-gray-900"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400 mb-1 block">Surname</Label>
                <EditableTextField
                  repreneurId={id}
                  field="last_name"
                  value={repreneur.last_name}
                  label="Last Name"
                  placeholder="Last name"
                  textClassName="text-xl sm:text-2xl font-semibold text-gray-900"
                />
              </div>
            </div>
            {/* Email and Phone - stacked on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
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
                <Phone className="h-4 w-4 text-gray-400 shrink-0" />
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
            {(repreneur as any).needs_data_completion && (
              <NeedsCompletionBadge repreneurId={id} compact />
            )}
          </div>
        </div>
        {/* Right side: Status + Journey Stage + Actions */}
        <div className="flex flex-wrap items-start gap-4 sm:gap-6">
          {/* Status */}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
            <StatusBadge status={repreneur.lifecycle_status} />
          </div>
          {/* Journey Stage */}
          {(() => {
            const milestones = extractMilestones(repreneur)
            const milestoneCount = countMilestones(milestones)
            const derivedStage = deriveJourneyStage(milestones)
            const stageConfig = getStageConfig(derivedStage)
            const StageIcon = derivedStage === "explorer" ? Compass :
                             derivedStage === "learner" ? Map :
                             derivedStage === "ready" ? Flag :
                             derivedStage === "execution" ? Rocket : Crown
            return (
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Journey</Label>
                <Badge className={`gap-1.5 ${stageConfig.bgColor} ${stageConfig.color} border-0`}>
                  <StageIcon className="h-3.5 w-3.5" />
                  {stageConfig.label}
                  <span className="text-xs opacity-75">({milestoneCount}/18)</span>
                </Badge>
              </div>
            )
          })()}
          {/* Actions menu */}
          <div className="pt-5">
            <RepreneurActionsMenu
              repreneurId={repreneur.id}
              currentStatus={repreneur.lifecycle_status}
              repreneurName={`${repreneur.first_name} ${repreneur.last_name}`}
            />
          </div>
        </div>
      </div>

      {/* Profile Overview Row: Scores & Profile | Leadership Assessment (2-col span) */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Col 1: Combined Scores & Profile Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Scores & Profile
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={getRecommendationColor((repreneur as any).recommendation)} variant="outline">
                  {getRecommendationLabel((repreneur as any).recommendation, (repreneur as any).who_score, (repreneur as any).when_score)}
                </Badge>
                {(repreneur as any).scoring_flags?.length > 0 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-md text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs font-medium">{(repreneur as any).scoring_flags.length}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs font-medium text-red-600 mb-1">Flags override recommendation</p>
                        {(repreneur as any).scoring_flags.map((flag: string) => (
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
            {(repreneur as any).needs_data_completion && !(repreneur as any).who_score && (
              <NeedsCompletionBadge repreneurId={id} />
            )}

            {/* WHO + WHEN side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHO</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3 w-3" />
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
                  <span className="text-4xl font-bold">{(repreneur as any).who_score ?? repreneur.tier1_score ?? "—"}</span>
                  <span className="text-sm text-gray-500">pts</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getWhoDescription((repreneur as any).who_score ?? repreneur.tier1_score)}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WHEN</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3 w-3" />
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
                  <span className="text-4xl font-bold">{(repreneur as any).when_score ?? "—"}</span>
                  <span className="text-sm text-gray-500">pts</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {getWhenDescription((repreneur as any).when_score)}
                </Badge>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Investment Profile
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <Label className="text-xs text-gray-500">Investment Capacity</Label>
                  <p className="text-sm">
                    {getV2Label(WHEN_QUESTIONS as any, 'q16', (repreneur as any).q16_equity)
                      || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Deal Size</Label>
                  <p className="text-sm">
                    {formatV2Array(WHEN_QUESTIONS as any, 'q14', (repreneur as any).q14_deal_size)
                      || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Region</Label>
                  <p className="text-sm">
                    {formatV2Array(WHEN_QUESTIONS as any, 'q12', (repreneur as any).q12_geo_zones)
                      || <span className="text-gray-400">Not set</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Experience</Label>
                  <p className="text-sm">
                    {getV2Label(WHO_QUESTIONS as any, 'q06', (repreneur as any).q06_experience)
                      || <span className="text-gray-400">Not specified</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Sectors</Label>
                  <EditableMultiSelect
                    repreneurId={id}
                    field="sector_preferences"
                    value={repreneur.sector_preferences}
                    options={SECTORS}
                    placeholder="Select sectors..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Targets Identified</Label>
                  <p className="text-sm">
                    {repreneur.q12_has_identified_targets !== undefined
                      ? (repreneur.q12_has_identified_targets ? "Yes" : "No")
                      : <span className="text-gray-400">—</span>}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Col 2-3: Leadership Assessment (flagship — 2/3 width) */}
        <div className="md:col-span-2">
          <LeadershipResultsCard
            repreneurId={id}
            assessment={leadershipAssessment}
            pendingToken={pendingAssessment?.token || null}
          />
        </div>
      </div>

      {/* Milestones & Documents Row */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Col 1-2: Milestones */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Readiness Milestones
              </CardTitle>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      18 readiness milestones in 4 groups. Completing all milestones in a group advances the journey stage:
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

        {/* Col 3: Documents */}
        <DocumentsCard
          repreneurId={id}
          cvUrl={repreneur.cv_url}
          ldcUrl={repreneur.ldc_url}
        />
      </div>

      {/* Third Row: Activity History | Notes | Offers */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Col 1: Activity History */}
        <ActivityHistory repreneurId={id} activities={activitiesWithEmail as Activity[]} />

        {/* Col 2: Notes */}
        <RepreneurNotes repreneurId={id} notes={notesWithEmail as Note[]} />

        {/* Col 3: Offers */}
        <RepreneurOffersList
          repreneurId={id}
          repreneurOffers={repreneurOffersWithMilestones as RepreneurOffer[]}
          allOffers={(allOffers || []) as Offer[]}
        />
      </div>
    </div>
  )
}
