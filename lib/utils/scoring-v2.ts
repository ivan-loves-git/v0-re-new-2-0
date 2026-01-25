/**
 * WHO/WHEN Dual Scoring System - Calculation Engine
 *
 * Based on questionnaire-spec-v2.md
 * WHO: Profile quality (Q05-Q10) - 0 to 100
 * WHEN: Project maturity (Q11-Q16) - 0 to 100
 */

import type {
  WhoAnswers,
  WhenAnswers,
  WhoScoreResult,
  WhenScoreResult,
  DualScoreResult,
  Flag,
  FlagResult,
  FitScore,
  RecommendedAction,
  Q05Status,
  Q06Experience,
  Q07Leadership,
  Q08Crisis,
  Q09Investment,
  Q10Impact,
  Q11ProjectStatus,
  Q14DealSize,
  Q15Structure,
  Q16Equity
} from '@/lib/types/scoring-v2'

// ========================================
// WHO Score Points (Q05-Q10)
// ========================================

const WHO_POINTS: {
  q05: Record<Q05Status, number>
  q06: Record<Q06Experience, number>
  q07: Record<Q07Leadership, number>
  q08: Record<Q08Crisis, number>
  q09: Record<Q09Investment, number>
  q10: Record<Q10Impact, number>
} = {
  q05: {
    entrepreneur: 5,
    freelance: 4,
    employee: 3,
    transition: 2,
    other: 1
  },
  q06: {
    more_than_20: 15,
    '10_to_20': 10,
    less_than_10: 5
  },
  q07: {
    general_management: 30,
    mgmt_over_10: 20,
    mgmt_under_10: 10,
    none: 0
  },
  q08: {
    multiple: 20,
    once: 10,
    none: 0
  },
  q09: {
    both: 15,
    personal: 12,
    professional: 10,
    none: 0
  },
  q10: {
    financial: 15,
    trajectory: 12,
    limited: 6,
    none: 0
  }
}

// ========================================
// WHEN Score - Project Status Points (Q11)
// ========================================

const Q11_POINTS: Record<Q11ProjectStatus, number> = {
  discovery: 0,
  exploratory: 5,
  framed: 10,
  searching: 15,
  loi: 20
}

// ========================================
// Triangulation Matrix (fit_financier)
// Deal Size x Capital Structure x Equity -> FitScore (0-2)
// ========================================

/**
 * Full triangulation matrix from spec.
 * Structure: MATRIX[dealSize][structure][equity] = FitScore (0=RED, 1=AMBER, 2=GREEN)
 */
const TRIANGULATION_MATRIX: Record<Q14DealSize, Record<Exclude<Q15Structure, 'havent_thought'>, Record<Q16Equity, FitScore>>> = {
  '1-3M': {
    majority_without_fund: {
      '>450': 2,      // GREEN
      '351-450': 1,   // AMBER
      '251-350': 1,   // AMBER
      '151-250': 0,   // RED
      tbd: 0          // RED
    },
    majority_with_minority: {
      '>450': 2,      // GREEN
      '351-450': 2,   // GREEN
      '251-350': 2,   // GREEN
      '151-250': 1,   // AMBER
      tbd: 0          // RED
    },
    manager_with_majority: {
      '>450': 2,      // GREEN
      '351-450': 2,   // GREEN
      '251-350': 2,   // GREEN
      '151-250': 2,   // GREEN (151K+ is enough with majority fund)
      tbd: 0          // RED
    }
  },
  '3-5M': {
    majority_without_fund: {
      '>450': 1,      // AMBER (solo is risky at this size)
      '351-450': 0,   // RED
      '251-350': 0,   // RED
      '151-250': 0,   // RED
      tbd: 0          // RED
    },
    majority_with_minority: {
      '>450': 2,      // GREEN
      '351-450': 2,   // GREEN
      '251-350': 1,   // AMBER
      '151-250': 0,   // RED
      tbd: 0          // RED
    },
    manager_with_majority: {
      '>450': 2,      // GREEN
      '351-450': 2,   // GREEN
      '251-350': 1,   // AMBER
      '151-250': 0,   // RED
      tbd: 0          // RED
    }
  },
  '>5M': {
    majority_without_fund: {
      '>450': 0,      // RED (solo at >5M is almost always incoherent)
      '351-450': 0,   // RED
      '251-350': 0,   // RED
      '151-250': 0,   // RED
      tbd: 0          // RED
    },
    majority_with_minority: {
      '>450': 2,      // GREEN
      '351-450': 1,   // AMBER
      '251-350': 0,   // RED
      '151-250': 0,   // RED
      tbd: 0          // RED
    },
    manager_with_majority: {
      '>450': 2,      // GREEN
      '351-450': 2,   // GREEN
      '251-350': 1,   // AMBER
      '151-250': 0,   // RED
      tbd: 0          // RED
    }
  }
}

// ========================================
// Flag Descriptions
// ========================================

export const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  F1: 'High deal size (>5M) with undefined equity - ambition disconnected from means',
  F2: 'Both "majority owner" and "majority fund" selected - governance contradiction',
  F3: 'Multiple capital structures selected or "haven\'t thought" - unclear on role',
  F4: 'Solo acquisition without fund with ≤250K equity on 1-3M deal - underfunded',
  F5: 'Small deal (<1M) with majority fund - LBO model doesn\'t apply'
}

// ========================================
// Calculation Functions
// ========================================

/**
 * Calculate WHO score from Q05-Q10 answers.
 * Simple sum of all answer points.
 *
 * Max: 5 + 15 + 30 + 20 + 15 + 15 = 100
 * Min: 1 + 5 + 0 + 0 + 0 + 0 = 6
 */
export function calculateWhoScore(answers: WhoAnswers): WhoScoreResult {
  const breakdown = {
    q05: WHO_POINTS.q05[answers.q05],
    q06: WHO_POINTS.q06[answers.q06],
    q07: WHO_POINTS.q07[answers.q07],
    q08: WHO_POINTS.q08[answers.q08],
    q09: WHO_POINTS.q09[answers.q09],
    q10: WHO_POINTS.q10[answers.q10]
  }

  const score = Object.values(breakdown).reduce((sum, points) => sum + points, 0)

  return { score, breakdown }
}

/**
 * Calculate financial fit score from triangulation matrix.
 * Evaluates coherence between: Deal Size x Capital Structure x Equity Contribution
 *
 * Returns: 0 (RED), 1 (AMBER), or 2 (GREEN)
 *
 * For multi-select on Q14/Q15: evaluates all combinations, returns the best result.
 */
export function calculateTriangulation(
  dealSizes: Q14DealSize[],
  structures: Q15Structure[],
  equity: Q16Equity
): FitScore {
  // Filter out "haven't thought" - always results in 0
  const validStructures = structures.filter(
    (s): s is Exclude<Q15Structure, 'havent_thought'> => s !== 'havent_thought'
  )

  // No valid structures = RED
  if (validStructures.length === 0) return 0

  // No deal sizes = RED
  if (dealSizes.length === 0) return 0

  // Multi-select: evaluate all combinations, return best score
  let bestScore: FitScore = 0

  for (const deal of dealSizes) {
    for (const structure of validStructures) {
      const score = TRIANGULATION_MATRIX[deal]?.[structure]?.[equity] ?? 0
      if (score > bestScore) {
        bestScore = score as FitScore
      }
    }
  }

  return bestScore
}

/**
 * Calculate WHEN score from Q11-Q16 answers.
 *
 * Formula: WHEN = (fit_financier × 20) + (clarity × 20) + Q11_project_status
 *
 * Components:
 * - fit_financier: 0-2 from triangulation, scaled to 0-40
 * - clarity: 0-2 based on structure selection, scaled to 0-40
 *   - 2 = one structure selected (not "haven't thought")
 *   - 1 = two compatible options
 *   - 0 = contradiction or "haven't thought"
 * - Q11_project_status: 0-20 directly
 *
 * Max: 40 + 40 + 20 = 100
 */
export function calculateWhenScore(answers: WhenAnswers): WhenScoreResult {
  // Project status: highest selected option (0-20)
  const projectStatus = answers.q11.length > 0
    ? Math.max(...answers.q11.map(s => Q11_POINTS[s] ?? 0))
    : 0

  // Fit financier: triangulation × 20 (0-40)
  const triangulationScore = calculateTriangulation(answers.q14, answers.q15, answers.q16)
  const fitFinancier = triangulationScore * 20

  // Clarity: based on structure selection
  // 2 (40pts) = single valid structure selected
  // 1 (20pts) = two compatible structures (not a contradiction)
  // 0 (0pts) = "haven't thought" or multiple contradicting structures
  let clarityRaw: 0 | 1 | 2 = 0

  const hasHaventThought = answers.q15.includes('havent_thought')
  const validStructures = answers.q15.filter(s => s !== 'havent_thought')

  if (hasHaventThought) {
    // "Haven't thought" = no clarity
    clarityRaw = 0
  } else if (validStructures.length === 1) {
    // Single clear structure = full clarity
    clarityRaw = 2
  } else if (validStructures.length === 2) {
    // Two structures - check if compatible
    // Majority owner + majority fund is a contradiction (F2 flag)
    const hasMajorityOwner = validStructures.includes('majority_without_fund') ||
                             validStructures.includes('majority_with_minority')
    const hasMajorityFund = validStructures.includes('manager_with_majority')

    if (hasMajorityOwner && hasMajorityFund) {
      // Contradiction
      clarityRaw = 0
    } else {
      // Two compatible options - partial clarity
      clarityRaw = 1
    }
  } else {
    // More than 2 structures = unclear
    clarityRaw = 0
  }

  const clarity = clarityRaw * 20

  return {
    score: fitFinancier + clarity + projectStatus,
    breakdown: { fitFinancier, clarity, projectStatus }
  }
}

/**
 * Detect warning flags based on WHEN answers.
 * FLAGS OVERRIDE SCORE-BASED RECOMMENDATIONS.
 */
export function detectFlags(answers: WhenAnswers): FlagResult {
  const flags: Flag[] = []

  // F1: >5M deal + equity TBD
  // "Ambition not connected to means"
  if (answers.q14.includes('>5M') && answers.q16 === 'tbd') {
    flags.push('F1')
  }

  // F2: Both "majority owner" AND "majority fund" selected
  // "Governance contradiction"
  const hasMajorityOwner = answers.q15.includes('majority_without_fund') ||
                           answers.q15.includes('majority_with_minority')
  const hasMajorityFund = answers.q15.includes('manager_with_majority')
  if (hasMajorityOwner && hasMajorityFund) {
    flags.push('F2')
  }

  // F3: Multiple structures selected OR "haven't thought"
  // "Unclear on role/dilution"
  const validStructures = answers.q15.filter(s => s !== 'havent_thought')
  if (answers.q15.includes('havent_thought') || validStructures.length > 1) {
    flags.push('F3')
  }

  // F4: Solo (majority without fund) + equity ≤250K on 1-3M deal
  // "Misunderstanding of requirements" - underfunded
  const isSolo = answers.q15.length === 1 && answers.q15.includes('majority_without_fund')
  const isLowEquity = answers.q16 === 'tbd' || answers.q16 === '151-250'
  const is1to3MOnly = answers.q14.length === 1 && answers.q14.includes('1-3M')
  if (isSolo && isLowEquity && is1to3MOnly) {
    flags.push('F4')
  }

  // F5: Deal <1M with majority fund
  // "LBO model doesn't apply"
  // Note: spec mentions <1M but our Q14 options start at 1-3M
  // This flag currently cannot be triggered with existing options
  // Keeping for future if <1M option is added

  return { flags, descriptions: FLAG_DESCRIPTIONS }
}

/**
 * Get recommended action based on WHO/WHEN scores and flags.
 *
 * FLAGS OVERRIDE EVERYTHING - any flag -> starter_pack
 *
 * Score-based logic:
 * | WHO  | WHEN | Recommended Action |
 * |------|------|--------------------|
 * | ≥70  | ≥80  | deal_flow          |
 * | ≥70  | 40-79| priority_interview |
 * | <70  | ≥80  | interview          |
 * | any  | <40  | starter_pack       |
 */
export function getRecommendedAction(
  whoScore: number,
  whenScore: number,
  flags: Flag[]
): RecommendedAction {
  // FLAGS OVERRIDE EVERYTHING
  if (flags.length > 0) {
    return 'starter_pack'
  }

  // Score-based logic
  if (whoScore >= 70 && whenScore >= 80) {
    return 'deal_flow'
  }

  if (whoScore >= 70 && whenScore >= 40) {
    return 'priority_interview'
  }

  if (whoScore < 70 && whenScore >= 80) {
    return 'interview'
  }

  // WHEN < 40 or low scores
  return 'starter_pack'
}

/**
 * Calculate complete dual score from WHO and WHEN answers.
 * Main entry point for scoring.
 */
export function calculateDualScore(
  whoAnswers: WhoAnswers,
  whenAnswers: WhenAnswers
): DualScoreResult {
  const who = calculateWhoScore(whoAnswers)
  const when = calculateWhenScore(whenAnswers)
  const flagResult = detectFlags(whenAnswers)
  const recommendation = getRecommendedAction(who.score, when.score, flagResult.flags)

  return {
    who,
    when,
    flags: flagResult,
    recommendation
  }
}
