import type { Repreneur } from "@/lib/types/repreneur"

/**
 * Radar chart dimension configuration
 * Uses actual Tier 1 score breakdown stored from questionnaire
 *
 * Dimensions and their source questions:
 * - Experience: Q1 (employment) + Q2 (years) + Q3 (sectors) = max 25
 * - Leadership: Q5 (team size) + Q8 (exec roles) + Q9 (board) = max 26
 * - M&A Knowledge: Q6 (M&A involvement) = max 10
 * - Readiness: Q10 (journey stages) + Q11 (target sectors) + Q12 (targets identified) = max 25
 * - Financial: Q14 (investment) + Q15 (funding) + Q16 (network) + Q17 (co-acquisition) = max 22
 */

export const DIMENSION_MAX_SCORES = {
  experience: 25,   // Q1 (10) + Q2 (10) + Q3 (5)
  leadership: 26,   // Q5 (10) + Q8 (6) + Q9 (10)
  maKnowledge: 10,  // Q6 (10)
  readiness: 25,    // Q10 (10) + Q11 (5) + Q12 (10)
  financial: 22,    // Q14 (10) + Q15 (3) + Q16 (4) + Q17 (5)
}

// Calculate experience score using actual Tier 1 breakdown
export function calculateExperienceScore(repreneur: Repreneur): number {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return 0

  const raw = (breakdown.q1_score || 0) + (breakdown.q2_score || 0) + (breakdown.q3_score || 0)
  // Normalize to percentage (0-100)
  return Math.round((raw / DIMENSION_MAX_SCORES.experience) * 100)
}

// Calculate leadership score using actual Tier 1 breakdown
export function calculateLeadershipScore(repreneur: Repreneur): number {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return 0

  const raw = (breakdown.q5_score || 0) + (breakdown.q8_score || 0) + (breakdown.q9_score || 0)
  // Normalize to percentage (0-100)
  return Math.round((raw / DIMENSION_MAX_SCORES.leadership) * 100)
}

// Calculate M&A knowledge score using actual Tier 1 breakdown
export function calculateMAKnowledgeScore(repreneur: Repreneur): number {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return 0

  const raw = breakdown.q6_score || 0
  // Normalize to percentage (0-100)
  return Math.round((raw / DIMENSION_MAX_SCORES.maKnowledge) * 100)
}

// Calculate acquisition readiness score using actual Tier 1 breakdown
export function calculateReadinessScore(repreneur: Repreneur): number {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return 0

  const raw = (breakdown.q10_score || 0) + (breakdown.q11_score || 0) + (breakdown.q12_score || 0)
  // Normalize to percentage (0-100)
  return Math.round((raw / DIMENSION_MAX_SCORES.readiness) * 100)
}

// Calculate financial capacity score using actual Tier 1 breakdown
export function calculateFinancialScore(repreneur: Repreneur): number {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return 0

  const raw = (breakdown.q14_score || 0) + (breakdown.q15_score || 0) + (breakdown.q16_score || 0) + (breakdown.q17_score || 0)
  // Normalize to percentage (0-100)
  return Math.round((raw / DIMENSION_MAX_SCORES.financial) * 100)
}

// Calculate overall score (uses tier1_score directly, or average of dimensions as fallback)
export function calculateOverallScore(repreneur: Repreneur): number {
  // Use stored tier1_score if available (max 98)
  if (repreneur.tier1_score !== undefined && repreneur.tier1_score !== null) {
    return repreneur.tier1_score
  }

  // Fallback: calculate from dimensions
  const experience = calculateExperienceScore(repreneur)
  const leadership = calculateLeadershipScore(repreneur)
  const maKnowledge = calculateMAKnowledgeScore(repreneur)
  const readiness = calculateReadinessScore(repreneur)
  const financial = calculateFinancialScore(repreneur)

  return Math.round((experience + leadership + maKnowledge + readiness + financial) / 5)
}

// Get raw scores for each dimension (not normalized)
export function getRawDimensionScores(repreneur: Repreneur) {
  const breakdown = repreneur.tier1_score_breakdown as Record<string, number> | undefined
  if (!breakdown) return null

  return {
    experience: {
      score: (breakdown.q1_score || 0) + (breakdown.q2_score || 0) + (breakdown.q3_score || 0),
      max: DIMENSION_MAX_SCORES.experience,
    },
    leadership: {
      score: (breakdown.q5_score || 0) + (breakdown.q8_score || 0) + (breakdown.q9_score || 0),
      max: DIMENSION_MAX_SCORES.leadership,
    },
    maKnowledge: {
      score: breakdown.q6_score || 0,
      max: DIMENSION_MAX_SCORES.maKnowledge,
    },
    readiness: {
      score: (breakdown.q10_score || 0) + (breakdown.q11_score || 0) + (breakdown.q12_score || 0),
      max: DIMENSION_MAX_SCORES.readiness,
    },
    financial: {
      score: (breakdown.q14_score || 0) + (breakdown.q15_score || 0) + (breakdown.q16_score || 0) + (breakdown.q17_score || 0),
      max: DIMENSION_MAX_SCORES.financial,
    },
  }
}
