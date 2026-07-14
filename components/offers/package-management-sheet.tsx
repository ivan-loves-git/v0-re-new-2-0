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
          <Settings className="size-4 mr-2" />
          Manage Packages
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Offer Packages
          </SheetTitle>
          <SheetDescription>
            Manage consulting packages that can be assigned to clients.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Create new button */}
          <Button onClick={handleCreate} className="w-full">
            <Plus className="size-4 mr-2" />
            Create New Package
          </Button>

          {/* Active packages */}
          {activePackages.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Active packages</h4>
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
              <h4 className="text-sm font-medium text-muted-foreground">Inactive packages</h4>
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
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 size-10 text-muted-foreground/40" />
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
    <div className={`rounded-md border p-3 ${pkg.is_active ? "bg-card" : "bg-muted/30"}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${pkg.is_active ? "text-foreground" : "text-muted-foreground"}`}>
              {pkg.name}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              pkg.is_active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}>
              {pkg.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatPrice(pkg.price)} · {pkg.duration_days} days
            {pkg.includes_hours && ` · ${pkg.includes_hours}h`}
          </div>
          {pkg.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{pkg.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={`Edit ${pkg.name}`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            disabled={isToggling}
            aria-label={`${pkg.is_active ? "Deactivate" : "Activate"} ${pkg.name}`}
          >
            {pkg.is_active ? (
              <PowerOff className="size-4 text-muted-foreground" />
            ) : (
              <Power className="size-4 text-green-500" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
