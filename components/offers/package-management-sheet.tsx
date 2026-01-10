"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Package, Plus, Pencil, Power, PowerOff, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toggleOfferActive } from "@/lib/actions/offers"
import type { Offer } from "@/lib/types/offer"

interface PackageManagementSheetProps {
  packages: Offer[]
}

export function PackageManagementSheet({ packages }: PackageManagementSheetProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price)
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id)
    try {
      await toggleOfferActive(id, !currentActive)
    } finally {
      setTogglingId(null)
    }
  }

  const handleEdit = (id: string) => {
    setIsOpen(false)
    router.push(`/offers/${id}/edit`)
  }

  const handleCreate = () => {
    setIsOpen(false)
    router.push("/offers/new")
  }

  const activePackages = packages.filter(p => p.is_active)
  const inactivePackages = packages.filter(p => !p.is_active)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Manage Packages
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Offer Packages
          </SheetTitle>
          <SheetDescription>
            Manage consulting packages that can be assigned to clients.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Create new button */}
          <Button onClick={handleCreate} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create New Package
          </Button>

          {/* Active packages */}
          {activePackages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Active Packages</h4>
              <div className="space-y-2">
                {activePackages.map((pkg) => (
                  <PackageItem
                    key={pkg.id}
                    package={pkg}
                    onEdit={() => handleEdit(pkg.id)}
                    onToggle={() => handleToggleActive(pkg.id, pkg.is_active)}
                    isToggling={togglingId === pkg.id}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive packages */}
          {inactivePackages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Inactive Packages</h4>
              <div className="space-y-2">
                {inactivePackages.map((pkg) => (
                  <PackageItem
                    key={pkg.id}
                    package={pkg}
                    onEdit={() => handleEdit(pkg.id)}
                    onToggle={() => handleToggleActive(pkg.id, pkg.is_active)}
                    isToggling={togglingId === pkg.id}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>
            </div>
          )}

          {packages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No packages created yet.</p>
              <p className="text-sm">Create your first package to start assigning offers.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface PackageItemProps {
  package: Offer
  onEdit: () => void
  onToggle: () => void
  isToggling: boolean
  formatPrice: (price: number) => string
}

function PackageItem({ package: pkg, onEdit, onToggle, isToggling, formatPrice }: PackageItemProps) {
  return (
    <div className={`p-3 rounded-lg border ${pkg.is_active ? "bg-white" : "bg-gray-50"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${pkg.is_active ? "text-gray-900" : "text-gray-500"}`}>
              {pkg.name}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              pkg.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}>
              {pkg.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            {formatPrice(pkg.price)} · {pkg.duration_days} days
            {pkg.includes_hours && ` · ${pkg.includes_hours}h`}
          </div>
          {pkg.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{pkg.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            disabled={isToggling}
          >
            {pkg.is_active ? (
              <PowerOff className="h-4 w-4 text-gray-400" />
            ) : (
              <Power className="h-4 w-4 text-green-500" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
