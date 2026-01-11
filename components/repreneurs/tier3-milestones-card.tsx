"use client"

import { useState, useOptimistic, useTransition } from "react"
import { Compass, Map, Flag, Trophy, CheckCircle2, Circle } from "lucide-react"
import { toggleMilestone } from "@/lib/actions/repreneurs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { MilestoneKey, JourneyStage } from "@/lib/types/repreneur"
import { MILESTONES, STAGE_GROUPS, getStageConfig } from "@/lib/constants/tier-config"
import { extractMilestones, countMilestones, deriveJourneyStage, getStageProgress } from "@/lib/utils/journey-derivation"

interface Tier3MilestonesCardProps {
  repreneurId: string
  repreneur: {
    ms_investment_thesis?: boolean
    ms_target_profile?: boolean
    ms_first_intermediary?: boolean
    ms_starter_pack?: boolean
    ms_ldc_validated?: boolean
    ms_financing_proof?: boolean
    ms_advisory_team?: boolean
    ms_search_plan?: boolean
    ms_first_target?: boolean
    ms_dd_checklist?: boolean
    tier3_milestone_count?: number
    journey_stage?: JourneyStage
    persona?: string
  }
}

// Icon component for journey stages
function StageIcon({ stage, className }: { stage: JourneyStage; className?: string }) {
  switch (stage) {
    case "explorer":
      return <Compass className={className} />
    case "learner":
      return <Map className={className} />
    case "ready":
      return <Flag className={className} />
    case "serial_acquirer":
      return <Trophy className={className} />
    default:
      return <Compass className={className} />
  }
}

export function Tier3MilestonesCard({ repreneurId, repreneur }: Tier3MilestonesCardProps) {
  const [isPending, startTransition] = useTransition()

  // Extract current milestones
  const currentMilestones = extractMilestones(repreneur)
  const currentCount = countMilestones(currentMilestones)

  // Optimistic state for milestones
  const [optimisticMilestones, setOptimisticMilestones] = useOptimistic(
    currentMilestones,
    (state, update: { key: MilestoneKey; value: boolean }) => ({
      ...state,
      [update.key]: update.value,
    })
  )

  const optimisticCount = countMilestones(optimisticMilestones)
  const derivedStage = deriveJourneyStage(optimisticCount, repreneur.persona)
  const stageConfig = getStageConfig(derivedStage)
  const progress = getStageProgress(optimisticCount)

  async function handleToggle(key: MilestoneKey) {
    const newValue = !optimisticMilestones[key]

    startTransition(async () => {
      setOptimisticMilestones({ key, value: newValue })

      try {
        await toggleMilestone(repreneurId, key, newValue)
      } catch (error) {
        console.error("Failed to toggle milestone:", error)
        toast.error("Failed to update milestone")
      }
    })
  }

  // Group milestones by stage
  const milestonesByGroup = STAGE_GROUPS.map((group) => ({
    ...group,
    milestones: MILESTONES.filter((m) => m.stageGroup === group.group),
    completedCount: MILESTONES.filter(
      (m) => m.stageGroup === group.group && optimisticMilestones[m.key]
    ).length,
  }))

  return (
    <div className="space-y-4">
      {/* Header with Stage Badge and Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={cn("gap-1", stageConfig.bgColor, stageConfig.color, "border-0")}>
            <StageIcon stage={derivedStage} className="h-3 w-3" />
            {stageConfig.label}
          </Badge>
          <span className="text-sm text-gray-500">
            {optimisticCount}/11 milestones
          </span>
        </div>
        {progress.nextStage && (
          <span className="text-xs text-gray-400">
            {progress.milestonesForNext} more for {getStageConfig(progress.nextStage).label}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <Progress value={(optimisticCount / 11) * 100} className="h-2" />

      {/* Milestones in 2-column layout */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-4">
          {/* Left column: Groups 1 & 2 */}
          <div className="space-y-3">
            {milestonesByGroup.slice(0, 2).map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {group.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({group.completedCount}/{group.milestones.length})
                  </span>
                </div>
                <div className="space-y-0.5 pl-2 border-l-2 border-gray-100">
                  {group.milestones.map((milestone) => {
                    const isCompleted = optimisticMilestones[milestone.key]
                    return (
                      <Tooltip key={milestone.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleToggle(milestone.key)}
                            disabled={isPending}
                            className={cn(
                              "flex items-center gap-2 py-1 px-2 rounded text-left transition-all w-full",
                              "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500",
                              isCompleted && "bg-green-50",
                              isPending && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                            )}
                            <span className={cn("text-sm", isCompleted ? "text-green-700" : "text-gray-600")}>
                              {milestone.label}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{milestone.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right column: Group 3 */}
          <div className="space-y-3">
            {milestonesByGroup.slice(2).map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {group.title}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({group.completedCount}/{group.milestones.length})
                  </span>
                </div>
                <div className="space-y-0.5 pl-2 border-l-2 border-gray-100">
                  {group.milestones.map((milestone) => {
                    const isCompleted = optimisticMilestones[milestone.key]
                    return (
                      <Tooltip key={milestone.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleToggle(milestone.key)}
                            disabled={isPending}
                            className={cn(
                              "flex items-center gap-2 py-1 px-2 rounded text-left transition-all w-full",
                              "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500",
                              isCompleted && "bg-green-50",
                              isPending && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                            )}
                            <span className={cn("text-sm", isCompleted ? "text-green-700" : "text-gray-600")}>
                              {milestone.label}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{milestone.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
