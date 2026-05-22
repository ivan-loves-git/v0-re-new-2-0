import { cacheLife, cacheTag, revalidateTag } from "next/cache"
import { connection } from "next/server"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Repreneur } from "@/lib/types/repreneur"
import type {
  OpportunityWithSource,
  OpportunityWorkSurfaceMatch,
  OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"

export const DASHBOARD_CACHE_TAGS = {
  repreneurs: "dashboard:repreneurs",
  repreneurLists: "dashboard:repreneur-lists",
  repreneurDashboard: "dashboard:repreneur-dashboard",
  analytics: "dashboard:analytics",
  opportunities: "dashboard:opportunities",
  opportunityDashboard: "dashboard:opportunity-dashboard",
  offers: "dashboard:offers",
  guide: "dashboard:guide",
} as const

const REPRENEUR_LIST_FIELDS = `
  id,
  email,
  first_name,
  last_name,
  phone,
  avatar_url,
  source,
  lifecycle_status,
  journey_stage,
  persona,
  recommendation,
  created_at,
  updated_at,
  tier1_score,
  tier1_score_breakdown,
  who_score,
  when_score,
  declined_at,
  rejected_at,
  decline_reason_category,
  q08_crisis,
  q09_investment,
  q10_impact,
  q11_project_status,
  q14_deal_size,
  q15_structure,
  ms_decision_to_pursue,
  ms_availability_confirmed,
  ms_target_profile_sheet,
  ms_pitch_plan,
  ms_equity_range,
  ms_deal_breakers,
  ms_leadership_assessment_passed,
  ms_advisory_team_identified,
  ms_intermediary_meeting,
  ms_seller_meeting,
  ms_loi_issued,
  ms_due_diligence,
  ms_negotiation,
  ms_financing_validated,
  ms_closing,
  ms_plan_100_days,
  ms_plan_3_years,
  repreneur_offers(
    status,
    offer:offers(name)
  )
`

const REPRENEUR_DASHBOARD_FIELDS = `
  id,
  first_name,
  last_name,
  email,
  lifecycle_status,
  journey_stage,
  created_at,
  updated_at,
  tier1_score,
  tier1_score_breakdown,
  who_score,
  when_score
`

const OPPORTUNITY_LIST_FIELDS = `
  id,
  reference,
  status,
  source_id,
  source_label,
  source_visibility,
  sector,
  activity,
  location,
  description,
  revenue_meur,
  ebitda_keur,
  headcount,
  date_added,
  repreneur_visibility,
  public_title,
  anonymized_description,
  staff_notes,
  imported_from,
  imported_at,
  archived_at,
  created_by,
  created_at,
  updated_at,
  source:ma_sources(
    id,
    firm_name,
    source_type,
    contact_name,
    contact_email,
    contact_phone,
    notes,
    created_by,
    created_at,
    updated_at
  )
`

export interface RepreneurListRecord extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
  has_scheduled_interview?: boolean
}

export interface RepreneurDashboardSnapshot {
  repreneurs: Repreneur[]
  assessments: Array<{
    id: string
    repreneur_id: string
    decision: string | null
    completed_at: string | null
  }>
  activities: Array<{
    id: string
    activity_type: string
    notes: string | null
    duration_minutes: number | null
    created_at: string
    created_by: string | null
    repreneur_id: string | null
    repreneurs?: {
      first_name: string | null
      last_name: string | null
    } | null
  }>
  chartRepreneurs: Array<{ id: string; created_at: string }>
  chartActivities: Array<{ id: string; created_at: string }>
}

interface RepreneurListQueryRow extends Repreneur {
  repreneur_offers?: Array<{ offer?: { name?: string | null } | null }> | null
}

type OpportunityQueryRow = Omit<OpportunityWithSource, "source"> & {
  source?: OpportunityWithSource["source"] | OpportunityWithSource["source"][] | null
}

type OpportunityMatchQueryRow = Omit<OpportunityWorkSurfaceMatch, "repreneur"> & {
  repreneur?:
    | OpportunityWorkSurfaceMatch["repreneur"]
    | OpportunityWorkSurfaceMatch["repreneur"][]
    | null
}

function normalizeAssessmentMap(
  assessments: Array<{
    repreneur_id: string
    decision: string | null
    completed_at: string | null
  }>,
) {
  const assessmentMap = new Map<
    string,
    { decision: string | null; completed: boolean }
  >()

  for (const assessment of assessments) {
    const existing = assessmentMap.get(assessment.repreneur_id)
    if (!existing || (assessment.completed_at && !existing.completed)) {
      assessmentMap.set(assessment.repreneur_id, {
        decision: assessment.completed_at ? assessment.decision : null,
        completed: Boolean(assessment.completed_at),
      })
    }
  }

  return assessmentMap
}

function normalizeRepreneurListRows(
  repreneurs: RepreneurListQueryRow[],
  assessments: Array<{
    repreneur_id: string
    decision: string | null
    completed_at: string | null
  }>,
  upcomingInterviews: Array<{ repreneur_id: string | null }>,
): RepreneurListRecord[] {
  const assessmentMap = normalizeAssessmentMap(assessments)
  const interviewRepreneurIds = new Set(
    upcomingInterviews
      .map((activity) => activity.repreneur_id)
      .filter((id): id is string => Boolean(id)),
  )

  return repreneurs.map((repreneur) => {
    const assessment = assessmentMap.get(repreneur.id)
    return {
      ...repreneur,
      offer_names:
        repreneur.repreneur_offers
          ?.map((offerRow) => offerRow.offer?.name)
          .filter(Boolean) ?? [],
      assessment_decision: assessment?.decision ?? null,
      assessment_pending: assessment ? !assessment.completed : false,
      has_scheduled_interview: interviewRepreneurIds.has(repreneur.id),
    }
  })
}

function normalizeOpportunity(row: OpportunityQueryRow): OpportunityWithSource {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  return {
    ...row,
    source: source ?? null,
  } as OpportunityWithSource
}

function normalizeWorkSurfaceMatch(
  row: OpportunityMatchQueryRow,
): OpportunityWorkSurfaceMatch {
  const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
  return {
    ...row,
    repreneur: repreneur ?? null,
  } as OpportunityWorkSurfaceMatch
}

async function getCachedRepreneurListSnapshot() {
  "use cache"
  cacheLife({ stale: 30, revalidate: 30, expire: 300 })
  cacheTag(DASHBOARD_CACHE_TAGS.repreneurs, DASHBOARD_CACHE_TAGS.repreneurLists)

  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  const [repreneursResult, assessmentsResult, interviewsResult] =
    await Promise.all([
      supabase
        .from("repreneurs")
        .select(REPRENEUR_LIST_FIELDS)
        .order("created_at", { ascending: false }),
      supabase
        .from("leadership_assessments")
        .select("repreneur_id, decision, completed_at")
        .order("completed_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("activities")
        .select("repreneur_id")
        .eq("activity_type", "interview")
        .gte("event_date", nowIso),
    ])

  if (repreneursResult.error) throw new Error(repreneursResult.error.message)
  if (assessmentsResult.error) throw new Error(assessmentsResult.error.message)
  if (interviewsResult.error) throw new Error(interviewsResult.error.message)

  return normalizeRepreneurListRows(
    repreneursResult.data ?? [],
    assessmentsResult.data ?? [],
    interviewsResult.data ?? [],
  )
}

async function getCachedRepreneurDashboardSnapshot(): Promise<RepreneurDashboardSnapshot> {
  "use cache"
  cacheLife({ stale: 30, revalidate: 30, expire: 300 })
  cacheTag(
    DASHBOARD_CACHE_TAGS.repreneurs,
    DASHBOARD_CACHE_TAGS.repreneurDashboard,
  )

  const supabase = createAdminClient()
  const [repreneursResult, assessmentsResult, activitiesResult, chartsResult] =
    await Promise.all([
      supabase
        .from("repreneurs")
        .select(REPRENEUR_DASHBOARD_FIELDS)
        .order("created_at", { ascending: false }),
      supabase
        .from("leadership_assessments")
        .select("id, repreneur_id, decision, completed_at")
        .order("completed_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("activities")
        .select(`
          id,
          activity_type,
          notes,
          duration_minutes,
          created_at,
          created_by,
          repreneur_id,
          repreneurs (
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(20),
      Promise.all([
        supabase
          .from("repreneurs")
          .select("id, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("activities")
          .select("id, created_at")
          .order("created_at", { ascending: false }),
      ]),
    ])

  if (repreneursResult.error) throw new Error(repreneursResult.error.message)
  if (assessmentsResult.error) throw new Error(assessmentsResult.error.message)
  if (activitiesResult.error) throw new Error(activitiesResult.error.message)

  const [chartRepreneursResult, chartActivitiesResult] = chartsResult
  if (chartRepreneursResult.error) {
    throw new Error(chartRepreneursResult.error.message)
  }
  if (chartActivitiesResult.error) {
    throw new Error(chartActivitiesResult.error.message)
  }

  return {
    repreneurs: (repreneursResult.data ?? []) as Repreneur[],
    assessments: assessmentsResult.data ?? [],
    activities: (activitiesResult.data ?? []) as RepreneurDashboardSnapshot["activities"],
    chartRepreneurs: chartRepreneursResult.data ?? [],
    chartActivities: chartActivitiesResult.data ?? [],
  }
}

async function getCachedOpportunityWorkSurfaceSnapshot(): Promise<
  OpportunityWorkSurfaceRecord[]
> {
  "use cache"
  cacheLife({ stale: 30, revalidate: 30, expire: 300 })
  cacheTag(DASHBOARD_CACHE_TAGS.opportunities)

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_LIST_FIELDS)
    .order("date_added", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const opportunities = (data ?? []).map(normalizeOpportunity)
  const opportunityIds = opportunities.map((opportunity) => opportunity.id)

  if (opportunityIds.length === 0) {
    return opportunities.map((opportunity) => ({ ...opportunity, matches: [] }))
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      status,
      pursuit_stage,
      updated_at,
      repreneur:repreneurs(
        id,
        first_name,
        last_name,
        email,
        lifecycle_status,
        journey_stage,
        recommendation,
        who_score,
        when_score
      )
    `)
    .in("opportunity_id", opportunityIds)
    .order("updated_at", { ascending: false })

  if (matchError) throw new Error(matchError.message)

  const matchesByOpportunity = new Map<string, OpportunityWorkSurfaceMatch[]>()
  for (const row of matchRows ?? []) {
    const match = normalizeWorkSurfaceMatch(row)
    const current = matchesByOpportunity.get(match.opportunity_id) ?? []
    current.push(match)
    matchesByOpportunity.set(match.opportunity_id, current)
  }

  return opportunities.map((opportunity) => ({
    ...opportunity,
    matches: matchesByOpportunity.get(opportunity.id) ?? [],
  }))
}

export async function getRepreneurListSnapshot() {
  await connection()
  await requireStaffAccess()
  return getCachedRepreneurListSnapshot()
}

export async function getRepreneurDashboardSnapshot() {
  await connection()
  await requireStaffAccess()
  return getCachedRepreneurDashboardSnapshot()
}

export async function getOpportunityWorkSurfaceSnapshot() {
  await connection()
  await requireStaffAccess()
  return getCachedOpportunityWorkSurfaceSnapshot()
}

export function revalidateDashboardTags(tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, "max")
  }
}

export function revalidateRepreneurDashboardTags() {
  revalidateDashboardTags([
    DASHBOARD_CACHE_TAGS.repreneurs,
    DASHBOARD_CACHE_TAGS.repreneurLists,
    DASHBOARD_CACHE_TAGS.repreneurDashboard,
    DASHBOARD_CACHE_TAGS.analytics,
  ])
}

export function revalidateOpportunityDashboardTags() {
  revalidateDashboardTags([
    DASHBOARD_CACHE_TAGS.opportunities,
    DASHBOARD_CACHE_TAGS.opportunityDashboard,
    DASHBOARD_CACHE_TAGS.analytics,
  ])
}
