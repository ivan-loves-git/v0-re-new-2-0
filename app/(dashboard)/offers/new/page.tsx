import Link from "next/link"
import { ArrowLeft, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OfferForm } from "@/components/offers/offer-form"
import { SectionPageHeader } from "@/components/ui/section-page-header"

export default function NewOfferPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/offers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Back to Offers
          </Button>
        </Link>
      </div>

      <SectionPageHeader
        title="New offer"
        subtitle="Create a consulting package that can be assigned to a repreneur."
        icon={PackagePlus}
        tone="repreneur"
      />

      <OfferForm />
    </div>
  )
}
