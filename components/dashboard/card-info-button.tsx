"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Support both simple string and rich object format
type InfoContent = string | {
  title: string
  description: string
  why: string
}

interface CardInfoButtonProps {
  info: InfoContent
}

export function CardInfoButton({ info }: CardInfoButtonProps) {
  const isRich = typeof info === "object"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-0.5 rounded-full hover:bg-gray-100 transition-colors">
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {isRich ? (
            <div className="space-y-2">
              <p className="font-medium">{info.title}</p>
              <p className="text-xs">{info.description}</p>
              <p className="text-xs text-muted-foreground">
                <strong>Why it matters:</strong> {info.why}
              </p>
            </div>
          ) : (
            <p className="text-sm">{info}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
