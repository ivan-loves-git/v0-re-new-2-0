"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  MoreHorizontal,
  Check,
  Clock,
  Trash2,
  Eye,
  Package,
  CheckCircle2,
  Circle,
  ArrowRight,
  Calendar,
  User
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OfferStatusBadge } from "./offer-status-badge"
import { OfferMilestones } from "./offer-milestones"
import { updateRepreneurOfferStatus, deleteRepreneurOffer } from "@/lib/actions/offers"
import type { Offer, OfferStatus, OfferMilestone } from "@/lib/types/offer"

// Generate consistent avatar number from ID
function getDefaultAvatarNumber(repreneurId: string): number {
  let hash = 0
  for (let i = 0; i < repreneurId.length; i++) {
    const char = repreneurId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash % 16) + 1
}

interface ClientOfferCardProps {
  id: string
  repreneurId: string
  repreneurName: string
  repreneurEmail: string
  avatarUrl?: string | null
  offer: Offer
  status: OfferStatus
  offeredAt: string
  acceptedAt?: string | null
  expiresAt?: string | null
  milestones: OfferMilestone[]
}

const STATUS_STEPS: OfferStatus[] = ["offered", "active", "completed"]

export function ClientOfferCard({
  id,
  repreneurId,
  repreneurName,
  repreneurEmail,
  avatarUrl,
  offer,
  status,
  offeredAt,
  acceptedAt,
  expiresAt,
  milestones,
}: ClientOfferCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const handleStatusChange = async (newStatus: OfferStatus) => {
    setIsLoading(true)
    try {
      await updateRepreneurOfferStatus(id, newStatus, repreneurId)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this offer?")) return
    setIsLoading(true)
    try {
      await deleteRepreneurOffer(id, repreneurId)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate milestone progress
  const completedMilestones = milestones.filter(m => m.is_completed).length
  const totalMilestones = milestones.length

  // Get current step index for timeline
  const currentStepIndex = STATUS_STEPS.indexOf(status)
  const isExpired = status === "expired"

  // Avatar image
  const defaultAvatarNumber = getDefaultAvatarNumber(repreneurId)
  const imageSrc = avatarUrl || `/avatars/default-${defaultAvatarNumber}.png`

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Link href={`/repreneurs/${repreneurId}`} className="flex-shrink-0">
              <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-200 border border-gray-200 hover:ring-2 hover:ring-blue-500 transition-all">
                <Image
                  src={imageSrc}
                  alt={repreneurName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            </Link>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Header row: name, package, status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/repreneurs/${repreneurId}`}
                    className="font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block"
                  >
                    {repreneurName}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Package className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm text-gray-600">{offer.name}</span>
                    <OfferStatusBadge status={status} />
                  </div>
                </div>

                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLoading}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsViewOpen(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {status === "offered" && (
                      <>
                        <DropdownMenuItem onClick={() => handleStatusChange("active")}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Active
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange("expired")}>
                          <Clock className="h-4 w-4 mr-2" />
                          Mark as Expired
                        </DropdownMenuItem>
                      </>
                    )}
                    {status === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange("expired")}>
                          <Clock className="h-4 w-4 mr-2" />
                          Mark as Expired
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Offer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Timeline progress */}
              {!isExpired && (
                <div className="mt-3 flex items-center gap-1">
                  {STATUS_STEPS.map((step, index) => {
                    const isComplete = index <= currentStepIndex
                    const isCurrent = index === currentStepIndex
                    return (
                      <div key={step} className="flex items-center">
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          isComplete
                            ? isCurrent
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-400"
                        }`}>
                          {isComplete && !isCurrent ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Circle className="h-3 w-3" />
                          )}
                          <span className="capitalize">{step}</span>
                        </div>
                        {index < STATUS_STEPS.length - 1 && (
                          <ArrowRight className={`h-3 w-3 mx-0.5 ${
                            index < currentStepIndex ? "text-green-400" : "text-gray-300"
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Info row: dates and milestones */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Offered {formatDate(offeredAt)}</span>
                </div>
                {acceptedAt && (
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-500" />
                    <span>Active {formatDate(acceptedAt)}</span>
                  </div>
                )}
                {expiresAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Expires {formatDate(expiresAt)}</span>
                  </div>
                )}
                {totalMilestones > 0 && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className={`h-3 w-3 ${completedMilestones === totalMilestones ? "text-green-500" : "text-gray-400"}`} />
                    <span>{completedMilestones}/{totalMilestones} milestones</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {offer.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {repreneurName}
              <span className="text-gray-300">|</span>
              Offered: {formatDate(offeredAt)}
              {expiresAt && (
                <>
                  <span className="text-gray-300">|</span>
                  Expires: {formatDate(expiresAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <OfferStatusBadge status={status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Price</span>
              <span className="font-medium">{formatPrice(offer.price)}</span>
            </div>
            {offer.description && (
              <div className="space-y-1">
                <span className="text-sm text-gray-500">Description</span>
                <p className="text-sm text-gray-700">{offer.description}</p>
              </div>
            )}
            {offer.duration_days && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Duration</span>
                <span className="text-sm">{offer.duration_days} days</span>
              </div>
            )}
            {offer.includes_hours && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Consulting Hours</span>
                <span className="text-sm">{offer.includes_hours} hours</span>
              </div>
            )}

            {/* Milestones section */}
            {(status === "active" || status === "completed") && (
              <div className="border-t pt-4">
                <OfferMilestones
                  repreneurOfferId={id}
                  repreneurId={repreneurId}
                  milestones={milestones}
                  isActive={status === "active"}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Link href={`/repreneurs/${repreneurId}`}>
              <Button>View Profile</Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
