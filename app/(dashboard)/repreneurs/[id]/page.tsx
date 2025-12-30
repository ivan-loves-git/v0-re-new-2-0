import { notFound } from "next/navigation"
import { Mail, Phone, MapPin, DollarSign, Target, Compass, Building, Briefcase } from "lucide-react"
import { createServerClient } from "@/lib/supabase/server"
import { BackButton } from "@/components/ui/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { UpdateStatusForm } from "@/components/repreneurs/update-status-form"
import { UpdateJourneyStageForm } from "@/components/repreneurs/update-journey-stage-form"
import { EditableTextField } from "@/components/repreneurs/editable-text-field"
import { EditableSelectField } from "@/components/repreneurs/editable-select-field"
import { EditableMultiSelect } from "@/components/repreneurs/editable-multi-select"
import { RepreneurNotes } from "@/components/repreneurs/repreneur-notes"
import { RepreneurOffersList } from "@/components/offers/repreneur-offers-list"
import { FRENCH_REGIONS } from "@/lib/constants/french-regions"
import { SECTORS } from "@/lib/constants/sectors"
import { INVESTMENT_CAPACITY_RANGES, TARGET_ACQUISITION_SIZE_RANGES } from "@/lib/constants/investment-ranges"
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
        <BackButton label="Back" />
      </div>

      {/* Header with name and main status controls */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <EditableTextField
              repreneurId={id}
              field="first_name"
              value={repreneur.first_name}
              label="First Name"
              placeholder="First name"
            />
            <EditableTextField
              repreneurId={id}
              field="last_name"
              value={repreneur.last_name}
              label="Last Name"
              placeholder="Last name"
            />
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="h-4 w-4" />
            <EditableTextField
              repreneurId={id}
              field="email"
              value={repreneur.email}
              label="Email"
              type="email"
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
            <UpdateStatusForm repreneurId={repreneur.id} currentStatus={repreneur.lifecycle_status} />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Journey Stage</Label>
            <UpdateJourneyStageForm repreneurId={repreneur.id} currentStage={repreneur.journey_stage} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500">Phone</Label>
              <EditableTextField
                repreneurId={id}
                field="phone"
                value={repreneur.phone}
                label="Phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Source</Label>
              <EditableTextField
                repreneurId={id}
                field="source"
                value={repreneur.source}
                label="Source"
                placeholder="How did they find us?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Investment Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Investment Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500">Investment Capacity</Label>
              <EditableSelectField
                repreneurId={id}
                field="investment_capacity"
                value={repreneur.investment_capacity}
                options={INVESTMENT_CAPACITY_RANGES}
                placeholder="Select range..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Target Acquisition Size</Label>
              <EditableSelectField
                repreneurId={id}
                field="target_acquisition_size"
                value={repreneur.target_acquisition_size}
                options={TARGET_ACQUISITION_SIZE_RANGES}
                placeholder="Select range..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Target Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Target Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs text-gray-500">Region</Label>
              <EditableSelectField
                repreneurId={id}
                field="target_location"
                value={repreneur.target_location}
                options={FRENCH_REGIONS}
                placeholder="Select region..."
                searchable
              />
            </div>
          </CardContent>
        </Card>

        {/* Sector Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Sector Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditableMultiSelect
              repreneurId={id}
              field="sector_preferences"
              value={repreneur.sector_preferences}
              options={SECTORS}
              placeholder="Select sectors..."
            />
          </CardContent>
        </Card>
      </div>

      {/* Company Background */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Background
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditableTextField
            repreneurId={id}
            field="company_background"
            value={repreneur.company_background}
            label="Background"
            type="textarea"
            placeholder="Professional background, experience, motivations..."
          />
        </CardContent>
      </Card>

      <RepreneurOffersList
        repreneurId={id}
        repreneurOffers={(repreneurOffers || []) as RepreneurOffer[]}
        allOffers={(allOffers || []) as Offer[]}
      />

      <RepreneurNotes repreneurId={id} notes={notesWithEmail as Note[]} />
    </div>
  )
}
