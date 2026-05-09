import { createServerClient } from "@/lib/supabase/server"
import { RepreneursGroupsPage } from "@/components/repreneurs/repreneurs-groups-page"
import type { Repreneur } from "@/lib/types/repreneur"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
  has_scheduled_interview?: boolean
}

export default async function RepreneursPage() {
  const supabase = await createServerClient()

  // Fetch repreneurs with their offers + leadership assessments + upcoming interviews in parallel
  const nowIso = new Date().toISOString()
  const [repreneursResult, assessmentsResult, interviewsResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select(`
        *,
        repreneur_offers(
          offer:offers(name)
        )
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("leadership_assessments")
      .select("repreneur_id, decision, completed_at"),
    // Upcoming interview = activity_type='interview' with an event_date in the future.
    supabase
      .from("activities")
      .select("repreneur_id, event_date")
      .eq("activity_type", "interview")
      .gte("event_date", nowIso),
  ])

  const repreneurs = repreneursResult.data || []
  const assessments = assessmentsResult.data || []
  const upcomingInterviews = interviewsResult.data || []
  const interviewRepreneurIds = new Set(upcomingInterviews.map((a) => a.repreneur_id))

  // Build lookup: repreneur_id → latest assessment
  const assessmentMap = new Map<string, { decision: string | null; completed: boolean }>()
  for (const a of assessments) {
    const existing = assessmentMap.get(a.repreneur_id)
    // Keep the completed one if exists, otherwise the latest
    if (!existing || (a.completed_at && !existing.completed)) {
      assessmentMap.set(a.repreneur_id, {
        decision: a.completed_at ? a.decision : null,
        completed: !!a.completed_at,
      })
    }
  }

  // Transform to include offer_names + assessment data
  const repreneursWithOffers: RepreneurWithOffers[] = repreneurs.map((r: any) => {
    const assessment = assessmentMap.get(r.id)
    return {
      ...r,
      offer_names: r.repreneur_offers
        ?.map((ro: any) => ro.offer?.name)
        .filter(Boolean) || [],
      assessment_decision: assessment?.decision || null,
      assessment_pending: assessment ? !assessment.completed : false,
      has_scheduled_interview: interviewRepreneurIds.has(r.id),
    }
  })

  return <RepreneursGroupsPage repreneurs={repreneursWithOffers} />
}
