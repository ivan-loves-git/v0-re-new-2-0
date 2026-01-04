"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignOfferToRepreneur } from "@/lib/actions/offers"
import type { Offer } from "@/lib/types/offer"

interface AssignOfferFormProps {
  repreneurId: string
  offers: Offer[]
  existingOfferIds: string[]
}

export function AssignOfferForm({ repreneurId, offers, existingOfferIds }: AssignOfferFormProps) {
  const [open, setOpen] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableOffers = offers.filter(
    (offer) => offer.is_active && !existingOfferIds.includes(offer.id)
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const handleSubmit = async () => {
    if (!selectedOffer) return

    setIsSubmitting(true)
    try {
      await assignOfferToRepreneur(repreneurId, selectedOffer)
      setOpen(false)
      setSelectedOffer("")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Assign Offer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Offer</DialogTitle>
          <DialogDescription>Select an offer to assign to this repreneur.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {availableOffers.length === 0 ? (
            <p className="text-sm text-gray-500">
              No available offers to assign. All active offers have already been assigned.
            </p>
          ) : (
            <>
              <Select value={selectedOffer} onValueChange={setSelectedOffer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an offer" />
                </SelectTrigger>
                <SelectContent>
                  {availableOffers.map((offer) => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.name} - {formatPrice(offer.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!selectedOffer || isSubmitting}>
                  {isSubmitting ? "Assigning..." : "Assign Offer"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
