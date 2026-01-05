import { notFound } from "next/navigation"
import Link from "next/link"
import { DollarSign, Star, Info, Filter, Calculator, Mail, Phone } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { BackButton } from "@/components/ui/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { UpdateJourneyStageForm } from "@/components/repreneurs/update-journey-stage-form"
import { RepreneurAvatar } from "@/components/ui/repreneur-avatar"
import { EditableTextField } from "@/components/repreneurs/editable-text-field"
import { EditableSelectField } from "@/components/repreneurs/editable-select-field"
import { EditableMultiSelect } from "@/components/repreneurs/editable-multi-select"
import { RepreneurNotes } from "@/components/repreneurs/repreneur-notes"
import { RepreneurOffersList } from "@/components/offers/repreneur-offers-list"
import { Tier2StarRating } from "@/components/repreneurs/tier2-star-rating"
import { RepreneurActionsMenu } from "@/components/repreneurs/repreneur-actions-menu"
import { ActivityHistory } from "@/components/repreneurs/activity-history"
import { CandidateRadarChart } from "@/components/repreneurs/candidate-radar-chart"
import { scoreToStarRating, getScoreDescription } from "@/lib/utils/tier1-scoring"
import { FRENCH_REGIONS } from "@/lib/constants/french-regions"
import { SECTORS } from "@/lib/constants/sectors"
import { INVESTMENT_CAPACITY_RANGES, TARGET_ACQUISITION_SIZE_RANGES } from "@/lib/constants/investment-ranges"
import type { Note, Activity, Repreneur } from "@/lib/types/repreneur"
import type { RepreneurOffer, Offer } from "@/lib/types/offer"

// Cache for 30 seconds
export const revalidate = 30

// Source options for dropdown
const SOURCE_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct", label: "Direct contact" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
]

export default async function RepreneurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  // First fetch repreneur (required to validate page exists)
  const { data: repreneur } = await supabase.from("repreneurs").select("*").eq("id", id).single()

  if (!repreneur) {
    notFound()
  }

  // Parallel fetch all related data - runs simultaneously instead of sequentially
  const [
    notesResult,
    repreneurOffersResult,
    allOffersResult,
    activitiesResult,
    userResult
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
      .order("created_at", { ascending: false }),
    // Get current user
    supabase.auth.getUser()
  ])

  const notes = notesResult.data || []
  const repreneurOffers = repreneurOffersResult.data || []
  const allOffers = allOffersResult.data || []
  const activities = activitiesResult.data || []
  const currentUser = userResult.data?.user

  // Try to fetch milestones separately (table may not exist yet)
  let milestonesMap: Record<string, any[]> = {}
  if (repreneurOffers.length > 0) {
    try {
      const { data: allMilestones } = await supabase
        .from("offer_milestones")
        .select("*")
        .in("repreneur_offer_id", repreneurOffers.map(ro => ro.id))

      if (allMilestones) {
        milestonesMap = allMilestones.reduce((acc: Record<string, any[]>, m: any) => {
          if (!acc[m.repreneur_offer_id]) acc[m.repreneur_offer_id] = []
          acc[m.repreneur_offer_id].push(m)
          return acc
        }, {})
      }
    } catch (e) {
      // offer_milestones table may not exist yet
      console.log("Milestones table not available yet")
    }
  }

  // Build user email map
  const userEmailMap: Record<string, string> = {}
  if (currentUser) {
    userEmailMap[currentUser.id] = currentUser.email?.split('@')[0] || 'Team'
  }

  // Transform notes to include placeholder email
  const notesWithEmail = notes.map((note: any) => ({
    ...note,
    created_by_email: "Team",
  }))

  // Merge milestones into offers
  const repreneurOffersWithMilestones = repreneurOffers.map(ro => ({
    ...ro,
    milestones: milestonesMap[ro.id] || []
  }))

  // Transform activities to include creator email
  const activitiesWithEmail = activities.map((activity: any) => ({
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
            <StatusBadge status={repreneur.lifecycle_status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Journey Stage</Label>
            <UpdateJourneyStageForm repreneurId={repreneur.id} currentStage={repreneur.journey_stage} />
          </div>
          <div className="pt-5">
            <RepreneurActionsMenu
              repreneurId={repreneur.id}
              currentStatus={repreneur.lifecycle_status}
              repreneurName={`${repreneur.first_name} ${repreneur.last_name}`}
            />
          </div>
        </div>
      </div>

      {/* Profile Overview Row: Rating | Investment Profile | Radar Chart */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Col 1: Rating Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Rating
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Tier 1 Subsection */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Tier 1</span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm">
                        Tier 1 is an automated score (0-100 points) calculated from the intake questionnaire.
                        It evaluates professional background, M&A experience, acquisition readiness, and financial capacity.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Calculated from questionnaire</p>
              {repreneur.tier1_score !== null && repreneur.tier1_score !== undefined ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold">{repreneur.tier1_score}</span>
                    <span className="text-sm text-gray-500">points</span>
                    <div className="flex items-center gap-1 ml-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < scoreToStarRating(repreneur.tier1_score!)
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getScoreDescription(repreneur.tier1_score!)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-400 hover:text-gray-600 h-6 px-2"
                      asChild
                    >
                      <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                        Edit data
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No score calculated yet.
                  </p>
                  <Button size="sm" asChild>
                    <Link href={`/repreneurs/${repreneur.id}/questionnaire`}>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t pt-4" />

            {/* Tier 2 Subsection */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Tier 2</span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm">
                        Tier 2 is a manual star rating (1-5) assigned by the Re-New team after the interview.
                        It reflects the overall candidate quality based on fit, motivation, and readiness.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Post-interview Re-New rating</p>
              <Tier2StarRating
                repreneurId={repreneur.id}
                currentStars={repreneur.tier2_stars}
              />
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Investment Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Investment Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">Investment Capacity</Label>
              <EditableSelectField
                repreneurId={id}
                field="investment_capacity"
                value={repreneur.investment_capacity}
                options={INVESTMENT_CAPACITY_RANGES}
                placeholder="Select range..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Target Acquisition Size</Label>
              <EditableSelectField
                repreneurId={id}
                field="target_acquisition_size"
                value={repreneur.target_acquisition_size}
                options={TARGET_ACQUISITION_SIZE_RANGES}
                placeholder="Select range..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Target Region</Label>
              <EditableSelectField
                repreneurId={id}
                field="target_location"
                value={repreneur.target_location}
                options={FRENCH_REGIONS}
                placeholder="Select region..."
                searchable
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Sector Preferences</Label>
              <EditableMultiSelect
                repreneurId={id}
                field="sector_preferences"
                value={repreneur.sector_preferences}
                options={SECTORS}
                placeholder="Select sectors..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Years of Experience</Label>
              <p className="text-sm">
                {repreneur.q2_years_experience || <span className="text-gray-400">Not specified</span>}
              </p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Identified Targets</Label>
              <p className="text-sm">
                {repreneur.q12_has_identified_targets !== undefined
                  ? (repreneur.q12_has_identified_targets ? "Yes" : "No")
                  : <span className="text-gray-400">Not specified</span>}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Col 3: Radar Chart */}
        <CandidateRadarChart repreneur={repreneur as Repreneur} />
      </div>

      {/* Second Row: Activity History | Notes | Offers */}
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

      {/* ROW 3: Questionnaire Details (no cards, blank bg, 3-col list) */}
      <div className="pt-6 border-t">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Questionnaire Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
          <div>
            <Label className="text-xs text-gray-500">Employment Status</Label>
            <p className="text-sm">
              {repreneur.q1_employment_status || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Prior M&A Experience</Label>
            <p className="text-sm">
              {repreneur.q4_has_ma_experience !== undefined
                ? (repreneur.q4_has_ma_experience ? "Yes" : "No")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Years of Experience</Label>
            <p className="text-sm">
              {repreneur.q2_years_experience || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Involved in M&A</Label>
            <p className="text-sm">
              {repreneur.q6_involved_in_ma !== undefined
                ? (repreneur.q6_involved_in_ma ? "Yes" : "No")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Team Management</Label>
            <p className="text-sm">
              {repreneur.q5_team_size || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">M&A Details</Label>
            <p className="text-sm">
              {repreneur.q7_ma_details || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Executive Roles</Label>
            <p className="text-sm">
              {repreneur.q8_executive_roles?.length
                ? repreneur.q8_executive_roles.join(", ")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Industry Sectors</Label>
            <p className="text-sm">
              {repreneur.q3_industry_sectors?.length
                ? repreneur.q3_industry_sectors.join(", ")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Board Experience</Label>
            <p className="text-sm">
              {repreneur.q9_board_experience !== undefined
                ? (repreneur.q9_board_experience ? "Yes" : "No")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Journey Stages</Label>
            <p className="text-sm">
              {repreneur.q10_journey_stages?.length
                ? repreneur.q10_journey_stages.join(", ")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Identified Targets</Label>
            <p className="text-sm">
              {repreneur.q12_has_identified_targets !== undefined
                ? (repreneur.q12_has_identified_targets ? "Yes" : "No")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Target Details</Label>
            <p className="text-sm">
              {repreneur.q13_target_details || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Funding Status</Label>
            <p className="text-sm">
              {repreneur.q15_funding_status || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Network & Training</Label>
            <p className="text-sm">
              {repreneur.q16_network_training?.length
                ? repreneur.q16_network_training.join(", ")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Open to Co-acquisition</Label>
            <p className="text-sm">
              {repreneur.q17_open_to_co_acquisition !== undefined
                ? (repreneur.q17_open_to_co_acquisition ? "Yes" : "No")
                : <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Background Notes</Label>
            <p className="text-sm">
              {repreneur.company_background || <span className="text-gray-400">Not specified</span>}
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Source</Label>
            <EditableSelectField
              repreneurId={id}
              field="source"
              value={repreneur.source}
              options={SOURCE_OPTIONS}
              placeholder="Select source..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
