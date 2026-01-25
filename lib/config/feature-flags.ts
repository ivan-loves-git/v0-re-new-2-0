/**
 * Feature Flags for Re-New Platform
 *
 * These flags control the rollout of new features.
 * Set via environment variables for production control.
 */

export const FEATURE_FLAGS = {
  /**
   * Enable dual WHO/WHEN scoring (v2) instead of legacy Tier 1 scoring.
   * When enabled:
   * - New intake form uses WHO/WHEN questions (Q05-Q16)
   * - Dashboard shows WHO and WHEN scores
   * - Recommendations based on dual scores + flags
   *
   * When disabled:
   * - Legacy intake form with original questions
   * - Dashboard shows Tier 1 score only
   */
  DUAL_SCORING_ENABLED: process.env.NEXT_PUBLIC_DUAL_SCORING === 'true',

  /**
   * Show new intake form v2 publicly.
   * When enabled:
   * - /intake redirects to /intake-v2
   * - New questionnaire with 18 questions
   *
   * When disabled:
   * - /intake shows legacy form (if exists) or disabled message
   */
  INTAKE_V2_ENABLED: process.env.NEXT_PUBLIC_INTAKE_V2 === 'true',

  /**
   * Show score breakdown details in UI.
   * Useful for debugging and transparency during development.
   */
  SHOW_SCORE_BREAKDOWN: process.env.NEXT_PUBLIC_SHOW_SCORE_BREAKDOWN === 'true'
} as const

/**
 * Check if dual scoring is enabled
 */
export function isDualScoringEnabled(): boolean {
  return FEATURE_FLAGS.DUAL_SCORING_ENABLED
}

/**
 * Check if intake v2 is enabled
 */
export function isIntakeV2Enabled(): boolean {
  return FEATURE_FLAGS.INTAKE_V2_ENABLED
}

/**
 * Get scoring mode label for display
 */
export function getScoringModeLabel(): 'WHO/WHEN' | 'Tier 1' {
  return FEATURE_FLAGS.DUAL_SCORING_ENABLED ? 'WHO/WHEN' : 'Tier 1'
}
