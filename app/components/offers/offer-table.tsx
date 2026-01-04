"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toggleOfferActive } from "@/lib/actions/offers"
import type { Offer } from "@/lib/types/offer"

interface OfferTableProps {
  offers: Offer[]
}

export function OfferTable({ offers }: OfferTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const filtered = offers.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await toggleOfferActive(id, !currentActive)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search offers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => router.push("/offers/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Offer
        </Button>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Hours Included</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  No offers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-gray-900">{offer.name}</span>
                      {offer.description && (
                        <p className="text-sm text-gray-500 truncate max-w-xs">{offer.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{formatPrice(offer.price)}</TableCell>
                  <TableCell className="text-gray-600">{offer.duration_days} days</TableCell>
                  <TableCell className="text-gray-600">
                    {offer.includes_hours ? `${offer.includes_hours}h` : "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        offer.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {offer.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/offers/${offer.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(offer.id, offer.is_active)}>
                          {offer.is_active ? (
                            <>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
