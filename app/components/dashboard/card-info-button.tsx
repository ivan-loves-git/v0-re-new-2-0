"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CardInfoButtonProps {
  info: string
}

export function CardInfoButton({ info }: CardInfoButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-0.5 rounded-full hover:bg-gray-100 transition-colors">
            <Info className="h-3.5 w-3.5 text-gray-900" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">{info}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
