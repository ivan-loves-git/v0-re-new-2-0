/**
 * WHO/WHEN Dual Scoring System - Type Definitions
 *
 * Based on questionnaire-spec-v2.md
 * WHO: Profile quality (Q05-Q10) - 0 to 100
 * WHEN: Project maturity (Q11-Q16) - 0 to 100
 */

// ========================================
// WHO Question Answer Types (Q05-Q10)
// ========================================

/** Q05: Current professional status */
export type Q05Status = 'entrepreneur' | 'freelance' | 'employee' | 'transition' | 'other'

/** Q06: Years of professional experience */
export type Q06Experience = 'more_than_20' | '10_to_20' | 'less_than_10'

/** Q07: Leadership/management experience */
export type Q07Leadership = 'general_management' | 'mgmt_over_10' | 'mgmt_under_10' | 'none'

/** Q08: Crisis management experience */
export type Q08Crisis = 'multiple' | 'once' | 'none'

/** Q09: Investment decision involvement */
export type Q09Investment = 'both' | 'personal' | 'professional' | 'none'

/** Q10: Personal impact of professional decisions */
export type Q10Impact = 'financial' | 'trajectory' | 'limited' | 'none'

// ========================================
// WHEN Question Answer Types (Q11-Q16)
// ========================================

/** Q11 (v3): SME acquisition priority — added 2026-04-23 */
export type Q11PriorityChoice = 'preferred' | 'one_among_others'

/** Q11 (legacy numbering): Project status (multi-select, highest counts) */
export type Q11ProjectStatus = 'discovery' | 'exploratory' | 'framed' | 'searching' | 'loi'

/** Q14: Target deal size (multi-select) */
export type Q14DealSize = '1-3M' | '3-5M' | '>5M'

/** Q15: Capital structure (multi-select) */
export type Q15Structure = 'majority_without_fund' | 'majority_with_minority' | 'manager_with_majority' | 'havent_thought'

/** Q16: Personal equity contribution (single select) */
export type Q16Equity = 'tbd' | '151-250' | '251-350' | '351-450' | '>450'

// ========================================
// Answer Containers
// ========================================

/** All answers for WHO score calculation (Q05-Q10) */
export interface WhoAnswers {
  q05: Q05Status
  q06: Q06Experience
  q07: Q07Leadership
  q08: Q08Crisis
  q09: Q09Investment
  q10: Q10Impact
}

/** All answers for WHEN score calculation (Q11-Q16) */
export interface WhenAnswers {
  q11: Q11ProjectStatus[]  // Multi-select, highest counts
  q12: string[]            // Geographic zones (multi-select, no scoring)
  q13: string[]            // Sectors (multi-select, no scoring)
  q14: Q14DealSize[]       // Multi-select
  q15: Q15Structure[]      // Multi-select
  q16: Q16Equity           // Single select

  // v3 additions — null for records submitted under v2 scoring (retroactive protection).
  /** Q11 priority choice. When `one_among_others` → -10 WHEN. */
  q11_priority?: Q11PriorityChoice | null
  /** Whether a lettre de cadrage was uploaded. -10 WHEN if q11 includes `framed` without one. */
  hasFicheDeCadrage?: boolean
}

// ========================================
// Score Results
// ========================================

/** WHO score result with breakdown */
export interface WhoScoreResult {
  /** Total WHO score (0-100) */
  score: number
  /** Points breakdown by question */
  breakdown: {
    q05: number
    q06: number
    q07: number
    q08: number
    q09: number
    q10: number
  }
}

/** WHEN score result with breakdown */
export interface WhenScoreResult {
  /** Total WHEN score (0-100, floored at 0) */
  score: number
  /** Points breakdown by component */
  breakdown: {
    /** Financial fit from triangulation (0-40) */
    fitFinancier: number
    /** Clarity of structure choice (0-40) */
    clarity: number
    /** Project status from Q11 (0-20) */
    projectStatus: number
    /** v3 penalties (negative numbers, 0 if none apply) */
    penalties?: number
  }
}

// ========================================
// Flags and Recommendations
// ========================================

/** Warning flags that override score-based recommendations */
export type Flag = 'F1' | 'F2' | 'F3' | 'F4' | 'F5'

/** Financial fit score from triangulation matrix (0=RED, 1=AMBER, 2=GREEN) */
export type FitScore = 0 | 1 | 2

/** Recommended action based on scores and flags */
export type RecommendedAction = 'deal_flow' | 'priority_interview' | 'interview' | 'starter_pack'

/** Flag detection result */
export interface FlagResult {
  /** Active flags (if any) */
  flags: Flag[]
  /** Human-readable descriptions for each flag type */
  descriptions: Record<Flag, string>
}

// ========================================
// Combined Result
// ========================================

/** Complete dual score result */
export interface DualScoreResult {
  /** WHO score (profile quality) */
  who: WhoScoreResult
  /** WHEN score (project maturity) */
  when: WhenScoreResult
  /** Warning flags (override recommendations if present) */
  flags: FlagResult
  /** Recommended next action */
  recommendation: RecommendedAction
}
