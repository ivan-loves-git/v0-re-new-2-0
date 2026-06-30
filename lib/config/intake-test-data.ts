/**
 * Test data for quick form autofill during development/testing
 * Only shown when NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true
 */

import type { IntakeV2FormData } from '@/lib/types/intake-v2'

// Only show autofill when explicitly enabled (set NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true in .env.local)
export const SHOW_AUTOFILL = process.env.NEXT_PUBLIC_SHOW_TEST_AUTOFILL === 'true'

// Step 1: Contact Info
export const TEST_CONTACT_DATA: Partial<IntakeV2FormData> = {
  first_name: 'Jean-Pierre',
  last_name: 'Testeur',
  email: `test-${Date.now()}@example.com`, // Unique email each time
  phone: '+33 6 12 34 56 78',
  linkedin_url: 'https://linkedin.com/in/jptesteur',
}

// Step 2: WHO Questions (Q05-Q10)
export const TEST_WHO_DATA: Partial<IntakeV2FormData> = {
  q05_status: 'entrepreneur',        // 5 pts - Best
  q06_experience: 'more_than_20',    // 15 pts - Best
  q07_leadership: 'general_management', // 30 pts - Best
  q08_crisis: 'multiple',            // 20 pts - Best
  q09_investment: 'both',            // 15 pts - Best
  q10_impact: 'financial',           // 15 pts - Best
  // Total WHO: 100/100
}

// Step 3: Project Status (Q11)
export const TEST_PROJECT_STATUS_DATA: Partial<IntakeV2FormData> = {
  q11_priority_choice: 'preferred',             // 0 pts (no penalty)
  q11_project_status: ['searching', 'framed'],  // Highest = 15 pts
}

// Step 4: WHEN Questions (Q12-Q16)
export const TEST_WHEN_DATA: Partial<IntakeV2FormData> = {
  q12_geo_zones: ['ile_de_france', 'auvergne_rhone_alpes'],
  q13_target_sectors_v2: ['industrie', 'services_b2b'],
  q14_deal_size: ['1-3M'],           // Good for solo
  q15_structure: ['majority_without_fund'], // Solo majority
  q16_equity: '>450',                // Best equity = GREEN fit
  target_revenue_min_meur: 1.5,
  target_revenue_max_meur: 4,
  target_ebitda_margin_min_pct: 10,
  target_ebitda_margin_max_pct: 25,
  target_staff_size_min: 10,
  target_staff_size_max: 60,
  // Triangulation: 1-3M + solo + >450K = GREEN (2) = 40pts fit
  // Clarity: single structure = 40pts
  // Project: 15pts
  // Total WHEN: 95/100
}

// Step 5: Needs (Q17-Q18)
export const TEST_NEEDS_DATA: Partial<IntakeV2FormData> = {
  q17_current_needs: ['deal_flow', 'accompagnement_negociation'],
  marketing_consent: true,
}

// All steps combined for quick full-form fill
export const TEST_ALL_DATA: Partial<IntakeV2FormData> = {
  ...TEST_CONTACT_DATA,
  ...TEST_WHO_DATA,
  ...TEST_PROJECT_STATUS_DATA,
  ...TEST_WHEN_DATA,
  ...TEST_NEEDS_DATA,
}

// Alternative: Lower score profile for testing different outcomes
export const TEST_LOW_SCORE_DATA: Partial<IntakeV2FormData> = {
  first_name: 'Marie',
  last_name: 'Débutante',
  email: `test-low-${Date.now()}@example.com`,
  phone: '+33 6 99 88 77 66',
  q05_status: 'transition',          // 2 pts
  q06_experience: 'less_than_10',    // 5 pts
  q07_leadership: 'none',            // 0 pts
  q08_crisis: 'none',                // 0 pts
  q09_investment: 'none',            // 0 pts
  q10_impact: 'none',                // 0 pts
  // WHO: 7/100
  q11_priority_choice: 'one_among_others', // -10 WHEN penalty
  q11_project_status: ['discovery'], // 0 pts
  q12_geo_zones: ['bretagne'],
  q13_target_sectors_v2: ['commerce_detail'],
  q14_deal_size: ['>5M'],            // Big deal
  q15_structure: ['havent_thought'], // Flag F3!
  q16_equity: 'tbd',                 // Flag F1! (>5M + TBD)
  // WHEN: 0/100 + FLAGS
  q17_current_needs: ['formation'],
  marketing_consent: true,
}
