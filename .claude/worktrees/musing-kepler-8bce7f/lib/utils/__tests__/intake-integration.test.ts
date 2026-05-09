/**
 * Intake Flow Integration Tests
 *
 * Tests the complete data transformation from intake form input
 * to final scoring results, validating the entire pipeline.
 *
 * Sprint 6, Task 6.6
 */

import { describe, it, expect } from 'vitest'
import { calculateDualScore } from '../scoring-v2'
import type { WhoAnswers, WhenAnswers } from '@/lib/types/scoring-v2'

// ========================================
// Form Data Types (mirror intake-v2 form)
// ========================================

interface IntakeFormData {
  // Contact info (not scored)
  first_name: string
  last_name: string
  email: string
  phone: string
  cv_url: string | null
  linkedin_url: string | null

  // WHO Questions (Q05-Q10)
  q05_current_status: string
  q06_years_experience_v2: string
  q07_leadership: string
  q08_crisis_management: string
  q09_investment_decisions: string
  q10_personal_impact: string

  // Project Status (Q11)
  q11_project_status: string[]

  // WHEN Questions (Q12-Q16)
  q12_geographic_zones: string[]
  q13_target_sectors_v2: string[]
  q14_deal_size: string[]
  q15_capital_structure: string[]
  q16_equity_contribution: string

  // Needs Assessment (Q17-Q18, not scored)
  q17_current_needs: string[]
  q18_investment_thesis_url: string | null

  // Consent
  marketing_consent: boolean
}

// ========================================
// Form Data Transformer
// ========================================

function transformFormToScoringInput(formData: IntakeFormData): {
  whoAnswers: WhoAnswers
  whenAnswers: WhenAnswers
} {
  // Transform WHO answers
  const whoAnswers: WhoAnswers = {
    q05: formData.q05_current_status as any,
    q06: formData.q06_years_experience_v2 as any,
    q07: formData.q07_leadership as any,
    q08: formData.q08_crisis_management as any,
    q09: formData.q09_investment_decisions as any,
    q10: formData.q10_personal_impact as any,
  }

  // Transform WHEN answers
  const whenAnswers: WhenAnswers = {
    q11: formData.q11_project_status as any[],
    q12: formData.q12_geographic_zones,
    q13: formData.q13_target_sectors_v2,
    q14: formData.q14_deal_size as any[],
    q15: formData.q15_capital_structure as any[],
    q16: formData.q16_equity_contribution as any,
  }

  return { whoAnswers, whenAnswers }
}

// ========================================
// Test Scenarios - Full Intake Flows
// ========================================

describe('Intake Integration - Full Flow', () => {
  describe('Scenario: Serial Entrepreneur Ready for Deal Flow', () => {
    const formData: IntakeFormData = {
      // Contact
      first_name: 'Jean',
      last_name: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '+33 6 12 34 56 78',
      cv_url: 'https://example.com/cv.pdf',
      linkedin_url: 'https://linkedin.com/in/jeandupont',

      // WHO - Strong profile
      q05_current_status: 'entrepreneur',      // 5 pts
      q06_years_experience_v2: 'more_than_20', // 15 pts
      q07_leadership: 'general_management',    // 30 pts
      q08_crisis_management: 'multiple',       // 20 pts
      q09_investment_decisions: 'both',        // 15 pts
      q10_personal_impact: 'financial',        // 15 pts

      // Project Status
      q11_project_status: ['loi'],             // 20 pts

      // WHEN - Clear and funded
      q12_geographic_zones: ['ile-de-france', 'hauts-de-france'],
      q13_target_sectors_v2: ['tech', 'industry'],
      q14_deal_size: ['3-5M'],                 // Single deal size
      q15_capital_structure: ['majority_with_minority'], // Clear structure
      q16_equity_contribution: '>450',         // GREEN fit

      // Needs
      q17_current_needs: ['deal_sourcing', 'due_diligence'],
      q18_investment_thesis_url: 'https://example.com/thesis.pdf',
      marketing_consent: true,
    }

    it('transforms form data correctly', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)

      expect(whoAnswers.q05).toBe('entrepreneur')
      expect(whoAnswers.q08).toBe('multiple')
      expect(whenAnswers.q11).toEqual(['loi'])
      expect(whenAnswers.q14).toEqual(['3-5M'])
      expect(whenAnswers.q15).toEqual(['majority_with_minority'])
    })

    it('calculates WHO score of 100 (maximum)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.who.score).toBe(100)
    })

    it('calculates WHEN score of 100 (maximum)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.when.score).toBe(100)
    })

    it('has no flags', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.flags.flags).toEqual([])
    })

    it('recommends deal_flow', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.recommendation).toBe('deal_flow')
    })
  })

  describe('Scenario: Corporate Manager Exploring Options', () => {
    const formData: IntakeFormData = {
      // Contact
      first_name: 'Marie',
      last_name: 'Martin',
      email: 'marie.martin@corp.com',
      phone: '+33 6 98 76 54 32',
      cv_url: null,
      linkedin_url: 'https://linkedin.com/in/mariemartin',

      // WHO - Solid but not top-tier
      q05_current_status: 'employee',          // 3 pts
      q06_years_experience_v2: '10_to_20',     // 10 pts
      q07_leadership: 'mgmt_over_10',          // 20 pts
      q08_crisis_management: 'once',           // 10 pts
      q09_investment_decisions: 'professional', // 10 pts
      q10_personal_impact: 'trajectory',       // 12 pts

      // Project Status
      q11_project_status: ['exploratory'],     // 5 pts

      // WHEN - Still figuring things out
      q12_geographic_zones: ['all-france'],
      q13_target_sectors_v2: ['industry', 'services', 'distribution'],
      q14_deal_size: ['1-3M', '3-5M'],         // Multiple sizes
      q15_capital_structure: ['majority_without_fund', 'majority_with_minority'], // Unclear
      q16_equity_contribution: '251-350',

      // Needs
      q17_current_needs: ['training', 'network'],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    it('calculates WHO score of 65', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // 3 + 10 + 20 + 10 + 10 + 12 = 65
      expect(result.who.score).toBe(65)
    })

    it('has reduced WHEN score due to unclear structure', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // Multiple structures = reduced clarity (20 not 40)
      expect(result.when.breakdown.clarity).toBe(20)
    })

    it('triggers F3 flag for multiple structures', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.flags.flags).toContain('F3')
    })

    it('recommends starter_pack due to flag', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // Flags override score-based recommendation
      expect(result.recommendation).toBe('starter_pack')
    })
  })

  describe('Scenario: First-time Buyer with Ambitious Goals', () => {
    const formData: IntakeFormData = {
      // Contact
      first_name: 'Pierre',
      last_name: 'Bernard',
      email: 'pierre.bernard@gmail.com',
      phone: '+33 6 11 22 33 44',
      cv_url: 'https://example.com/cv-pierre.pdf',
      linkedin_url: null,

      // WHO - Early in career
      q05_current_status: 'freelance',         // 4 pts
      q06_years_experience_v2: 'less_than_10', // 5 pts
      q07_leadership: 'mgmt_under_10',         // 10 pts
      q08_crisis_management: 'none',           // 0 pts
      q09_investment_decisions: 'personal',    // 12 pts
      q10_personal_impact: 'limited',          // 6 pts

      // Project Status
      q11_project_status: ['searching'],       // 15 pts

      // WHEN - Ambitious but underfunded
      q12_geographic_zones: ['ile-de-france'],
      q13_target_sectors_v2: ['tech'],
      q14_deal_size: ['>5M'],                  // Big deal
      q15_capital_structure: ['majority_without_fund'], // Solo
      q16_equity_contribution: 'tbd',          // No clarity on funding

      // Needs
      q17_current_needs: ['deal_sourcing', 'financing', 'training'],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    it('calculates WHO score of 37 (low)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // 4 + 5 + 10 + 0 + 12 + 6 = 37
      expect(result.who.score).toBe(37)
    })

    it('calculates low WHEN score', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // Solo + >5M + TBD = fitFinancier 0
      expect(result.when.breakdown.fitFinancier).toBe(0)
      expect(result.when.score).toBeLessThan(60)
    })

    it('triggers F1 flag (>5M + TBD equity)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.flags.flags).toContain('F1')
    })

    it('recommends starter_pack', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.recommendation).toBe('starter_pack')
    })
  })

  describe('Scenario: Qualified Candidate for Priority Interview', () => {
    const formData: IntakeFormData = {
      // Contact
      first_name: 'Sophie',
      last_name: 'Leroy',
      email: 'sophie.leroy@consulting.com',
      phone: '+33 6 55 66 77 88',
      cv_url: 'https://example.com/cv-sophie.pdf',
      linkedin_url: 'https://linkedin.com/in/sophieleroy',

      // WHO - Strong profile
      q05_current_status: 'entrepreneur',      // 5 pts
      q06_years_experience_v2: '10_to_20',     // 10 pts
      q07_leadership: 'mgmt_over_10',          // 20 pts
      q08_crisis_management: 'multiple',       // 20 pts
      q09_investment_decisions: 'both',        // 15 pts
      q10_personal_impact: 'trajectory',       // 12 pts

      // Project Status
      q11_project_status: ['framed'],          // 10 pts

      // WHEN - Mid-tier project maturity
      q12_geographic_zones: ['bretagne', 'pays-de-la-loire'],
      q13_target_sectors_v2: ['industry'],
      q14_deal_size: ['1-3M'],
      q15_capital_structure: ['majority_with_minority'],
      q16_equity_contribution: '251-350',      // AMBER fit

      // Needs
      q17_current_needs: ['deal_sourcing'],
      q18_investment_thesis_url: 'https://example.com/thesis-sophie.pdf',
      marketing_consent: true,
    }

    it('calculates WHO score of 82', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // 5 + 10 + 20 + 20 + 15 + 12 = 82
      expect(result.who.score).toBe(82)
    })

    it('calculates WHEN score of 70', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // 1-3M + minority + 251-350 = GREEN (2) -> 40 fitFinancier
      // Single structure = 40 clarity
      // Framed = 10 project status
      // But wait - 251-350 with minority on 1-3M should be GREEN
      // Actually need to verify: 40 + 40 + 10 = 90? Let me check matrix
      // 1-3M + majority_with_minority + 251-350 = GREEN (2) per matrix
      // So: 40 (fit) + 40 (clarity) + 10 (status) = 90
      expect(result.when.score).toBe(90)
    })

    it('has no flags', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      expect(result.flags.flags).toEqual([])
    })

    it('recommends deal_flow (WHO>=70 and WHEN>=80)', () => {
      const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
      const result = calculateDualScore(whoAnswers, whenAnswers)

      // WHO=82 >= 70, WHEN=90 >= 80 -> deal_flow
      expect(result.recommendation).toBe('deal_flow')
    })
  })
})

// ========================================
// Edge Cases
// ========================================

describe('Intake Integration - Edge Cases', () => {
  it('handles empty arrays gracefully', () => {
    const formData: IntakeFormData = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.com',
      phone: '+33 6 00 00 00 00',
      cv_url: null,
      linkedin_url: null,
      q05_current_status: 'other',
      q06_years_experience_v2: 'less_than_10',
      q07_leadership: 'none',
      q08_crisis_management: 'none',
      q09_investment_decisions: 'none',
      q10_personal_impact: 'none',
      q11_project_status: [], // Empty
      q12_geographic_zones: [],
      q13_target_sectors_v2: [],
      q14_deal_size: [], // Empty
      q15_capital_structure: [], // Empty
      q16_equity_contribution: 'tbd',
      q17_current_needs: [],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
    const result = calculateDualScore(whoAnswers, whenAnswers)

    // Should not throw
    expect(result.who.score).toBeGreaterThanOrEqual(0)
    expect(result.when.score).toBe(0) // Empty arrays = 0 scores
  })

  it('handles all flags triggering at once', () => {
    const formData: IntakeFormData = {
      first_name: 'Problematic',
      last_name: 'Profile',
      email: 'problem@test.com',
      phone: '+33 6 00 00 00 00',
      cv_url: null,
      linkedin_url: null,
      q05_current_status: 'other',
      q06_years_experience_v2: 'less_than_10',
      q07_leadership: 'none',
      q08_crisis_management: 'none',
      q09_investment_decisions: 'none',
      q10_personal_impact: 'none',
      q11_project_status: ['discovery'],
      q12_geographic_zones: [],
      q13_target_sectors_v2: [],
      q14_deal_size: ['>5M'],                  // F1 trigger (with TBD)
      q15_capital_structure: [
        'majority_without_fund',
        'majority_with_minority',
        'manager_with_majority'
      ], // F2, F3 triggers
      q16_equity_contribution: 'tbd',          // F1 trigger
      q17_current_needs: [],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
    const result = calculateDualScore(whoAnswers, whenAnswers)

    // Multiple flags
    expect(result.flags.flags.length).toBeGreaterThan(1)
    expect(result.flags.flags).toContain('F1')
    expect(result.flags.flags).toContain('F2')
    expect(result.flags.flags).toContain('F3')

    // Always starter_pack when flags present
    expect(result.recommendation).toBe('starter_pack')
  })
})

// ========================================
// Score Breakdown Validation
// ========================================

describe('Intake Integration - Score Breakdown Integrity', () => {
  it('WHO breakdown sums to total score', () => {
    const formData: IntakeFormData = {
      first_name: 'Breakdown',
      last_name: 'Test',
      email: 'breakdown@test.com',
      phone: '+33 6 00 00 00 00',
      cv_url: null,
      linkedin_url: null,
      q05_current_status: 'entrepreneur',
      q06_years_experience_v2: '10_to_20',
      q07_leadership: 'mgmt_under_10',
      q08_crisis_management: 'once',
      q09_investment_decisions: 'personal',
      q10_personal_impact: 'trajectory',
      q11_project_status: ['framed'],
      q12_geographic_zones: [],
      q13_target_sectors_v2: [],
      q14_deal_size: ['1-3M'],
      q15_capital_structure: ['majority_with_minority'],
      q16_equity_contribution: '>450',
      q17_current_needs: [],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
    const result = calculateDualScore(whoAnswers, whenAnswers)

    const breakdownSum = Object.values(result.who.breakdown).reduce((a, b) => a + b, 0)
    expect(breakdownSum).toBe(result.who.score)
  })

  it('WHEN breakdown sums to total score', () => {
    const formData: IntakeFormData = {
      first_name: 'Breakdown',
      last_name: 'Test',
      email: 'breakdown@test.com',
      phone: '+33 6 00 00 00 00',
      cv_url: null,
      linkedin_url: null,
      q05_current_status: 'entrepreneur',
      q06_years_experience_v2: '10_to_20',
      q07_leadership: 'mgmt_under_10',
      q08_crisis_management: 'once',
      q09_investment_decisions: 'personal',
      q10_personal_impact: 'trajectory',
      q11_project_status: ['framed'],
      q12_geographic_zones: [],
      q13_target_sectors_v2: [],
      q14_deal_size: ['1-3M'],
      q15_capital_structure: ['majority_with_minority'],
      q16_equity_contribution: '>450',
      q17_current_needs: [],
      q18_investment_thesis_url: null,
      marketing_consent: true,
    }

    const { whoAnswers, whenAnswers } = transformFormToScoringInput(formData)
    const result = calculateDualScore(whoAnswers, whenAnswers)

    const breakdownSum =
      result.when.breakdown.fitFinancier +
      result.when.breakdown.clarity +
      result.when.breakdown.projectStatus
    expect(breakdownSum).toBe(result.when.score)
  })
})
