"use client"

import { cn } from "@/lib/utils"
import type { OfferStatus } from "@/lib/types/offer"

interface OfferStatusBadgeProps {
  status: OfferStatus
}

const statusConfig: Record<OfferStatus, { label: string; className: string }> = {
  offered: {
    label: "Offered",
    className: "bg-blue-100 text-blue-800",
  },
  accepted: {
    label: "Accepted",
    className: "bg-yellow-100 text-yellow-800",
  },
  active: {
    label: "Active",
    className: "bg-green-100 text-green-800",
  },
  completed: {
    label: "Completed",
    className: "bg-gray-100 text-gray-800",
  },
  expired: {
    label: "Expired",
    className: "bg-red-100 text-red-800",
  },
}

export function OfferStatusBadge({ status }: OfferStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}
