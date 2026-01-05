"use client"

import { Info } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-0.5 rounded-full hover:bg-gray-100 transition-colors">
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs p-3">
        {isRich ? (
          <div className="space-y-2">
            <p className="font-medium text-sm">{info.title}</p>
            <p className="text-xs text-muted-foreground">{info.description}</p>
            <p className="text-xs text-muted-foreground">
              <strong>Why it matters:</strong> {info.why}
            </p>
          </div>
        ) : (
          <p className="text-sm">{info}</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
