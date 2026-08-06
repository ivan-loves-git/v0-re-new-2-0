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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { assignOfferToRepreneur } from "@/lib/actions/offers"
import { toast } from "sonner"
import type { Offer, RepreneurOffer } from "@/lib/types/offer"

interface AssignOfferFormProps {
  repreneurId: string
  offers: Offer[]
  existingOfferIds: string[]
  onOfferAssigned?: (tempOffer: RepreneurOffer) => void
  onAssignComplete?: () => void
  onAssignError?: (tempId: string) => void
}

export function AssignOfferForm({
  repreneurId,
  offers,
  existingOfferIds,
  onOfferAssigned,
  onAssignComplete,
  onAssignError,
}: AssignOfferFormProps) {
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

    const offer = offers.find(o => o.id === selectedOffer)
    if (!offer) return

    // Create optimistic offer
    const tempId = `temp-${Date.now()}`
    const tempOffer: RepreneurOffer = {
      id: tempId,
      repreneur_id: repreneurId,
      offer_id: selectedOffer,
      status: "offered",
      offered_at: new Date().toISOString(),
      created_by: "",
      offer: offer,
    }

    // Optimistically add to parent state
    onOfferAssigned?.(tempOffer)

    // Close dialog and reset
    setOpen(false)
    setSelectedOffer("")
    setIsSubmitting(true)

    try {
      await assignOfferToRepreneur(repreneurId, selectedOffer)
      toast.success("Offer assigned")
      // Small delay to allow server to process before refresh
      await new Promise(resolve => setTimeout(resolve, 100))
      onAssignComplete?.()
    } catch {
      console.error("Offer assignment failed")
      toast.error("Failed to assign offer. Please try again.")
      // Revert on error
      onAssignError?.(tempId)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-2" />
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
            <p className="text-sm text-muted-foreground">
              No available offers to assign. All active offers have already been assigned.
            </p>
          ) : (
            <>
              <Select value={selectedOffer} onValueChange={setSelectedOffer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an offer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
        {availableOffers.map((offer) => (
          <SelectItem key={offer.id} value={offer.id}>
            {offer.name} - {formatPrice(offer.price)}
          </SelectItem>
        ))}
                  </SelectGroup>
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
