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

// Tier 3 Milestone Configuration
export interface MilestoneConfig {
  key: MilestoneKey
  label: string
  tooltip: string
  stageGroup: 1 | 2 | 3 // Which stage transition this milestone contributes to
}

export const MILESTONES: MilestoneConfig[] = [
  // Stage 1: Explorer → Learner (complete 3)
  {
    key: "investment_thesis",
    label: "Investment thesis validated",
    tooltip: "Sector, size, geography, and deal criteria are clearly documented",
    stageGroup: 1,
  },
  {
    key: "target_profile",
    label: "Target profile approved",
    tooltip: "Re-New has reviewed and approved the acquisition target criteria",
    stageGroup: 1,
  },
  {
    key: "first_intermediary",
    label: "First intermediary intro",
    tooltip: "Candidate has been introduced to at least one deal source",
    stageGroup: 1,
  },
  // Stage 2: Learner → Ready (complete 7 total, 4 more)
  {
    key: "starter_pack",
    label: "Starter Pack completed",
    tooltip: "Finished Re-New's preparation training program",
    stageGroup: 2,
  },
  {
    key: "ldc_validated",
    label: "LdC validated",
    tooltip: "Lettre de Cadrage document completed and reviewed by Re-New",
    stageGroup: 2,
  },
  {
    key: "financing_proof",
    label: "Financing proof",
    tooltip: "Bank letter, investor commitment, or proof of funds obtained",
    stageGroup: 2,
  },
  {
    key: "advisory_team",
    label: "Advisory team engaged",
    tooltip: "Lawyer, accountant, or M&A advisor contracted",
    stageGroup: 2,
  },
  // Stage 3: Ready → Serial Acquirer (complete 10 total, 3 more + persona)
  {
    key: "search_plan",
    label: "Search plan approved",
    tooltip: "Active search plan with timeline reviewed by Re-New",
    stageGroup: 3,
  },
  {
    key: "first_target",
    label: "First target contact",
    tooltip: "Candidate has engaged with a potential acquisition target",
    stageGroup: 3,
  },
  {
    key: "dd_checklist",
    label: "DD checklist ready",
    tooltip: "Due diligence preparation completed, knows what to evaluate",
    stageGroup: 3,
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
}

export const JOURNEY_STAGES: JourneyStageConfig[] = [
  {
    key: "explorer",
    label: "Explorer",
    icon: "Compass",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    minMilestones: 0,
    maxMilestones: 2,
  },
  {
    key: "learner",
    label: "Learner",
    icon: "Map",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    minMilestones: 3,
    maxMilestones: 6,
  },
  {
    key: "ready",
    label: "Ready",
    icon: "Flag",
    color: "text-green-600",
    bgColor: "bg-green-100",
    minMilestones: 7,
    maxMilestones: 9,
  },
  {
    key: "serial_acquirer",
    label: "Serial Acquirer",
    icon: "Trophy",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    minMilestones: 10,
    maxMilestones: 10,
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
