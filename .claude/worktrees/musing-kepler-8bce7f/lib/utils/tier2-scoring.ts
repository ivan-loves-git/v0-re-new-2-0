import { Tier2Dimensions, Tier2DimensionKey } from "@/lib/types/repreneur"
import { TIER2_DIMENSIONS, TIER2_PASS_THRESHOLD } from "@/lib/constants/tier-config"

/**
 * Calculate weighted average of Tier 2 dimensions
 * Returns null if not all dimensions are rated
 */
export function calculateTier2Overall(dimensions: Partial<Tier2Dimensions>): number | null {
  let weightedSum = 0
  let totalWeight = 0
  let hasAllDimensions = true

  for (const dim of TIER2_DIMENSIONS) {
    const value = dimensions[dim.key]
    if (value === null || value === undefined) {
      hasAllDimensions = false
    } else {
      weightedSum += value * dim.weight
      totalWeight += dim.weight
    }
  }

  // Require all dimensions to be rated for overall score
  if (!hasAllDimensions || totalWeight === 0) {
    return null
  }

  // Round to 2 decimal places
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

/**
 * Check if Tier 2 overall score passes the threshold (4.0)
 */
export function hasTier2Passed(overall: number | null): boolean {
  return overall !== null && overall >= TIER2_PASS_THRESHOLD
}

/**
 * Get Tier 2 dimensions from a repreneur object
 */
export function extractTier2Dimensions(repreneur: {
  tier2_leadership?: number | null
  tier2_financial_acumen?: number | null
  tier2_communication?: number | null
  tier2_clarity_of_vision?: number | null
  tier2_coachability?: number | null
  tier2_commitment?: number | null
}): Tier2Dimensions {
  return {
    leadership: repreneur.tier2_leadership ?? null,
    financial_acumen: repreneur.tier2_financial_acumen ?? null,
    communication: repreneur.tier2_communication ?? null,
    clarity_of_vision: repreneur.tier2_clarity_of_vision ?? null,
    coachability: repreneur.tier2_coachability ?? null,
    commitment: repreneur.tier2_commitment ?? null,
  }
}

/**
 * Count how many Tier 2 dimensions are rated
 */
export function countRatedDimensions(dimensions: Partial<Tier2Dimensions>): number {
  return Object.values(dimensions).filter((v) => v !== null && v !== undefined).length
}

/**
 * Convert Tier 2 dimensions to database column format
 */
export function dimensionsToDbColumns(dimensions: Partial<Tier2Dimensions>): Record<string, number | null> {
  return {
    tier2_leadership: dimensions.leadership ?? null,
    tier2_financial_acumen: dimensions.financial_acumen ?? null,
    tier2_communication: dimensions.communication ?? null,
    tier2_clarity_of_vision: dimensions.clarity_of_vision ?? null,
    tier2_coachability: dimensions.coachability ?? null,
    tier2_commitment: dimensions.commitment ?? null,
  }
}

/**
 * Get star rating display (1-5) from dimension value
 */
export function getStarRating(value: number | null): number {
  if (value === null) return 0
  return Math.max(1, Math.min(5, Math.round(value)))
}
