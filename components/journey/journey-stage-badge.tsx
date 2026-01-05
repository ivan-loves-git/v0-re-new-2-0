"use client"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { stageConfig } from "@/lib/journey-config"
import type { JourneyStage } from "@/lib/types/repreneur"

interface JourneyStageBadgeProps {
  stage: JourneyStage
  showIcon?: boolean
  showTooltip?: boolean
}

export function JourneyStageBadge({ stage, showIcon = true, showTooltip = true }: JourneyStageBadgeProps) {
  const config = stageConfig[stage]
  const Icon = config.icon

  const badge = (
    <Badge variant="outline" className={`${config.color} gap-1 cursor-pointer`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent className="p-2 text-sm w-auto max-w-xs">
        <p>{config.description}</p>
      </PopoverContent>
    </Popover>
  )
}

export { stageConfig } from "@/lib/journey-config"
