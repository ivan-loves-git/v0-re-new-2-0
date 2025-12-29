"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Compass, BookOpen, FileCheck, Trophy } from "lucide-react"
import type { JourneyStage } from "@/lib/types/repreneur"

const stageConfig: Record<JourneyStage, { label: string; color: string; icon: React.ElementType; description: string }> = {
  explorer: {
    label: "Explorer",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Compass,
    description: "Curious about repreneurship, exploring opportunities",
  },
  learner: {
    label: "Learner",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: BookOpen,
    description: "Building skills and knowledge for acquisition",
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: FileCheck,
    description: "Prepared to write LOIs and make offers",
  },
  serial_acquirer: {
    label: "Serial Acquirer",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Trophy,
    description: "Experienced buyer with multiple acquisitions",
  },
}

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

export { stageConfig }
