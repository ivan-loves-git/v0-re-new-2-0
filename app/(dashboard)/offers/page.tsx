import { createServerClient } from "@/lib/supabase/server"
import { connection } from "next/server"
import { OffersTimeline } from "@/components/offers/offers-timeline"
import { PackageManagementSheet } from "@/components/offers/package-management-sheet"
import { SectionPageHeader } from "@/components/ui/section-page-header"
import { Package } from "lucide-react"

// Cache for 30 seconds - prevents re-fetching on rapid navigation

export default async function OffersPage() {
  await connection()

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
    <div className="flex flex-col gap-6">
      <SectionPageHeader
        title="Offers"
        subtitle="Track active client engagements, package status, and delivery milestones."
        icon={Package}
        tone="repreneur"
        actions={<PackageManagementSheet packages={packages || []} />}
      />

      <OffersTimeline clientOffers={clientOffers || []} />
    </div>
  )
}
