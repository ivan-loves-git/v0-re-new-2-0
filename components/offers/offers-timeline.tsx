"use client"

import { useState } from "react"
import { Search, Filter, ChevronDown, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClientOfferCard } from "./client-offer-card"
import type { Offer, OfferStatus, OfferMilestone } from "@/lib/types/offer"

interface ClientOffer {
  id: string
  repreneur_id: string
  offer_id: string
  status: OfferStatus
  offered_at: string
  accepted_at?: string | null
  expires_at?: string | null
  created_by: string
  offer: Offer
  repreneur: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string | null
  }
  milestones: OfferMilestone[]
}

interface OffersTimelineProps {
  clientOffers: ClientOffer[]
}

const STATUS_LABELS: Record<OfferStatus, string> = {
  offered: "Pending",
  accepted: "Accepted",
  active: "Active",
  completed: "Completed",
  expired: "Expired",
}

const STATUS_ORDER: OfferStatus[] = ["active", "offered", "completed", "expired"]

export function OffersTimeline({ clientOffers }: OffersTimelineProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<OfferStatus[]>(["active", "offered"])

  // Filter offers based on search and status
  const filteredOffers = clientOffers.filter((offer) => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      !search ||
      `${offer.repreneur.first_name} ${offer.repreneur.last_name}`.toLowerCase().includes(searchLower) ||
      offer.offer.name.toLowerCase().includes(searchLower) ||
      offer.repreneur.email.toLowerCase().includes(searchLower)

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(offer.status)

    return matchesSearch && matchesStatus
  })

  // Group by status
  const groupedOffers = STATUS_ORDER.reduce((acc, status) => {
    const offers = filteredOffers.filter(o => o.status === status)
    if (offers.length > 0) {
      acc[status] = offers
    }
    return acc
  }, {} as Record<OfferStatus, ClientOffer[]>)

  // Count by status (unfiltered for badges)
  const statusCounts = clientOffers.reduce((acc, offer) => {
    acc[offer.status] = (acc[offer.status] || 0) + 1
    return acc
  }, {} as Record<OfferStatus, number>)

  const toggleStatus = (status: OfferStatus) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const totalFiltered = filteredOffers.length
  const totalAll = clientOffers.length

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by client name, email, or package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Status
              {statusFilter.length > 0 && statusFilter.length < STATUS_ORDER.length && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {statusFilter.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {STATUS_ORDER.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={statusFilter.includes(status)}
                onCheckedChange={() => toggleStatus(status)}
              >
                <span className="flex-1">{STATUS_LABELS[status]}</span>
                <span className="text-gray-400 text-xs">{statusCounts[status] || 0}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {totalFiltered} of {totalAll} client offers
      </div>

      {/* Timeline content */}
      {totalFiltered === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No offers found</h3>
          <p className="text-gray-500">
            {totalAll === 0
              ? "Start by assigning offers to your clients."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedOffers).map(([status, offers]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {STATUS_LABELS[status as OfferStatus]}
                </h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {offers.length}
                </span>
              </div>
              <div className="grid gap-3">
                {offers.map((offer) => (
                  <ClientOfferCard
                    key={offer.id}
                    id={offer.id}
                    repreneurId={offer.repreneur.id}
                    repreneurName={`${offer.repreneur.first_name} ${offer.repreneur.last_name}`}
                    repreneurEmail={offer.repreneur.email}
                    avatarUrl={offer.repreneur.avatar_url}
                    offer={offer.offer}
                    status={offer.status}
                    offeredAt={offer.offered_at}
                    acceptedAt={offer.accepted_at}
                    expiresAt={offer.expires_at}
                    milestones={offer.milestones}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
