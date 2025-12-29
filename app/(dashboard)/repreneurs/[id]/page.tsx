import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Phone, MapPin, DollarSign, Target } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/repreneurs/status-badge"
import { RepreneurNotes } from "@/components/repreneurs/repreneur-notes"
import { UpdateStatusForm } from "@/components/repreneurs/update-status-form"
import { RepreneurOffersList } from "@/components/offers/repreneur-offers-list"
import type { Note } from "@/lib/types/repreneur"
import type { RepreneurOffer, Offer } from "@/lib/types/offer"

export default async function RepreneurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  // Fetch repreneur
  const { data: repreneur } = await supabase.from("repreneurs").select("*").eq("id", id).single()

  if (!repreneur) {
    notFound()
  }

  // Fetch notes with user email
  const { data: notes } = await supabase
    .from("notes")
    .select(`
      *,
      created_by_email:auth.users!notes_created_by_fkey(email)
    `)
    .eq("repreneur_id", id)
    .order("created_at", { ascending: false })

  // Transform notes to include email
  const notesWithEmail = (notes || []).map((note: any) => ({
    ...note,
    created_by_email: note.created_by_email?.email || "Unknown",
  }))

  // Fetch repreneur offers with offer details
  const { data: repreneurOffers } = await supabase
    .from("repreneur_offers")
    .select(`
      *,
      offer:offers(*)
    `)
    .eq("repreneur_id", id)
    .order("offered_at", { ascending: false })

  // Fetch all active offers for assignment
  const { data: allOffers } = await supabase
    .from("offers")
    .select("*")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/repreneurs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Repreneurs
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            {repreneur.first_name} {repreneur.last_name}
          </h1>
          <p className="text-gray-600 mt-1">{repreneur.email}</p>
        </div>
        <UpdateStatusForm repreneurId={repreneur.id} currentStatus={repreneur.lifecycle_status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <Label className="text-xs text-gray-500">Email</Label>
                <p className="text-sm font-medium">{repreneur.email}</p>
              </div>
            </div>
            {repreneur.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <p className="text-sm font-medium">{repreneur.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-gray-400" />
              <div>
                <Label className="text-xs text-gray-500">Status</Label>
                <div className="mt-1">
                  <StatusBadge status={repreneur.lifecycle_status} />
                </div>
              </div>
            </div>
            {repreneur.source && (
              <div>
                <Label className="text-xs text-gray-500">Source</Label>
                <p className="text-sm font-medium mt-1">{repreneur.source}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investment Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {repreneur.investment_capacity && (
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <Label className="text-xs text-gray-500">Investment Capacity</Label>
                  <p className="text-sm font-medium">{repreneur.investment_capacity}</p>
                </div>
              </div>
            )}
            {repreneur.target_acquisition_size && (
              <div>
                <Label className="text-xs text-gray-500">Target Acquisition Size</Label>
                <p className="text-sm font-medium mt-1">{repreneur.target_acquisition_size}</p>
              </div>
            )}
            {repreneur.target_location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <Label className="text-xs text-gray-500">Target Location</Label>
                  <p className="text-sm font-medium">{repreneur.target_location}</p>
                </div>
              </div>
            )}
            {repreneur.sector_preferences && repreneur.sector_preferences.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500">Sector Preferences</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {repreneur.sector_preferences.map((sector) => (
                    <span
                      key={sector}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {repreneur.company_background && (
        <Card>
          <CardHeader>
            <CardTitle>Company Background</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{repreneur.company_background}</p>
          </CardContent>
        </Card>
      )}

      <RepreneurOffersList
        repreneurId={id}
        repreneurOffers={(repreneurOffers || []) as RepreneurOffer[]}
        allOffers={(allOffers || []) as Offer[]}
      />

      <RepreneurNotes repreneurId={id} notes={notesWithEmail as Note[]} />
    </div>
  )
}
