import { createServerClient } from "@/lib/supabase/server"
import { StaticPipelineBoard } from "@/components/pipeline/static-pipeline-board"
import type { Repreneur } from "@/lib/types/repreneur"

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
}

export default async function PipelinePage() {
  const supabase = await createServerClient()

  // Fetch repreneurs with their offers
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select(`
      *,
      repreneur_offers(
        offer:offers(name)
      )
    `)
    .order("created_at", { ascending: false })

  // Transform to include offer_names array
  const repreneursWithOffers: RepreneurWithOffers[] = (repreneurs || []).map((r: any) => ({
    ...r,
    offer_names: r.repreneur_offers
      ?.map((ro: any) => ro.offer?.name)
      .filter(Boolean) || [],
  }))

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
