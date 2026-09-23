"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const DEAL_SECTION_ORDER = "Recommended → In Progress → Live Opportunities → Declined."

/** Hover/focus explanation plus the same content on tap/click, dismissible with Escape. */
export function DealOrderInfo({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground" aria-label={label}>
              <Info className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open ? <TooltipContent className="max-w-72 text-left leading-relaxed">{children}</TooltipContent> : null}
      </Tooltip>
      <PopoverContent className="max-w-[calc(100vw-2rem)] text-sm leading-relaxed" aria-label={label}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
