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
    const price = Number(formData.get("price"))
    const duration = Number(formData.get("duration_days"))
    if (!name) nextErrors.name = "Enter an offer name."
    if (!Number.isFinite(price) || price < 0) nextErrors.price = "Enter a price of €0 or more."
    if (!Number.isInteger(duration) || duration < 1) nextErrors.duration_days = "Enter a duration of at least one day."
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
    } catch {
      console.error("Offer save failed")
      toast.error("Failed to save offer. Please try again.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Offer" : "Create New Offer"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          <p className="text-sm text-muted-foreground">Fields marked Required must be completed. All other fields are optional.</p>
          <ValidationSummary
            ref={summaryRef}
            errors={errors}
            labels={{ name: "Offer name", price: "Price", duration_days: "Duration" }}
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
              />
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
              />
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
