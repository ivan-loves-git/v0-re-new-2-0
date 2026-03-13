import { Tier2DimensionKey, MilestoneKey, JourneyStage } from "@/lib/types/repreneur"

// Tier 2 Competency Dimension Configuration
export interface Tier2DimensionConfig {
  key: Tier2DimensionKey
  label: string
  description: string
  weight: number
}

export const TIER2_DIMENSIONS: Tier2DimensionConfig[] = [
  {
    key: "leadership",
    label: "Leadership",
    description: "Can they run a company? Make hard decisions? Manage a team?",
    weight: 1.0,
  },
  {
    key: "financial_acumen",
    label: "Financial Acumen",
    description: "Do they understand deal structures, valuation, due diligence?",
    weight: 1.0,
  },
  {
    key: "communication",
    label: "Communication",
    description: "Can they negotiate with sellers? Present to banks and intermediaries?",
    weight: 0.8,
  },
  {
    key: "clarity_of_vision",
    label: "Clarity of Vision",
    description: "Do they know what they're looking for? Clear target profile?",
    weight: 1.2,
  },
  {
    key: "coachability",
    label: "Coachability",
    description: "Are they open to guidance? Do they follow advice?",
    weight: 0.8,
  },
  {
    key: "commitment",
    label: "Commitment",
    description: "Is this a full-time pursuit? Do they have support (family, advisors)?",
    weight: 1.2,
  },
]

// Tier 2 pass threshold
export const TIER2_PASS_THRESHOLD = 4.0

// Stage Group Configuration (for grouping milestones in UI)
export type StageGroupNumber = 1 | 2 | 3 | 4

export interface StageGroupConfig {
  group: StageGroupNumber
  title: string
  description: string
  fromStage: JourneyStage
  toStage: JourneyStage
}

export const STAGE_GROUPS: StageGroupConfig[] = [
  {
    group: 1,
    title: "Explorer → Learner",
    description: "Commit to the repreneurship project",
    fromStage: "explorer",
    toStage: "learner",
  },
  {
    group: 2,
    title: "Learner → Ready",
    description: "Structure your project and prove readiness",
    fromStage: "learner",
    toStage: "ready",
  },
  {
    group: 3,
    title: "Ready → Execution",
    description: "Find, evaluate, and close a deal",
    fromStage: "ready",
    toStage: "execution",
  },
  {
    group: 4,
    title: "Execution → Post-acquisition",
    description: "Take ownership and create value",
    fromStage: "execution",
    toStage: "post_acquisition",
  },
]

// Tier 3 Milestone Configuration
export interface MilestoneConfig {
  key: MilestoneKey
  label: string
  tooltip: string
  stageGroup: StageGroupNumber
}

export const MILESTONES: MilestoneConfig[] = [
  // Group 1: Explorer → Learner (2 milestones)
  {
    key: "decision_to_pursue",
    label: "Repreneurship as main project",
    tooltip: "Decided that SME acquisition is their primary professional project",
    stageGroup: 1,
  },
  {
    key: "availability_confirmed",
    label: "Availability confirmed",
    tooltip: "Can dedicate the necessary time to explore the project",
    stageGroup: 1,
  },
  // Group 2: Learner → Ready (7 milestones)
  {
    key: "target_profile_sheet",
    label: "Target profile defined",
    tooltip: "Geography, sectors, metrics, and business model criteria documented",
    stageGroup: 2,
  },
  {
    key: "pitch_plan",
    label: "Pitch & value creation plan",
    tooltip: "Why me + value creation plan clearly articulated",
    stageGroup: 2,
  },
  {
    key: "equity_range",
    label: "Equity range confirmed",
    tooltip: "Personal equity contribution range and source identified",
    stageGroup: 2,
  },
  {
    key: "deal_breakers",
    label: "Deal breakers identified",
    tooltip: "Key risks identified: client dependency, minimum margins, litigation, working capital",
    stageGroup: 2,
  },
  {
    key: "advisory_team_structured",
    label: "Advisory team structured",
    tooltip: "Accountant and lawyer engaged for the project",
    stageGroup: 2,
  },
  {
    key: "leadership_assessment_passed",
    label: "Leadership assessment passed",
    tooltip: "Completed leadership potential assessment with positive result",
    stageGroup: 2,
  },
  {
    key: "advisory_team_identified",
    label: "Advisory team identified",
    tooltip: "Lawyers and accountants identified and contacted",
    stageGroup: 2,
  },
  // Group 3: Ready → Execution (7 milestones)
  {
    key: "intermediary_meeting",
    label: "Intermediary meeting",
    tooltip: "First meeting with a deal intermediary held",
    stageGroup: 3,
  },
  {
    key: "seller_meeting",
    label: "Seller meeting",
    tooltip: "First meeting with a company seller held",
    stageGroup: 3,
  },
  {
    key: "loi_issued",
    label: "LOI issued",
    tooltip: "Letter of Intent submitted to the seller",
    stageGroup: 3,
  },
  {
    key: "due_diligence",
    label: "Due diligence",
    tooltip: "Due diligence process initiated",
    stageGroup: 3,
  },
  {
    key: "negotiation",
    label: "Negotiation",
    tooltip: "Active negotiation on deal terms",
    stageGroup: 3,
  },
  {
    key: "financing_validated",
    label: "Financing validated",
    tooltip: "Bank contacts established and/or first validation obtained",
    stageGroup: 3,
  },
  {
    key: "closing",
    label: "Closing",
    tooltip: "Deal successfully closed",
    stageGroup: 3,
  },
  // Group 4: Execution → Post-acquisition (2 milestones)
  {
    key: "plan_100_days",
    label: "100-day plan delivered",
    tooltip: "Post-acquisition 100-day integration plan delivered",
    stageGroup: 4,
  },
  {
    key: "plan_3_years",
    label: "3-year value creation plan",
    tooltip: "Long-term value creation plan defined and being executed",
    stageGroup: 4,
  },
]

// Journey Stage Configuration
export interface JourneyStageConfig {
  key: JourneyStage
  label: string
  icon: string // Lucide icon name
  color: string // Tailwind color class
  bgColor: string // Background color class
  minMilestones: number
  maxMilestones: number
  stageGroup: StageGroupNumber | null // Which milestone group unlocks this stage (null for Explorer)
}

export const JOURNEY_STAGES: JourneyStageConfig[] = [
  {
    key: "explorer",
    label: "Explorer",
    icon: "Compass",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    minMilestones: 0,
    maxMilestones: 1,
    stageGroup: null,
  },
  {
    key: "learner",
    label: "Learner",
    icon: "Map",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    minMilestones: 2,
    maxMilestones: 8,
    stageGroup: 1,
  },
  {
    key: "ready",
    label: "Ready",
    icon: "Flag",
    color: "text-green-600",
    bgColor: "bg-green-100",
    minMilestones: 9,
    maxMilestones: 15,
    stageGroup: 2,
  },
  {
    key: "execution",
    label: "Execution",
    icon: "Rocket",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    minMilestones: 16,
    maxMilestones: 17,
    stageGroup: 3,
  },
  {
    key: "post_acquisition",
    label: "Post-acquisition",
    icon: "Crown",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    minMilestones: 18,
    maxMilestones: 18,
    stageGroup: 4,
  },
]

// Helper to get stage config by key
export function getStageConfig(stage: JourneyStage): JourneyStageConfig {
  return JOURNEY_STAGES.find((s) => s.key === stage) || JOURNEY_STAGES[0]
}

// Helper to get milestone config by key
export function getMilestoneConfig(key: MilestoneKey): MilestoneConfig | undefined {
  return MILESTONES.find((m) => m.key === key)
}

// Helper to get dimension config by key
export function getDimensionConfig(key: Tier2DimensionKey): Tier2DimensionConfig | undefined {
  return TIER2_DIMENSIONS.find((d) => d.key === key)
}
