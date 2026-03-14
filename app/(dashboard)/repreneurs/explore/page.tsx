import { createServerClient } from "@/lib/supabase/server"
import { RepreneursExplorePage } from "@/components/repreneurs/repreneurs-explore-page"
import type { Repreneur } from "@/lib/types/repreneur"

export const revalidate = 30

export default async function RepreneurExplorePage() {
  const supabase = await createServerClient()

  const [repreneursResult, assessmentsResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("leadership_assessments")
      .select("repreneur_id, decision, completed_at")
  ])

  const repreneurs = repreneursResult.data || []
  const assessments = assessmentsResult.data || []

  // Build assessment lookup
  const assessmentMap = new Map<string, { decision: string | null; completed: boolean }>()
  for (const a of assessments) {
    const existing = assessmentMap.get(a.repreneur_id)
    if (!existing || (a.completed_at && !existing.completed)) {
      assessmentMap.set(a.repreneur_id, {
        decision: a.completed_at ? a.decision : null,
        completed: !!a.completed_at,
      })
    }
  }

  const repreneursWithAssessment = repreneurs.map((r: any) => {
    const assessment = assessmentMap.get(r.id)
    return {
      ...r,
      assessment_decision: assessment?.decision || null,
      assessment_pending: assessment ? !assessment.completed : false,
    }
  })

  return <RepreneursExplorePage repreneurs={repreneursWithAssessment} />
}
