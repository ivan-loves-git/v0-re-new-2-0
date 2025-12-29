import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OfferForm } from "@/components/offers/offer-form"

export default function NewOfferPage() {
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
        <h1 className="text-3xl font-semibold text-gray-900">New Offer</h1>
        <p className="text-gray-600 mt-1">Create a new consulting package</p>
      </div>

      <OfferForm />
    </div>
  )
}
