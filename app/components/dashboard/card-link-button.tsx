"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CardLinkButtonProps {
  href: string
  tooltip?: string
}

export function CardLinkButton({ href, tooltip = "View all" }: CardLinkButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-gray-900" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
