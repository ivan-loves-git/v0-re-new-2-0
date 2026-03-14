import { createServerClient } from "@/lib/supabase/server"
import { StaticPipelineBoard } from "@/components/pipeline/static-pipeline-board"
import type { Repreneur } from "@/lib/types/repreneur"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
  assessment_decision?: string | null
  assessment_pending?: boolean
}

export default async function PipelinePage() {
  const supabase = await createServerClient()

  const [repreneursResult, assessmentsResult] = await Promise.all([
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

  const repreneursWithOffers: RepreneurWithOffers[] = repreneurs.map((r: any) => {
    const assessment = assessmentMap.get(r.id)
    return {
      ...r,
      offer_names: r.repreneur_offers
        ?.map((ro: any) => ro.offer?.name)
        .filter(Boolean) || [],
      assessment_decision: assessment?.decision || null,
      assessment_pending: assessment ? !assessment.completed : false,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Pipeline</h1>
        <p className="text-gray-600 mt-1">Visual overview of repreneurs by status</p>
      </div>

      <StaticPipelineBoard repreneurs={repreneursWithOffers} />
    </div>
  )
}
