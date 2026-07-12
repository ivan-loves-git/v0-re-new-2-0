import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { ArrowLeft, PackageOpen } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { OfferForm } from "@/components/offers/offer-form"
import { SectionPageHeader } from "@/components/ui/section-page-header"

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()

  const { id } = await params
  const supabase = await createServerClient()

  const { data: offer } = await supabase.from("offers").select("*").eq("id", id).single()

  if (!offer) {
    notFound()
  }

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
        title="Edit offer"
        subtitle="Update the package details used across active client engagements."
        icon={PackageOpen}
        tone="repreneur"
      />

      <OfferForm offer={offer} />
    </div>
  )
}
