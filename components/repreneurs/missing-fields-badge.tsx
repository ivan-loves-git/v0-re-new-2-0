"use client"

import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getMissingFields, type Repreneur } from "@/lib/types/repreneur"

interface MissingFieldsBadgeProps {
  repreneur: Partial<Repreneur>
  variant?: "full" | "icon-only"
}

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
}

export function MissingFieldsBadge({ repreneur, variant = "full" }: MissingFieldsBadgeProps) {
  const missingFields = getMissingFields(repreneur)

  if (missingFields.length === 0) {
    return null
  }

  const missingLabels = missingFields.map((f) => FIELD_LABELS[f] || f).join(", ")

  if (variant === "icon-only") {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-sm">Missing: {missingLabels}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
      <AlertTriangle className="h-3 w-3" />
      Missing: {missingLabels}
    </Badge>
  )
}
