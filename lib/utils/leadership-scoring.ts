/**
 * Leadership Assessment Scoring Engine
 * Computes Bloc A radar, Bloc B score+tags, Bloc C risk index, and final decision.
 * Source of truth: Test_Assessment_FINAL.xlsx + ReNew_Scoring_Guide.docx
 */

import type {
  BlocAAnswer,
  BlocBAnswer,
  BlocCAnswer,
  BlocARadar,
  BlocBResult,
  BlocCResult,
  LeadershipDecision,
  LeadershipResult,
  LeadershipFormData,
} from "@/lib/types/leadership-assessment"
import { BLOC_A_QUESTIONS, BLOC_B_QUESTIONS, BLOC_C_QUESTIONS } from "@/lib/config/leadership-assessment"

/**
 * Score Bloc A: Leadership Profile Radar
 * Each answer contributes +1 to chosen poles and -1 to opposing poles.
 * Result is a radar with 8 poles (4 axes).
 */
export function scoreBlocA(answers: Record<string, BlocAAnswer | undefined>): BlocARadar {
  const radar: BlocARadar = {
    drive: 0,
    prudence: 0,
    autorite: 0,
    collectif: 0,
    controle: 0,
    delegation: 0,
    court_terme: 0,
    long_terme: 0,
  }

  for (const question of BLOC_A_QUESTIONS) {
    const answer = answers[question.id]
    if (!answer) continue

    const option = answer === "A" ? question.optionA : question.optionB
    for (const [pole, value] of Object.entries(option.poles)) {
      if (pole in radar) {
        radar[pole as keyof BlocARadar] += value
      }
    }
  }

  return radar
}

/**
 * Score Bloc B: Situational Maturity
 * Each answer has a score (+2, +1, 0, -2) and a tag.
 * Returns total score, list of tags, and count of -2 answers.
 */
export function scoreBlocB(answers: Record<string, BlocBAnswer | undefined>): BlocBResult {
  let total = 0
  const tags: string[] = []
  let minus2Count = 0

  for (const question of BLOC_B_QUESTIONS) {
    const answer = answers[question.id]
    if (!answer) continue

    const option = question.options.find((o) => o.value === answer)
    if (!option) continue

    total += option.score
    tags.push(option.tag)
    if (option.score === -2) {
      minus2Count++
    }
  }

  return { total, tags, minus2Count }
}

/**
 * Score Bloc C: Personal Risk
 * Direct items: score = response (higher = better)
 * Inverse items (C1, C3, C5): score = 6 - response (higher original = worse)
 * Risk Index = mean of inverse items (C1, C3, C5) BEFORE correction (raw 1-5)
 */
export function scoreBlocC(answers: Record<string, number | undefined>): BlocCResult {
  const scores: Record<string, number> = {}
  const inverseRawScores: number[] = []

  for (const question of BLOC_C_QUESTIONS) {
    const raw = answers[question.id]
    if (raw === undefined || raw === null) continue

    if (question.direction === "inverse") {
      scores[question.id] = 6 - raw
      inverseRawScores.push(raw) // Raw score for risk index
    } else {
      scores[question.id] = raw
    }
  }

  // Risk Index = mean of raw inverse items (C1, C3, C5)
  // Higher = more risky (scale 1-5, threshold is 3)
  const riskIndex =
    inverseRawScores.length > 0
      ? inverseRawScores.reduce((sum, v) => sum + v, 0) / inverseRawScores.length
      : 0

  return { riskIndex: Math.round(riskIndex * 10) / 10, scores }
}

/**
 * Compute decision based on Bloc B and Bloc C results.
 * From CSV.7 in Excel:
 * - Engagement: BlocB_Total >= 8 AND Nb_Minus2 <= 1 AND Risk_Index < 3
 * - Engagement sous conditions: BlocB_Total >= 2 AND Nb_Minus2 <= 2
 * - Non-engagement: BlocB_Total < 2 OR Nb_Minus2 >= 3
 */
export function computeDecision(blocB: BlocBResult, blocC: BlocCResult): LeadershipDecision {
  // Non-engagement: hard failures
  if (blocB.total < 2 || blocB.minus2Count >= 3) {
    return "non_engagement"
  }

  // Engagement: strong pass
  if (blocB.total >= 8 && blocB.minus2Count <= 1 && blocC.riskIndex < 3) {
    return "engagement"
  }

  // Engagement sous conditions: middle ground
  if (blocB.total >= 2 && blocB.minus2Count <= 2) {
    return "engagement_sous_conditions"
  }

  // Fallback to non-engagement
  return "non_engagement"
}

/**
 * Score the complete leadership assessment
 */
export function scoreLeadershipAssessment(data: LeadershipFormData): LeadershipResult {
  const blocA = scoreBlocA(data as Record<string, BlocAAnswer | undefined>)
  const blocB = scoreBlocB(data as Record<string, BlocBAnswer | undefined>)
  const blocC = scoreBlocC(data as Record<string, number | undefined>)
  const decision = computeDecision(blocB, blocC)

  return { blocA, blocB, blocC, decision }
}

/**
 * Get decision label and color for display
 */
export function getDecisionDisplay(decision: LeadershipDecision): {
  label: string
  labelEn: string
  color: string
  bgColor: string
} {
  switch (decision) {
    case "engagement":
      return {
        label: "Engagement",
        labelEn: "Engagement",
        color: "text-green-700",
        bgColor: "bg-green-100",
      }
    case "engagement_sous_conditions":
      return {
        label: "Engagement sous conditions",
        labelEn: "Conditional engagement",
        color: "text-amber-700",
        bgColor: "bg-amber-100",
      }
    case "non_engagement":
      return {
        label: "Non-engagement",
        labelEn: "Non-engagement",
        color: "text-red-700",
        bgColor: "bg-red-100",
      }
  }
}
