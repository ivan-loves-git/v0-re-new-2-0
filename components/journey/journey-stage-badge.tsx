"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
    <Badge variant="outline" className={`${config.color} gap-1`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { stageConfig } from "@/lib/journey-config"
