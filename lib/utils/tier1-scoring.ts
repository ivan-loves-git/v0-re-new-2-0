/**
 * Tier 1 Scoring System for Re-New
 *
 * This calculates a score based on Bertrand's questionnaire model (Q1-Q17).
 * Score is calculated ONCE at intake and stored as a static snapshot.
 *
 * Based on reverse-engineering the CSV scoring model provided by Bertrand.
 */

// Question option types
export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "sans_emploi", label: "Sans emploi", score: 10 },
  { value: "transition", label: "En transition professionnelle", score: 10 },
  { value: "independant", label: "Travailleur indépendant", score: 7 },
  { value: "temps_plein", label: "Employé à temps plein", score: 5 },
  { value: "temps_partiel", label: "Employé à temps partiel", score: 5 },
  { value: "autre", label: "Autre", score: 3 },
] as const

export const YEARS_EXPERIENCE_OPTIONS = [
  { value: "20_plus", label: ">20 ans", score: 10 },
  { value: "16_20", label: "16 à 20 ans", score: 7.5 },
  { value: "11_15", label: "11 à 15 ans", score: 5 },
  { value: "less_10", label: "<10 ans", score: 0 },
] as const

export const TEAM_SIZE_OPTIONS = [
  { value: "50_plus", label: ">50 pers.", score: 10 },
  { value: "20_50", label: "20 à 50 pers.", score: 7.5 },
  { value: "11_20", label: "11 à 20 pers.", score: 0 },
  { value: "less_10", label: "<10 pers.", score: 3 },
] as const

export const EXECUTIVE_ROLE_OPTIONS = [
  { value: "ceo", label: "CEO/Directeur Général" },
  { value: "coo", label: "COO/Directeur des Opérations" },
  { value: "cfo", label: "CFO/Directeur Financier" },
  { value: "cco", label: "CCO/Directeur Commercial" },
  { value: "cto", label: "CTO/CIO/Directeur des SI" },
  { value: "chro", label: "CHRO/Directeur RH" },
  { value: "division_director", label: "Directeur de Division/BU" },
  { value: "other", label: "Autres" },
  { value: "none", label: "Aucun" },
] as const

export const JOURNEY_STAGE_OPTIONS = [
  { value: "info_only", label: "Recherche d'informations uniquement", score: 2 },
  { value: "first_contacts", label: "Premiers contacts avec des acteurs de la reprise", score: 4 },
  { value: "training_done", label: "Formation à la reprise effectuée", score: 6 },
  { value: "letter_of_intent", label: "Lettre de cadrage (projet ou final)", score: 8 },
  { value: "target_search", label: "Recherche de cibles", score: 8 },
  { value: "financing_defined", label: "Financement défini (ou en cours)", score: 10 },
] as const

export const INVESTMENT_CAPACITY_OPTIONS = [
  { value: "450_plus", label: ">450 K€", score: 10 },
  { value: "351_450", label: "351 K€ - 450 K€", score: 8 },
  { value: "251_350", label: "251 K€ - 350 K€", score: 6 },
  { value: "151_250", label: "151 K€ - 250 K€", score: 4 },
  { value: "less_150", label: "<150 K€", score: 2 },
  { value: "tbd", label: "En cours d'évaluation / à définir", score: 0 },
] as const

export const FUNDING_STATUS_OPTIONS = [
  { value: "secured", label: "Déjà bouclé", score: 3 },
  { value: "in_progress", label: "En cours de validation", score: 1 },
] as const

export const NETWORK_TRAINING_OPTIONS = [
  { value: "cra", label: "C.R.A.", score: 2 },
  { value: "cci", label: "CCI", score: 2 },
  { value: "other", label: "Autres", score: 2 },
  { value: "none", label: "Non, aucune", score: 0 },
] as const

export const INDUSTRY_SECTOR_OPTIONS = [
  { value: "agriculture", label: "Agriculture" },
  { value: "arts", label: "Arts" },
  { value: "construction", label: "Construction" },
  { value: "commerce_detail", label: "Commerce de détail" },
  { value: "commerce_gros", label: "Commerce de gros" },
  { value: "finance_assurances", label: "Finance & Assurances" },
  { value: "gestion_entreprises", label: "Gestion des entreprises" },
  { value: "hebergement_restauration", label: "Hébergement & Restauration" },
  { value: "immobilier", label: "Immobilier & location" },
  { value: "industrie", label: "Industrie manufacturière" },
  { value: "information_medias", label: "Information & Médias" },
  { value: "sante", label: "Santé & Assistance sociale" },
  { value: "services_admin", label: "Services administratifs & de soutien" },
  { value: "services_educatifs", label: "Services éducatifs" },
  { value: "services_pro", label: "Services professionnels" },
  { value: "spectacles_loisirs", label: "Spectacles & Loisirs" },
  { value: "scientifiques_techniques", label: "Scientifiques & techniques" },
  { value: "sylviculture", label: "Sylviculture" },
  { value: "transport", label: "Transport & entreposage" },
  { value: "services_publics", label: "Services publics" },
  { value: "admin_publique", label: "Administration publique & gouvernement" },
  { value: "extraction", label: "Extraction minière" },
  { value: "autres_services", label: "Autres services" },
] as const

// Input type for scoring calculation
export interface Tier1ScoringInput {
  // Q1: Employment status
  q1_employment_status: string | null
  // Q2: Years of experience
  q2_years_experience: string | null
  // Q3: Industry sectors (multi-select)
  q3_industry_sectors: string[] | null
  // Q4: Has M&A experience (boolean)
  q4_has_ma_experience: boolean | null
  // Q5: Team size managed
  q5_team_size: string | null
  // Q6: Involved in M&A transactions
  q6_involved_in_ma: boolean | null
  // Q7: M&A details (text, not scored)
  // Q8: Executive roles (multi-select)
  q8_executive_roles: string[] | null
  // Q9: Board experience
  q9_board_experience: boolean | null
  // Q10: Journey stages (multi-select)
  q10_journey_stages: string[] | null
  // Q11: Target sectors (multi-select)
  q11_target_sectors: string[] | null
  // Q12: Has identified specific targets
  q12_has_identified_targets: boolean | null
  // Q13: Target details (text, not scored)
  // Q14: Investment capacity
  q14_investment_capacity: string | null
  // Q15: Funding status
  q15_funding_status: string | null
  // Q16: Network/training (multi-select)
  q16_network_training: string[] | null
  // Q17: Open to co-acquisition
  q17_open_to_co_acquisition: boolean | null
}

// Score breakdown for transparency
export interface Tier1ScoreBreakdown {
  q1_score: number
  q2_score: number
  q3_score: number
  q5_score: number
  q6_score: number
  q8_score: number
  q9_score: number
  q10_score: number
  q11_score: number
  q12_score: number
  q14_score: number
  q15_score: number
  q16_score: number
  q17_score: number
  total: number
}

/**
 * Calculate Tier 1 score from questionnaire input
 * Returns both total score and breakdown by question
 */
export function calculateTier1Score(input: Tier1ScoringInput): Tier1ScoreBreakdown {
  const breakdown: Tier1ScoreBreakdown = {
    q1_score: 0,
    q2_score: 0,
    q3_score: 0,
    q5_score: 0,
    q6_score: 0,
    q8_score: 0,
    q9_score: 0,
    q10_score: 0,
    q11_score: 0,
    q12_score: 0,
    q14_score: 0,
    q15_score: 0,
    q16_score: 0,
    q17_score: 0,
    total: 0,
  }

  // Q1: Employment Status (0-10)
  if (input.q1_employment_status) {
    const option = EMPLOYMENT_STATUS_OPTIONS.find(o => o.value === input.q1_employment_status)
    breakdown.q1_score = option?.score ?? 0
  }

  // Q2: Years of Experience (0-10)
  if (input.q2_years_experience) {
    const option = YEARS_EXPERIENCE_OPTIONS.find(o => o.value === input.q2_years_experience)
    breakdown.q2_score = option?.score ?? 0
  }

  // Q3: Industry Experience (3-5 based on breadth)
  if (input.q3_industry_sectors && input.q3_industry_sectors.length > 0) {
    breakdown.q3_score = input.q3_industry_sectors.length >= 3 ? 5 : 3
  }

  // Q5: Team Size Managed (0-10)
  if (input.q5_team_size) {
    const option = TEAM_SIZE_OPTIONS.find(o => o.value === input.q5_team_size)
    breakdown.q5_score = option?.score ?? 0
  }

  // Q6: M&A Involvement (0 or 10)
  if (input.q6_involved_in_ma === true) {
    breakdown.q6_score = 10
  }

  // Q8: Executive Roles (2-8 based on seniority)
  if (input.q8_executive_roles && input.q8_executive_roles.length > 0) {
    const cLevelRoles = ["ceo", "coo", "cfo", "cco", "cto", "chro"]
    const hasCLevel = input.q8_executive_roles.some(r => cLevelRoles.includes(r))
    const hasMultipleRoles = input.q8_executive_roles.length > 1

    if (hasCLevel) {
      breakdown.q8_score = hasMultipleRoles ? 6 : 4
    } else if (input.q8_executive_roles.includes("division_director")) {
      breakdown.q8_score = 4
    } else if (!input.q8_executive_roles.includes("none")) {
      breakdown.q8_score = 2
    }
  }

  // Q9: Board Experience (0 or 10)
  if (input.q9_board_experience === true) {
    breakdown.q9_score = 10
  }

  // Q10: Journey Stage (2-10 based on advancement)
  if (input.q10_journey_stages && input.q10_journey_stages.length > 0) {
    // Take the highest scoring stage
    let maxScore = 0
    for (const stage of input.q10_journey_stages) {
      const option = JOURNEY_STAGE_OPTIONS.find(o => o.value === stage)
      if (option && option.score > maxScore) {
        maxScore = option.score
      }
    }
    breakdown.q10_score = maxScore
  }

  // Q11: Target Sectors (2-5)
  if (input.q11_target_sectors && input.q11_target_sectors.length > 0) {
    breakdown.q11_score = input.q11_target_sectors.length >= 3 ? 5 : 2
  }

  // Q12: Has Identified Targets (0 or 10)
  if (input.q12_has_identified_targets === true) {
    breakdown.q12_score = 10
  }

  // Q14: Investment Capacity (0-10)
  if (input.q14_investment_capacity) {
    const option = INVESTMENT_CAPACITY_OPTIONS.find(o => o.value === input.q14_investment_capacity)
    breakdown.q14_score = option?.score ?? 0
  }

  // Q15: Funding Status (1-3)
  if (input.q15_funding_status) {
    const option = FUNDING_STATUS_OPTIONS.find(o => o.value === input.q15_funding_status)
    breakdown.q15_score = option?.score ?? 0
  }

  // Q16: Network/Training (0-4)
  if (input.q16_network_training && input.q16_network_training.length > 0) {
    const hasAnyNetwork = input.q16_network_training.some(n => n !== "none")
    if (hasAnyNetwork) {
      breakdown.q16_score = 2
      // CRA gives extra points
      if (input.q16_network_training.includes("cra")) {
        breakdown.q16_score += 2
      }
    }
  }

  // Q17: Open to Co-acquisition (0 or 5)
  if (input.q17_open_to_co_acquisition === true) {
    breakdown.q17_score = 5
  }

  // Calculate total (rounded to integer for database storage)
  breakdown.total = Math.round(
    breakdown.q1_score +
    breakdown.q2_score +
    breakdown.q3_score +
    breakdown.q5_score +
    breakdown.q6_score +
    breakdown.q8_score +
    breakdown.q9_score +
    breakdown.q10_score +
    breakdown.q11_score +
    breakdown.q12_score +
    breakdown.q14_score +
    breakdown.q15_score +
    breakdown.q16_score +
    breakdown.q17_score
  )

  return breakdown
}

/**
 * Convert Tier 1 score to star rating (1-5)
 * This is different from Tier 2 stars - just for display purposes
 */
export function scoreToStarRating(score: number): number {
  if (score >= 70) return 5
  if (score >= 55) return 4
  if (score >= 40) return 3
  if (score >= 30) return 2
  return 1
}

/**
 * Get a text description for the score
 */
export function getScoreDescription(score: number): string {
  if (score >= 70) return "Excellent candidate"
  if (score >= 55) return "Strong candidate"
  if (score >= 40) return "Good candidate"
  if (score >= 30) return "Moderate candidate"
  return "Early stage candidate"
}
