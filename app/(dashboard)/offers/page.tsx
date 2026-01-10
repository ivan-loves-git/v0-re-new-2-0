import { createServerClient } from "@/lib/supabase/server"
import { OffersTimeline } from "@/components/offers/offers-timeline"
import { PackageManagementSheet } from "@/components/offers/package-management-sheet"

// Cache for 30 seconds - prevents re-fetching on rapid navigation
export const revalidate = 30

export default async function OffersPage() {
  const supabase = await createServerClient()

  // Fetch all client offers with their relationships
  const { data: clientOffers } = await supabase
    .from("repreneur_offers")
    .select(`
      *,
      offer:offers(*),
      repreneur:repreneurs(id, first_name, last_name, email, avatar_url),
      milestones:offer_milestones(*)
    `)
    .order("offered_at", { ascending: false })

  // Fetch all offer packages for the management sheet
  const { data: packages } = await supabase
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Client Offers</h1>
          <p className="text-gray-600 mt-1">
            Track and manage offers assigned to your clients
          </p>
        </div>
        <PackageManagementSheet packages={packages || []} />
      </div>

      <OffersTimeline clientOffers={clientOffers || []} />
    </div>
  )
}
