"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createOffer, updateOffer } from "@/lib/actions/offers"
import { toast } from "sonner"
import type { Offer } from "@/lib/types/offer"
import {
  FieldError,
  FormFieldLabel,
  ValidationSummary,
  fieldErrorProps,
  focusValidationSummary,
  type FieldErrors,
} from "@/components/forms/validation-feedback"

interface OfferFormProps {
  offer?: Offer
}

export function OfferForm({ offer }: OfferFormProps) {
  const router = useRouter()
  const isEditing = !!offer
  const [errors, setErrors] = useState<FieldErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (formData: FormData) => {
    const nextErrors: FieldErrors = {}
    const name = String(formData.get("name") ?? "").trim()
    const priceRaw = String(formData.get("price") ?? "").trim()
    const price = priceRaw ? Number(priceRaw) : Number.NaN
    const duration = Number(formData.get("duration_days"))
    const acceptanceDeadlineRaw = String(formData.get("acceptance_deadline_days") ?? "").trim()
    const coachingHoursRaw = String(formData.get("includes_hours") ?? "").trim()
    const acceptanceDeadline = acceptanceDeadlineRaw ? Number(acceptanceDeadlineRaw) : null
    const coachingHours = coachingHoursRaw ? Number(coachingHoursRaw) : null
    if (!name) nextErrors.name = "Enter an offer name."
    if (!priceRaw) nextErrors.price = "Enter a price."
    else if (!Number.isFinite(price) || price < 0) nextErrors.price = "Enter a price of €0 or more."
    if (!Number.isInteger(duration) || duration < 1) nextErrors.duration_days = "Enter a duration of at least one day."
    if (acceptanceDeadline !== null && (!Number.isInteger(acceptanceDeadline) || acceptanceDeadline < 1)) {
      nextErrors.acceptance_deadline_days = "Enter at least one day, or leave this blank."
    }
    if (coachingHours !== null && (!Number.isInteger(coachingHours) || coachingHours < 0)) {
      nextErrors.includes_hours = "Enter a whole number of zero or more, or leave this blank."
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      focusValidationSummary(summaryRef)
      return
    }

    try {
      if (isEditing) {
        await updateOffer(offer.id, formData)
        toast.success("Offer updated")
        router.push("/offers")
      } else {
        await createOffer(formData)
        toast.success("Offer created")
      }
    } catch (error) {
      console.error("Offer save failed")
      const message = error instanceof Error ? error.message : "Failed to save offer. Please try again."
      const normalizedMessage = message.toLowerCase()
      const serverErrors: FieldErrors = {}
      if (normalizedMessage.includes("name")) serverErrors.name = message
      if (normalizedMessage.includes("price")) serverErrors.price = message
      if (normalizedMessage.includes("duration")) serverErrors.duration_days = message
      if (normalizedMessage.includes("acceptance")) serverErrors.acceptance_deadline_days = message
      if (normalizedMessage.includes("coaching") || normalizedMessage.includes("hours")) serverErrors.includes_hours = message

      if (Object.keys(serverErrors).length > 0) {
        setErrors(serverErrors)
        focusValidationSummary(summaryRef)
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Offer" : "Create New Offer"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6" noValidate>
          <p className="text-sm text-muted-foreground">Fields marked Required must be completed. All other fields are optional.</p>
          <ValidationSummary
            ref={summaryRef}
            errors={errors}
            labels={{
              name: "Offer name",
              price: "Price",
              duration_days: "Duration",
              acceptance_deadline_days: "Acceptance deadline",
              includes_hours: "Coaching hours",
            }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FormFieldLabel htmlFor="name" requirement="required">Offer name</FormFieldLabel>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Starter Pack"
                defaultValue={offer?.name}
                required
                {...fieldErrorProps("name", errors.name)}
                onChange={() => setErrors(current => ({ ...current, name: "" }))}
              />
              <FieldError id="name" message={errors.name} />
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="price" requirement="required">Price (EUR)</FormFieldLabel>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 2500"
                defaultValue={offer?.price}
                required
                {...fieldErrorProps("price", errors.price)}
                onChange={() => setErrors(current => ({ ...current, price: "" }))}
              />
              <FieldError id="price" message={errors.price} />
            </div>
          </div>

          <div className="space-y-2">
            <FormFieldLabel htmlFor="description" requirement="optional">Description</FormFieldLabel>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe what's included in this offer..."
              rows={3}
              defaultValue={offer?.description || ""}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <FormFieldLabel htmlFor="duration_days" requirement="required">Duration (days)</FormFieldLabel>
              <Input
                id="duration_days"
                name="duration_days"
                type="number"
                min="1"
                placeholder="e.g., 90"
                defaultValue={offer?.duration_days}
                required
                {...fieldErrorProps("duration_days", errors.duration_days)}
                onChange={() => setErrors(current => ({ ...current, duration_days: "" }))}
              />
              <FieldError id="duration_days" message={errors.duration_days} />
              <p className="text-xs text-muted-foreground">How long the offer lasts after acceptance</p>
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="acceptance_deadline_days" requirement="optional">Acceptance Deadline (days)</FormFieldLabel>
              <Input
                id="acceptance_deadline_days"
                name="acceptance_deadline_days"
                type="number"
                min="1"
                placeholder="e.g., 14"
                defaultValue={offer?.acceptance_deadline_days || ""}
                {...fieldErrorProps("acceptance_deadline_days", errors.acceptance_deadline_days)}
                onChange={() => setErrors(current => ({ ...current, acceptance_deadline_days: "" }))}
              />
              <FieldError id="acceptance_deadline_days" message={errors.acceptance_deadline_days} />
              <p className="text-xs text-muted-foreground">Days to accept after being offered</p>
            </div>

            <div className="space-y-2">
              <FormFieldLabel htmlFor="includes_hours" requirement="optional">Coaching Hours</FormFieldLabel>
              <Input
                id="includes_hours"
                name="includes_hours"
                type="number"
                min="0"
                placeholder="e.g., 10"
                defaultValue={offer?.includes_hours || ""}
                {...fieldErrorProps("includes_hours", errors.includes_hours)}
                onChange={() => setErrors(current => ({ ...current, includes_hours: "" }))}
              />
              <FieldError id="includes_hours" message={errors.includes_hours} />
              <p className="text-xs text-muted-foreground">Hours included in the package</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="includes_resources"
                name="includes_resources"
                defaultChecked={offer?.includes_resources ?? true}
                value="true"
              />
              <FormFieldLabel htmlFor="includes_resources" requirement="optional">Includes Resources</FormFieldLabel>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={offer?.is_active ?? true}
                value="true"
              />
              <FormFieldLabel htmlFor="is_active" requirement="optional">Active</FormFieldLabel>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit">{isEditing ? "Save Changes" : "Create Offer"}</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/offers")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
