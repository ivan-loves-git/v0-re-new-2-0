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
  completed: "Completed",
  declined: "Declined",
}

const STATUS_ORDER: OfferStatus[] = ["accepted", "offered", "completed", "declined"]

export function OffersTimeline({ clientOffers }: OffersTimelineProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<OfferStatus[]>(["accepted", "offered"])

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
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-3" aria-label="Offer filters">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client name, email, or package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-background pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 bg-background">
              <Filter className="size-4 mr-2" />
              Status
              {statusFilter.length > 0 && statusFilter.length < STATUS_ORDER.length && (
                <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {statusFilter.length}
                </span>
              )}
              <ChevronDown className="size-4 ml-2" />
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
                <span className="text-xs tabular-nums text-muted-foreground">{statusCounts[status] || 0}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground" role="status" aria-live="polite">
        <span className="font-medium text-foreground">{totalFiltered}</span> of {totalAll} client offers
      </p>
      </section>

      {/* Timeline content */}
      {totalFiltered === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
          <Package className="mx-auto mb-3 size-9 text-muted-foreground/40" />
          <h3 className="mb-1 text-sm font-semibold text-foreground">No offers found</h3>
          <p className="text-sm text-muted-foreground">
            {totalAll === 0
              ? "Start by assigning offers to your clients."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedOffers).map(([status, offers]) => (
            <div key={status}>
              <div className="mb-2 flex items-center gap-2 border-b pb-2">
                <h3 className="wave-micro-label text-foreground">
                  {STATUS_LABELS[status as OfferStatus]}
                </h3>
                <span className="rounded bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {offers.length}
                </span>
              </div>
              <div className="grid gap-2">
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
