"use client"

import { useState } from "react"
import { MoreHorizontal, Check, Clock, Trash2, Package, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OfferStatusBadge } from "./offer-status-badge"
import { AssignOfferForm } from "./assign-offer-form"
import { OfferMilestones } from "./offer-milestones"
import { updateRepreneurOfferStatus, deleteRepreneurOffer } from "@/lib/actions/offers"
import type { Offer, RepreneurOffer, OfferStatus, OfferMilestone } from "@/lib/types/offer"

interface RepreneurOffersListProps {
  repreneurId: string
  repreneurOffers: RepreneurOffer[]
  allOffers: Offer[]
}

export function RepreneurOffersList({ repreneurId, repreneurOffers, allOffers }: RepreneurOffersListProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [viewingOffer, setViewingOffer] = useState<RepreneurOffer | null>(null)

  const existingOfferIds = repreneurOffers.map((ro) => ro.offer_id)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const handleStatusChange = async (repreneurOfferId: string, newStatus: OfferStatus) => {
    setIsLoading(repreneurOfferId)
    try {
      await updateRepreneurOfferStatus(repreneurOfferId, newStatus, repreneurId)
    } finally {
      setIsLoading(null)
    }
  }

  const handleDelete = async (repreneurOfferId: string) => {
    setIsLoading(repreneurOfferId)
    try {
      await deleteRepreneurOffer(repreneurOfferId, repreneurId)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Offers
        </CardTitle>
        <AssignOfferForm
          repreneurId={repreneurId}
          offers={allOffers}
          existingOfferIds={existingOfferIds}
        />
      </CardHeader>
      <CardContent>
        {repreneurOffers.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No offers assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {repreneurOffers.map((ro) => (
              <div
                key={ro.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ro.offer?.name}</span>
                    <OfferStatusBadge status={ro.status} />
                  </div>
                  <div className="text-sm text-gray-500 space-x-4">
                    <span>{ro.offer ? formatPrice(ro.offer.price) : "-"}</span>
                    <span>Offered: {formatDate(ro.offered_at)}</span>
                    {ro.expires_at && <span>Expires: {formatDate(ro.expires_at)}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isLoading === ro.id}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewingOffer(ro)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    {ro.status === "offered" && (
                      <>
                        <DropdownMenuItem onClick={() => handleStatusChange(ro.id, "active")}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(ro.id, "expired")}>
                          <Clock className="h-4 w-4 mr-2" />
                          Mark as Expired
                        </DropdownMenuItem>
                      </>
                    )}
                    {ro.status === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => handleStatusChange(ro.id, "completed")}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(ro.id, "expired")}>
                          <Clock className="h-4 w-4 mr-2" />
                          Mark as Expired
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDelete(ro.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* View Offer Dialog */}
    <Dialog open={!!viewingOffer} onOpenChange={(open) => !open && setViewingOffer(null)}>
      <DialogContent className={viewingOffer?.status === "active" ? "sm:max-w-[600px]" : "sm:max-w-[500px]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {viewingOffer?.offer?.name || "Offer Details"}
          </DialogTitle>
          <DialogDescription>
            Offered: {viewingOffer && formatDate(viewingOffer.offered_at)}
            {viewingOffer?.expires_at && ` · Expires: ${formatDate(viewingOffer.expires_at)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <OfferStatusBadge status={viewingOffer?.status || "offered"} />
          </div>
          {viewingOffer?.offer && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Price</span>
                <span className="font-medium">{formatPrice(viewingOffer.offer.price)}</span>
              </div>
              {viewingOffer.offer.description && (
                <div className="space-y-1">
                  <span className="text-sm text-gray-500">Description</span>
                  <p className="text-sm text-gray-700">{viewingOffer.offer.description}</p>
                </div>
              )}
              {viewingOffer.offer.duration_days && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Duration</span>
                  <span className="text-sm">{viewingOffer.offer.duration_days} days</span>
                </div>
              )}
              {viewingOffer.offer.includes_hours && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Consulting Hours</span>
                  <span className="text-sm">{viewingOffer.offer.includes_hours} hours</span>
                </div>
              )}
            </>
          )}

          {/* Milestones section - only for active offers */}
          {viewingOffer && (viewingOffer.status === "active" || viewingOffer.status === "completed") && (
            <div className="border-t pt-4">
              <OfferMilestones
                repreneurOfferId={viewingOffer.id}
                repreneurId={repreneurId}
                milestones={(viewingOffer.milestones || []) as OfferMilestone[]}
                isActive={viewingOffer.status === "active"}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setViewingOffer(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
