import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { OfferForm } from "@/components/offers/offer-form"

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: offer } = await supabase.from("offers").select("*").eq("id", id).single()

  if (!offer) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/offers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offers
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Edit Offer</h1>
        <p className="text-gray-600 mt-1">Update the offer details</p>
      </div>

      <OfferForm offer={offer} />
    </div>
  )
}
