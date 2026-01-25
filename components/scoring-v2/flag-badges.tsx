"use client"

import { AlertTriangle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Flag, FLAG_DEFINITIONS } from "./types"

interface FlagBadgesProps {
  flags: Flag[]
  compact?: boolean
}

export function FlagBadges({ flags, compact = false }: FlagBadgesProps) {
  if (flags.length === 0) return null

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-md text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{flags.length} flag{flags.length > 1 ? "s" : ""}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium text-red-600">Flags override recommendation</p>
              {flags.map((flag) => (
                <div key={flag} className="text-sm">
                  <span className="font-medium">{flag}:</span>{" "}
                  {FLAG_DEFINITIONS[flag].description}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          {flags.length} Warning Flag{flags.length > 1 ? "s" : ""} (overrides recommendation)
        </span>
      </div>
      <div className="space-y-1">
        {flags.map((flag) => (
          <div
            key={flag}
            className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md"
          >
            <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
              {flag}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {FLAG_DEFINITIONS[flag].label}
              </p>
              <p className="text-xs text-red-600">
                {FLAG_DEFINITIONS[flag].description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
