// Types for dual scoring system (WHO + WHEN)

export type Flag = "F1" | "F2" | "F3" | "F4" | "F5"

export interface FlagInfo {
  id: Flag
  label: string
  description: string
}

export const FLAG_DEFINITIONS: Record<Flag, FlagInfo> = {
  F1: {
    id: "F1",
    label: "Ambition/Means Gap",
    description: "High deal size (>5M) with equity still TBD",
  },
  F2: {
    id: "F2",
    label: "Governance Conflict",
    description: "Selected both 'Majority owner' and 'Majority fund'",
  },
  F3: {
    id: "F3",
    label: "Unclear Structure",
    description: "Multiple structures selected or 'Haven't thought about it'",
  },
  F4: {
    id: "F4",
    label: "Underfunded Solo",
    description: "Majority without fund + low equity on 1-3M deal",
  },
  F5: {
    id: "F5",
    label: "Micro LBO Mismatch",
    description: "Deal <1M with majority fund structure",
  },
}

export type RecommendedAction =
  | "deal_flow"
  | "interview_validate_thesis"
  | "interview_validate_execution"
  | "starter_pack"

export interface DualScoreData {
  who: number | null        // 0-100 or null if incomplete
  when: number | null       // 0-100 or null if incomplete
  flags: Flag[]
  recommendation: RecommendedAction
  whoBreakdown?: {
    q05_status: number
    q06_experience: number
    q07_leadership: number
    q08_crisis: number
    q09_investments: number
    q10_impact: number
  }
  whenBreakdown?: {
    fit_financier: number    // 0-40
    clarity: number          // 0-40
    project_status: number   // 0-20
  }
  needsDataCompletion?: boolean
}

export function getRecommendationLabel(rec: RecommendedAction): string {
  switch (rec) {
    case "deal_flow":
      return "Deal Flow"
    case "interview_validate_thesis":
      return "Interview (Validate Thesis)"
    case "interview_validate_execution":
      return "Interview (Validate Execution)"
    case "starter_pack":
      return "Starter Pack"
  }
}

export function getRecommendationColor(rec: RecommendedAction): string {
  switch (rec) {
    case "deal_flow":
      return "bg-green-100 text-green-800 border-green-200"
    case "interview_validate_thesis":
    case "interview_validate_execution":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "starter_pack":
      return "bg-amber-100 text-amber-800 border-amber-200"
  }
}

export function getScoreColor(score: number | null): string {
  if (score === null) return "text-gray-400"
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-blue-600"
  if (score >= 40) return "text-amber-600"
  return "text-red-600"
}

export function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-gray-100"
  if (score >= 80) return "bg-green-500"
  if (score >= 60) return "bg-blue-500"
  if (score >= 40) return "bg-amber-500"
  return "bg-red-500"
}
