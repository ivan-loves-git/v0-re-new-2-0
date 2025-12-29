"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createOffer, updateOffer } from "@/lib/actions/offers"
import type { Offer } from "@/lib/types/offer"

interface OfferFormProps {
  offer?: Offer
}

export function OfferForm({ offer }: OfferFormProps) {
  const router = useRouter()
  const isEditing = !!offer

  const handleSubmit = async (formData: FormData) => {
    if (isEditing) {
      await updateOffer(offer.id, formData)
      router.push("/offers")
    } else {
      await createOffer(formData)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Offer" : "Create New Offer"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Offer Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Starter Pack"
                defaultValue={offer?.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (EUR) *</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 2500"
                defaultValue={offer?.price}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
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
              <Label htmlFor="duration_days">Duration (days) *</Label>
              <Input
                id="duration_days"
                name="duration_days"
                type="number"
                min="1"
                placeholder="e.g., 90"
                defaultValue={offer?.duration_days}
                required
              />
              <p className="text-xs text-gray-500">How long the offer lasts after acceptance</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptance_deadline_days">Acceptance Deadline (days)</Label>
              <Input
                id="acceptance_deadline_days"
                name="acceptance_deadline_days"
                type="number"
                min="1"
                placeholder="e.g., 14"
                defaultValue={offer?.acceptance_deadline_days || ""}
              />
              <p className="text-xs text-gray-500">Days to accept after being offered</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includes_hours">Coaching Hours</Label>
              <Input
                id="includes_hours"
                name="includes_hours"
                type="number"
                min="0"
                placeholder="e.g., 10"
                defaultValue={offer?.includes_hours || ""}
              />
              <p className="text-xs text-gray-500">Hours included in the package</p>
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
              <Label htmlFor="includes_resources">Includes Resources</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={offer?.is_active ?? true}
                value="true"
              />
              <Label htmlFor="is_active">Active</Label>
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
