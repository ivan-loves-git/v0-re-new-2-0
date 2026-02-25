import { createServerClient } from "@/lib/supabase/server"
import { RepreneursGroupsPage } from "@/components/repreneurs/repreneurs-groups-page"
import type { Repreneur } from "@/lib/types/repreneur"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

interface RepreneurWithOffers extends Repreneur {
  offer_names?: string[]
}

export default async function RepreneursPage() {
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

  return <RepreneursGroupsPage repreneurs={repreneursWithOffers} />
}
