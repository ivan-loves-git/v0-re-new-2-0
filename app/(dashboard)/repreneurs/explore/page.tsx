import { createServerClient } from "@/lib/supabase/server"
import { RepreneurExploreTable } from "@/components/repreneurs/repreneur-explore-table"
import type { Repreneur } from "@/lib/types/repreneur"

export const revalidate = 30

export default async function RepreneurExplorePage() {
  const supabase = await createServerClient()

  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Explore Repreneurs</h1>
        <p className="text-gray-600 mt-1">Filter, sort, and find repreneurs across your entire pipeline</p>
      </div>

      <RepreneurExploreTable repreneurs={(repreneurs || []) as Repreneur[]} />
    </div>
  )
}
