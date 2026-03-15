import { JourneyStage, MilestoneKey, Tier3Milestones } from "@/lib/types/repreneur"
import { MILESTONES, StageGroupNumber } from "@/lib/constants/tier-config"

/**
 * All milestone keys in order (V2: 17 milestones)
 */
export const MILESTONE_KEYS: MilestoneKey[] = [
  // Group 1: Explorer → Learner
  "decision_to_pursue",
  "availability_confirmed",
  // Group 2: Learner → Ready
  "target_profile_sheet",
  "pitch_plan",
  "equity_range",
  "deal_breakers",
  "leadership_assessment_passed",
  "advisory_team_identified",
  // Group 3: Ready → Execution
  "intermediary_meeting",
  "seller_meeting",
  "loi_issued",
  "due_diligence",
  "negotiation",
  "financing_validated",
  "closing",
  // Group 4: Execution → Post-acquisition
  "plan_100_days",
  "plan_3_years",
]

/**
 * Milestone keys grouped by stage transition
 */
export const MILESTONE_GROUPS: Record<StageGroupNumber, MilestoneKey[]> = {
  1: ["decision_to_pursue", "availability_confirmed"],
  2: ["target_profile_sheet", "pitch_plan", "equity_range", "deal_breakers", "leadership_assessment_passed", "advisory_team_identified"],
  3: ["intermediary_meeting", "seller_meeting", "loi_issued", "due_diligence", "negotiation", "financing_validated", "closing"],
  4: ["plan_100_days", "plan_3_years"],
}

/**
 * Count completed milestones
 */
export function countMilestones(milestones: Partial<Tier3Milestones>): number {
  return MILESTONE_KEYS.filter((key) => milestones[key] === true).length
}

/**
 * Check if all milestones in a group are complete
 */
export function isGroupComplete(milestones: Partial<Tier3Milestones>, group: StageGroupNumber): boolean {
  return MILESTONE_GROUPS[group].every((key) => milestones[key] === true)
}

/**
 * Check if at least one milestone in a group is complete
 */
export function hasAnyInGroup(milestones: Partial<Tier3Milestones>, group: StageGroupNumber): boolean {
  return MILESTONE_GROUPS[group].some((key) => milestones[key] === true)
}

/**
 * Extract milestones from a repreneur object (V2: 17 milestones)
 */
export function extractMilestones(repreneur: {
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
}): Tier3Milestones {
  return {
    decision_to_pursue: repreneur.ms_decision_to_pursue ?? false,
    availability_confirmed: repreneur.ms_availability_confirmed ?? false,
    target_profile_sheet: repreneur.ms_target_profile_sheet ?? false,
    pitch_plan: repreneur.ms_pitch_plan ?? false,
    equity_range: repreneur.ms_equity_range ?? false,
    deal_breakers: repreneur.ms_deal_breakers ?? false,
    leadership_assessment_passed: repreneur.ms_leadership_assessment_passed ?? false,
    advisory_team_identified: repreneur.ms_advisory_team_identified ?? false,
    intermediary_meeting: repreneur.ms_intermediary_meeting ?? false,
    seller_meeting: repreneur.ms_seller_meeting ?? false,
    loi_issued: repreneur.ms_loi_issued ?? false,
    due_diligence: repreneur.ms_due_diligence ?? false,
    negotiation: repreneur.ms_negotiation ?? false,
    financing_validated: repreneur.ms_financing_validated ?? false,
    closing: repreneur.ms_closing ?? false,
    plan_100_days: repreneur.ms_plan_100_days ?? false,
    plan_3_years: repreneur.ms_plan_3_years ?? false,
  }
}

/**
 * Derive journey stage from milestones (V2: group-based)
 *
 * Explorer → Learner: ALL Group 1 milestones complete
 * Learner → Ready: ALL Group 2 milestones complete
 * Ready → Execution: ANY Group 3 milestone started (per Bertrand: execution is a process)
 * Execution → Post-acquisition: ALL Group 3 milestones complete + ALL Group 4 complete
 */
export function deriveJourneyStage(
  milestones: Partial<Tier3Milestones>,
): JourneyStage {
  const g1 = isGroupComplete(milestones, 1)
  const g2 = g1 && isGroupComplete(milestones, 2)
  // Execution: ready + at least one execution milestone started
  const g3Started = g2 && hasAnyInGroup(milestones, 3)
  const g3Done = g2 && isGroupComplete(milestones, 3)
  const g4 = g3Done && isGroupComplete(milestones, 4)

  if (g4) return "post_acquisition"
  if (g3Started) return "execution"
  if (g2) return "ready"
  if (g1) return "learner"
  return "explorer"
}

/**
 * @deprecated Use deriveJourneyStage(milestones) instead
 * Kept for backwards compat with code that passes count + persona
 */
export function deriveJourneyStageFromCount(
  milestoneCount: number,
  _persona?: string | null | undefined
): JourneyStage {
  if (milestoneCount >= 17) return "post_acquisition"
  if (milestoneCount >= 15) return "execution"
  if (milestoneCount >= 8) return "ready"
  if (milestoneCount >= 2) return "learner"
  return "explorer"
}

/**
 * Convert milestones to database column format
 */
export function milestonesToDbColumns(milestones: Partial<Tier3Milestones>): Record<string, boolean> {
  return {
    ms_decision_to_pursue: milestones.decision_to_pursue ?? false,
    ms_availability_confirmed: milestones.availability_confirmed ?? false,
    ms_target_profile_sheet: milestones.target_profile_sheet ?? false,
    ms_pitch_plan: milestones.pitch_plan ?? false,
    ms_equity_range: milestones.equity_range ?? false,
    ms_deal_breakers: milestones.deal_breakers ?? false,
    ms_leadership_assessment_passed: milestones.leadership_assessment_passed ?? false,
    ms_advisory_team_identified: milestones.advisory_team_identified ?? false,
    ms_intermediary_meeting: milestones.intermediary_meeting ?? false,
    ms_seller_meeting: milestones.seller_meeting ?? false,
    ms_loi_issued: milestones.loi_issued ?? false,
    ms_due_diligence: milestones.due_diligence ?? false,
    ms_negotiation: milestones.negotiation ?? false,
    ms_financing_validated: milestones.financing_validated ?? false,
    ms_closing: milestones.closing ?? false,
    ms_plan_100_days: milestones.plan_100_days ?? false,
    ms_plan_3_years: milestones.plan_3_years ?? false,
  }
}

/**
 * Get milestones for a specific stage group
 */
export function getMilestonesByStageGroup(stageGroup: StageGroupNumber) {
  return MILESTONES.filter((m) => m.stageGroup === stageGroup)
}

/**
 * Get progress towards next stage (V2: group-based)
 */
export function getStageProgress(milestones: Partial<Tier3Milestones>): {
  currentStage: JourneyStage
  nextStage: JourneyStage | null
  milestonesForNext: number
  progress: number // 0-100
} {
  const stage = deriveJourneyStage(milestones)

  if (stage === "post_acquisition") {
    return { currentStage: "post_acquisition", nextStage: null, milestonesForNext: 0, progress: 100 }
  }

  // Determine which group to show progress for
  const groupMap: Record<JourneyStage, { group: StageGroupNumber; nextStage: JourneyStage }> = {
    explorer: { group: 1, nextStage: "learner" },
    learner: { group: 2, nextStage: "ready" },
    ready: { group: 3, nextStage: "execution" },
    execution: { group: 4, nextStage: "post_acquisition" },
    post_acquisition: { group: 4, nextStage: "post_acquisition" }, // never reached
  }

  const { group, nextStage } = groupMap[stage]
  const groupKeys = MILESTONE_GROUPS[group]
  const completed = groupKeys.filter((key) => milestones[key] === true).length
  const total = groupKeys.length
  const remaining = total - completed

  return {
    currentStage: stage,
    nextStage,
    milestonesForNext: remaining,
    progress: total > 0 ? (completed / total) * 100 : 0,
  }
}
