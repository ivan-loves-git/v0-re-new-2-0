"use client"

import { useOptimistic, useTransition, useRef, useCallback } from "react"
import { Compass, Map, Flag, Rocket, Crown, CheckCircle2, Circle, LucideIcon } from "lucide-react"
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
import { MilestoneKey, JourneyStage, Tier3Milestones } from "@/lib/types/repreneur"
import { MILESTONES, STAGE_GROUPS, getStageConfig, MilestoneConfig, StageGroupConfig } from "@/lib/constants/tier-config"
import { extractMilestones, countMilestones, deriveJourneyStage, getStageProgress } from "@/lib/utils/journey-derivation"

interface Tier3MilestonesCardProps {
  repreneurId: string
  repreneur: {
    // V2 milestones (17)
    ms_decision_to_pursue?: boolean
    ms_availability_confirmed?: boolean
    ms_target_profile_sheet?: boolean
    ms_pitch_plan?: boolean
    ms_equity_range?: boolean
    ms_deal_breakers?: boolean
    ms_leadership_assessment_passed?: boolean
    ms_advisory_team_identified?: boolean
    ms_intermediary_meeting?: boolean
    ms_seller_meeting?: boolean
    ms_loi_issued?: boolean
    ms_due_diligence?: boolean
    ms_negotiation?: boolean
    ms_financing_validated?: boolean
    ms_closing?: boolean
    ms_plan_100_days?: boolean
    ms_plan_3_years?: boolean
    // Legacy milestones (still in DB)
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
    ms_first_acquisition?: boolean
    tier3_milestone_count?: number
    journey_stage?: JourneyStage
    persona?: string
  }
}

// Stage icons lookup (simplified from switch statement)
const STAGE_ICONS: Record<JourneyStage, LucideIcon> = {
  explorer: Compass,
  learner: Map,
  ready: Flag,
  execution: Rocket,
  post_acquisition: Crown,
}

const STAGE_TONES: Record<JourneyStage, string> = {
  explorer: "border-border bg-muted text-muted-foreground",
  learner: "border-primary/25 bg-primary/5 text-primary",
  ready: "border-success/20 bg-success/5 text-success",
  execution: "border-info/20 bg-info/5 text-info",
  post_acquisition: "border-warning/25 bg-warning/5 text-warning",
}

function StageIcon({ stage, className }: { stage: JourneyStage; className?: string }) {
  const Icon = STAGE_ICONS[stage] || Compass
  return <Icon className={className} />
}

// Extracted MilestoneGroup component (eliminates duplication)
interface MilestoneGroupProps {
  group: StageGroupConfig & { milestones: MilestoneConfig[]; completedCount: number }
  optimisticMilestones: Tier3Milestones
  onToggle: (key: MilestoneKey) => void
  isPending: boolean
}

function MilestoneGroup({ group, optimisticMilestones, onToggle, isPending }: MilestoneGroupProps) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h3 className="wave-eyebrow">
          {group.title}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          ({group.completedCount}/{group.milestones.length})
        </span>
      </div>
      <div className="space-y-0.5">
        {group.milestones.map((milestone) => {
          const isCompleted = optimisticMilestones[milestone.key]
          return (
            <Tooltip key={milestone.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggle(milestone.key)}
                  disabled={isPending}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors",
                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCompleted && "bg-success/5",
                    isPending && "cursor-not-allowed opacity-50"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-3.5 flex-shrink-0 text-success" />
                  ) : (
                    <Circle className="size-3.5 flex-shrink-0 text-muted-foreground/45" />
                  )}
                  <span className={cn("text-sm", isCompleted ? "font-medium text-success" : "text-foreground")}>
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
    </section>
  )
}

export function Tier3MilestonesCard({ repreneurId, repreneur }: Tier3MilestonesCardProps) {
  const [isPending, startTransition] = useTransition()

  // Extract current milestones
  const currentMilestones = extractMilestones(repreneur)

  // Optimistic state for milestones
  const [optimisticMilestones, setOptimisticMilestones] = useOptimistic(
    currentMilestones,
    (state, update: { key: MilestoneKey; value: boolean }) => ({
      ...state,
      [update.key]: update.value,
    })
  )

  // Debounce refs for batching rapid toggles
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const pendingToggles = useRef<Partial<Record<MilestoneKey, boolean>>>({})

  const optimisticCount = countMilestones(optimisticMilestones)
  const derivedStage = deriveJourneyStage(optimisticMilestones)
  const stageConfig = getStageConfig(derivedStage)
  const progress = getStageProgress(optimisticMilestones)

  // Debounced save for rapid toggles
  const debouncedSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      const toggles = { ...pendingToggles.current }
      pendingToggles.current = {}

      // Save each toggle (could be optimized to batch if needed)
      for (const [key, value] of Object.entries(toggles)) {
        try {
          await toggleMilestone(repreneurId, key as MilestoneKey, value)
        } catch (error) {
          console.error("Failed to toggle milestone:", error)
          toast.error("Failed to update milestone")
        }
      }
    }, 400) // 400ms debounce
  }, [repreneurId])

  function handleToggle(key: MilestoneKey) {
    const newValue = !optimisticMilestones[key]

    // Immediate optimistic update
    startTransition(() => {
      setOptimisticMilestones({ key, value: newValue })
    })

    // Accumulate and debounce
    pendingToggles.current[key] = newValue
    debouncedSave()
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", STAGE_TONES[derivedStage])}>
            <StageIcon stage={derivedStage} className="size-3" />
            {stageConfig.label}
          </Badge>
          <span className="text-sm tabular-nums text-muted-foreground">
            {optimisticCount}/{MILESTONES.length} milestones
          </span>
        </div>
        {progress.nextStage && (
          <span className="text-xs text-muted-foreground">
            {progress.milestonesForNext} more for {getStageConfig(progress.nextStage).label}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <Progress value={(optimisticCount / MILESTONES.length) * 100} className="h-2" />

      {/* Milestones in 2-column layout */}
      <TooltipProvider>
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Left column: Groups 1 & 2 */}
          <div className="space-y-3">
            {milestonesByGroup.slice(0, 2).map((group) => (
              <MilestoneGroup
                key={group.group}
                group={group}
                optimisticMilestones={optimisticMilestones}
                onToggle={handleToggle}
                isPending={isPending}
              />
            ))}
          </div>

          {/* Right column: Groups 3 & 4 */}
          <div className="space-y-3">
            {milestonesByGroup.slice(2).map((group) => (
              <MilestoneGroup
                key={group.group}
                group={group}
                optimisticMilestones={optimisticMilestones}
                onToggle={handleToggle}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
