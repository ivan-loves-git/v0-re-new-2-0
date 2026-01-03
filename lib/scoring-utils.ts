import type { Repreneur } from "@/lib/types/repreneur"

// Calculate experience score (0-100)
export function calculateExperienceScore(repreneur: Repreneur): number {
  let score = 0

  // Years of experience (max 40 points)
  const yearsMap: Record<string, number> = {
    "less_10": 10,
    "10_15": 20,
    "15_20": 30,
    "more_20": 40,
  }
  if (repreneur.q2_years_experience) {
    score += yearsMap[repreneur.q2_years_experience] || 0
  }

  // Employment status (max 30 points)
  const statusMap: Record<string, number> = {
    "employee": 15,
    "executive": 25,
    "entrepreneur": 30,
    "in_transition": 20,
    "retired": 15,
  }
  if (repreneur.q1_employment_status) {
    score += statusMap[repreneur.q1_employment_status] || 0
  }

  // Industry sectors (max 30 points)
  if (repreneur.q3_industry_sectors?.length) {
    score += Math.min(repreneur.q3_industry_sectors.length * 10, 30)
  }

  return Math.min(score, 100)
}

// Calculate leadership score (0-100)
export function calculateLeadershipScore(repreneur: Repreneur): number {
  let score = 0

  // Team size managed (max 35 points)
  const teamMap: Record<string, number> = {
    "none": 0,
    "1_5": 10,
    "5_20": 20,
    "20_50": 30,
    "more_50": 35,
  }
  if (repreneur.q5_team_size) {
    score += teamMap[repreneur.q5_team_size] || 0
  }

  // Executive roles (max 40 points)
  if (repreneur.q8_executive_roles?.length) {
    score += Math.min(repreneur.q8_executive_roles.length * 15, 40)
  }

  // Board experience (25 points)
  if (repreneur.q9_board_experience) {
    score += 25
  }

  return Math.min(score, 100)
}

// Calculate M&A knowledge score (0-100)
export function calculateMAKnowledgeScore(repreneur: Repreneur): number {
  let score = 0

  // Prior M&A experience (35 points)
  if (repreneur.q4_has_ma_experience) {
    score += 35
  }

  // Involved in M&A (30 points)
  if (repreneur.q6_involved_in_ma) {
    score += 30
  }

  // M&A details provided (35 points)
  if (repreneur.q7_ma_details && repreneur.q7_ma_details.length > 20) {
    score += 35
  } else if (repreneur.q7_ma_details) {
    score += 15
  }

  return Math.min(score, 100)
}

// Calculate acquisition readiness score (0-100)
export function calculateReadinessScore(repreneur: Repreneur): number {
  let score = 0

  // Journey stages (max 40 points)
  const stageMap: Record<string, number> = {
    "explorer": 10,
    "learner": 25,
    "ready": 40,
    "serial_acquirer": 40,
  }
  if (repreneur.journey_stage) {
    score += stageMap[repreneur.journey_stage] || 0
  }

  // Has identified targets (30 points)
  if (repreneur.q12_has_identified_targets) {
    score += 30
  }

  // Target details provided (30 points)
  if (repreneur.q13_target_details && repreneur.q13_target_details.length > 20) {
    score += 30
  } else if (repreneur.q13_target_details) {
    score += 15
  }

  return Math.min(score, 100)
}

// Calculate financial capacity score (0-100)
export function calculateFinancialScore(repreneur: Repreneur): number {
  let score = 0

  // Investment capacity (max 50 points)
  const capacityMap: Record<string, number> = {
    "€0 - €50,000": 10,
    "€50,000 - €100,000": 20,
    "€100,000 - €200,000": 30,
    "€200,000 - €500,000": 40,
    "€500,000+": 50,
  }
  if (repreneur.investment_capacity) {
    score += capacityMap[repreneur.investment_capacity] || 0
  }

  // Funding status (max 50 points)
  const fundingMap: Record<string, number> = {
    "not_started": 5,
    "exploring": 15,
    "in_progress": 30,
    "secured": 50,
  }
  if (repreneur.q15_funding_status) {
    score += fundingMap[repreneur.q15_funding_status] || 0
  }

  return Math.min(score, 100)
}

// Calculate overall score (average of all dimensions)
export function calculateOverallScore(repreneur: Repreneur): number {
  const experience = calculateExperienceScore(repreneur)
  const leadership = calculateLeadershipScore(repreneur)
  const maKnowledge = calculateMAKnowledgeScore(repreneur)
  const readiness = calculateReadinessScore(repreneur)
  const financial = calculateFinancialScore(repreneur)

  return Math.round((experience + leadership + maKnowledge + readiness + financial) / 5)
}
