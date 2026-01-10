import Link from "next/link"
import { Plus, Upload } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { RepreneurTable } from "@/components/repreneurs/repreneur-table"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Repreneurs</h1>
          <p className="text-gray-600 mt-1">Manage entrepreneurs looking to acquire businesses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/repreneurs/import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </Link>
          <Link href="/repreneurs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Repreneur
            </Button>
          </Link>
        </div>
      </div>

      <RepreneurTable repreneurs={repreneursWithOffers} />
    </div>
  )
}
