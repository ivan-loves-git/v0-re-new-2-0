import { createServerClient } from "@/lib/supabase/server"
import { OfferTable } from "@/components/offers/offer-table"

export default async function OffersPage() {
  const supabase = await createServerClient()

  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Offers</h1>
        <p className="text-gray-600 mt-1">Manage consulting packages and offers</p>
      </div>

      <OfferTable offers={offers || []} />
    </div>
  )
}
