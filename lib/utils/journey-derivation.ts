import { JourneyStage, MilestoneKey, Tier3Milestones } from "@/lib/types/repreneur"
import { MILESTONES } from "@/lib/constants/tier-config"

/**
 * All milestone keys in order
 */
export const MILESTONE_KEYS: MilestoneKey[] = [
  "investment_thesis",
  "target_profile",
  "first_intermediary",
  "starter_pack",
  "ldc_validated",
  "financing_proof",
  "advisory_team",
  "search_plan",
  "first_target",
  "dd_checklist",
]

/**
 * Count completed milestones
 */
export function countMilestones(milestones: Partial<Tier3Milestones>): number {
  return MILESTONE_KEYS.filter((key) => milestones[key] === true).length
}

/**
 * Extract milestones from a repreneur object
 */
export function extractMilestones(repreneur: {
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
}): Tier3Milestones {
  return {
    investment_thesis: repreneur.ms_investment_thesis ?? false,
    target_profile: repreneur.ms_target_profile ?? false,
    first_intermediary: repreneur.ms_first_intermediary ?? false,
    starter_pack: repreneur.ms_starter_pack ?? false,
    ldc_validated: repreneur.ms_ldc_validated ?? false,
    financing_proof: repreneur.ms_financing_proof ?? false,
    advisory_team: repreneur.ms_advisory_team ?? false,
    search_plan: repreneur.ms_search_plan ?? false,
    first_target: repreneur.ms_first_target ?? false,
    dd_checklist: repreneur.ms_dd_checklist ?? false,
  }
}

/**
 * Derive journey stage from milestone count and persona
 * Matches the database function compute_journey_stage
 */
export function deriveJourneyStage(
  milestoneCount: number,
  persona: string | null | undefined
): JourneyStage {
  // Serial Acquirer: All 10 milestones + serial acquirer persona
  if (milestoneCount === 10 && persona === "serial_acquirer") {
    return "serial_acquirer"
  }
  // Ready: 7-9 milestones (or 10 without serial persona)
  if (milestoneCount >= 7) {
    return "ready"
  }
  // Learner: 3-6 milestones
  if (milestoneCount >= 3) {
    return "learner"
  }
  // Explorer: 0-2 milestones
  return "explorer"
}

/**
 * Convert milestones to database column format
 */
export function milestonesToDbColumns(milestones: Partial<Tier3Milestones>): Record<string, boolean> {
  return {
    ms_investment_thesis: milestones.investment_thesis ?? false,
    ms_target_profile: milestones.target_profile ?? false,
    ms_first_intermediary: milestones.first_intermediary ?? false,
    ms_starter_pack: milestones.starter_pack ?? false,
    ms_ldc_validated: milestones.ldc_validated ?? false,
    ms_financing_proof: milestones.financing_proof ?? false,
    ms_advisory_team: milestones.advisory_team ?? false,
    ms_search_plan: milestones.search_plan ?? false,
    ms_first_target: milestones.first_target ?? false,
    ms_dd_checklist: milestones.dd_checklist ?? false,
  }
}

/**
 * Get milestones for a specific stage group
 */
export function getMilestonesByStageGroup(stageGroup: 1 | 2 | 3) {
  return MILESTONES.filter((m) => m.stageGroup === stageGroup)
}

/**
 * Get progress towards next stage
 */
export function getStageProgress(milestoneCount: number): {
  currentStage: JourneyStage
  nextStage: JourneyStage | null
  milestonesForNext: number
  progress: number // 0-100
} {
  if (milestoneCount >= 10) {
    return {
      currentStage: "serial_acquirer",
      nextStage: null,
      milestonesForNext: 0,
      progress: 100,
    }
  }
  if (milestoneCount >= 7) {
    return {
      currentStage: "ready",
      nextStage: "serial_acquirer",
      milestonesForNext: 10 - milestoneCount,
      progress: ((milestoneCount - 7) / 3) * 100,
    }
  }
  if (milestoneCount >= 3) {
    return {
      currentStage: "learner",
      nextStage: "ready",
      milestonesForNext: 7 - milestoneCount,
      progress: ((milestoneCount - 3) / 4) * 100,
    }
  }
  return {
    currentStage: "explorer",
    nextStage: "learner",
    milestonesForNext: 3 - milestoneCount,
    progress: (milestoneCount / 3) * 100,
  }
}
