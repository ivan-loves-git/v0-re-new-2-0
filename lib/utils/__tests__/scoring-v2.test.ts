/**
 * WHO/WHEN Dual Scoring System - Test Suite
 *
 * Tests based on questionnaire-spec-v2.md
 */

import { describe, it, expect } from 'vitest'
import {
  calculateWhoScore,
  calculateWhenScore,
  calculateTriangulation,
  detectFlags,
  getRecommendedAction,
  calculateDualScore
} from '../scoring-v2'
import type {
  WhoAnswers,
  WhenAnswers,
  Q14DealSize,
  Q15Structure,
  Q16Equity
} from '@/lib/types/scoring-v2'

// ========================================
// WHO Score Tests
// ========================================

describe('WHO Score Calculation', () => {
  it('calculates maximum score (100)', () => {
    const answers: WhoAnswers = {
      q05: 'entrepreneur',    // 5
      q06: 'more_than_20',    // 15
      q07: 'general_management', // 30
      q08: 'multiple',        // 20
      q09: 'both',            // 15
      q10: 'financial'        // 15
    }

    const result = calculateWhoScore(answers)

    expect(result.score).toBe(100)
    expect(result.breakdown).toEqual({
      q05: 5,
      q06: 15,
      q07: 30,
      q08: 20,
      q09: 15,
      q10: 15
    })
  })

  it('calculates minimum score (6)', () => {
    const answers: WhoAnswers = {
      q05: 'other',           // 1
      q06: 'less_than_10',    // 5
      q07: 'none',            // 0
      q08: 'none',            // 0
      q09: 'none',            // 0
      q10: 'none'             // 0
    }

    const result = calculateWhoScore(answers)

    expect(result.score).toBe(6)
    expect(result.breakdown).toEqual({
      q05: 1,
      q06: 5,
      q07: 0,
      q08: 0,
      q09: 0,
      q10: 0
    })
  })

  it('calculates typical mid-range score (59)', () => {
    // Employee(3) + 10-20yrs(10) + Mgmt>10(20) + Once(10) + Pro(10) + Limited(6) = 59
    const answers: WhoAnswers = {
      q05: 'employee',        // 3
      q06: '10_to_20',        // 10
      q07: 'mgmt_over_10',    // 20
      q08: 'once',            // 10
      q09: 'professional',    // 10
      q10: 'limited'          // 6
    }

    const result = calculateWhoScore(answers)

    expect(result.score).toBe(59)
  })

  it('calculates freelancer with strong experience (74)', () => {
    const answers: WhoAnswers = {
      q05: 'freelance',       // 4
      q06: 'more_than_20',    // 15
      q07: 'mgmt_over_10',    // 20
      q08: 'multiple',        // 20
      q09: 'both',            // 15
      q10: 'none'             // 0
    }

    const result = calculateWhoScore(answers)

    expect(result.score).toBe(74)
  })
})

// ========================================
// Triangulation Matrix Tests
// ========================================

describe('Triangulation Matrix', () => {
  describe('1-3M Deals', () => {
    it('solo + >450K = GREEN (2)', () => {
      const result = calculateTriangulation(['1-3M'], ['majority_without_fund'], '>450')
      expect(result).toBe(2)
    })

    it('solo + 151-250K = RED (0)', () => {
      const result = calculateTriangulation(['1-3M'], ['majority_without_fund'], '151-250')
      expect(result).toBe(0)
    })

    it('solo + 251-350K = AMBER (1)', () => {
      const result = calculateTriangulation(['1-3M'], ['majority_without_fund'], '251-350')
      expect(result).toBe(1)
    })

    it('minority fund + 151-250K = AMBER (1)', () => {
      const result = calculateTriangulation(['1-3M'], ['majority_with_minority'], '151-250')
      expect(result).toBe(1)
    })

    it('majority fund + 151-250K = GREEN (2)', () => {
      const result = calculateTriangulation(['1-3M'], ['manager_with_majority'], '151-250')
      expect(result).toBe(2)
    })
  })

  describe('3-5M Deals', () => {
    it('solo + >450K = AMBER (1) - solo risky at this size', () => {
      const result = calculateTriangulation(['3-5M'], ['majority_without_fund'], '>450')
      expect(result).toBe(1)
    })

    it('solo + 351-450K = RED (0)', () => {
      const result = calculateTriangulation(['3-5M'], ['majority_without_fund'], '351-450')
      expect(result).toBe(0)
    })

    it('minority fund + 351-450K = GREEN (2)', () => {
      const result = calculateTriangulation(['3-5M'], ['majority_with_minority'], '351-450')
      expect(result).toBe(2)
    })

    it('minority fund + 251-350K = AMBER (1)', () => {
      const result = calculateTriangulation(['3-5M'], ['majority_with_minority'], '251-350')
      expect(result).toBe(1)
    })

    it('minority fund + 151-250K = RED (0)', () => {
      const result = calculateTriangulation(['3-5M'], ['majority_with_minority'], '151-250')
      expect(result).toBe(0)
    })
  })

  describe('>5M Deals', () => {
    it('solo + any equity = RED (0) - always incoherent', () => {
      expect(calculateTriangulation(['>5M'], ['majority_without_fund'], '>450')).toBe(0)
      expect(calculateTriangulation(['>5M'], ['majority_without_fund'], '351-450')).toBe(0)
      expect(calculateTriangulation(['>5M'], ['majority_without_fund'], '251-350')).toBe(0)
    })

    it('minority fund + >450K = GREEN (2)', () => {
      const result = calculateTriangulation(['>5M'], ['majority_with_minority'], '>450')
      expect(result).toBe(2)
    })

    it('minority fund + 351-450K = AMBER (1)', () => {
      const result = calculateTriangulation(['>5M'], ['majority_with_minority'], '351-450')
      expect(result).toBe(1)
    })

    it('minority fund + 251-350K = RED (0)', () => {
      const result = calculateTriangulation(['>5M'], ['majority_with_minority'], '251-350')
      expect(result).toBe(0)
    })

    it('majority fund + 251-350K = AMBER (1)', () => {
      const result = calculateTriangulation(['>5M'], ['manager_with_majority'], '251-350')
      expect(result).toBe(1)
    })

    it('majority fund + 351-450K = GREEN (2)', () => {
      const result = calculateTriangulation(['>5M'], ['manager_with_majority'], '351-450')
      expect(result).toBe(2)
    })
  })

  describe('Special Cases', () => {
    it('TBD equity always = RED (0)', () => {
      expect(calculateTriangulation(['1-3M'], ['majority_without_fund'], 'tbd')).toBe(0)
      expect(calculateTriangulation(['1-3M'], ['majority_with_minority'], 'tbd')).toBe(0)
      expect(calculateTriangulation(['3-5M'], ['manager_with_majority'], 'tbd')).toBe(0)
    })

    it('havent_thought structure = RED (0)', () => {
      const result = calculateTriangulation(['1-3M'], ['havent_thought'], '>450')
      expect(result).toBe(0)
    })

    it('multi-select returns best score', () => {
      // Testing multiple deal sizes - should return the best combination
      const result = calculateTriangulation(
        ['1-3M', '3-5M'],
        ['majority_with_minority'],
        '351-450'
      )
      // 1-3M + minority + 351-450 = GREEN (2)
      // 3-5M + minority + 351-450 = GREEN (2)
      expect(result).toBe(2)
    })

    it('multi-select structures returns best score', () => {
      // Solo + minority fund - should use the better option
      const result = calculateTriangulation(
        ['1-3M'],
        ['majority_without_fund', 'majority_with_minority'],
        '251-350'
      )
      // Solo + 251-350 = AMBER (1)
      // Minority + 251-350 = GREEN (2)
      expect(result).toBe(2)
    })

    it('empty deal sizes = RED (0)', () => {
      const result = calculateTriangulation([], ['majority_with_minority'], '>450')
      expect(result).toBe(0)
    })

    it('empty structures = RED (0)', () => {
      const result = calculateTriangulation(['1-3M'], [], '>450')
      expect(result).toBe(0)
    })

    it('only havent_thought in structures = RED (0)', () => {
      const result = calculateTriangulation(['1-3M'], ['havent_thought'], '>450')
      expect(result).toBe(0)
    })
  })
})

// ========================================
// WHEN Score Tests
// ========================================

describe('WHEN Score Calculation', () => {
  it('calculates maximum score (100)', () => {
    // Green fit + clear structure + LOI = 40 + 40 + 20 = 100
    const answers: WhenAnswers = {
      q11: ['loi'],                        // 20 pts
      q12: ['ile-de-france'],              // No scoring
      q13: ['tech'],                       // No scoring
      q14: ['1-3M'],                       // For triangulation
      q15: ['manager_with_majority'],      // Single clear structure (clarity=40)
      q16: '>450'                          // GREEN fit (40)
    }

    const result = calculateWhenScore(answers)

    expect(result.score).toBe(100)
    expect(result.breakdown).toEqual({
      fitFinancier: 40,
      clarity: 40,
      projectStatus: 20,
      penalties: 0
    })
  })

  it('calculates minimum score (0)', () => {
    // TBD equity + havent thought + discovery = 0 + 0 + 0 = 0
    const answers: WhenAnswers = {
      q11: ['discovery'],
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['havent_thought'],
      q16: 'tbd'
    }

    const result = calculateWhenScore(answers)

    expect(result.score).toBe(0)
    expect(result.breakdown).toEqual({
      fitFinancier: 0,
      clarity: 0,
      projectStatus: 0,
      penalties: 0
    })
  })

  it('applies v3 penalties when priority data is present', () => {
    const answers: WhenAnswers = {
      q11: ['framed'],
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['majority_without_fund'],
      q16: 'tbd',
      q11_priority: 'one_among_others',
      hasFicheDeCadrage: false
    }

    const result = calculateWhenScore(answers)

    expect(result.breakdown.penalties).toBe(-30)
    expect(result.score).toBe(20)
  })

  it('havent_thought structure = 0 clarity', () => {
    const answers: WhenAnswers = {
      q11: ['loi'],                   // 20
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['havent_thought'],        // clarity = 0
      q16: '>450'                     // Would be GREEN but structure invalid
    }

    const result = calculateWhenScore(answers)

    // fitFinancier = 0 (havent_thought filtered out)
    // clarity = 0
    // projectStatus = 20
    expect(result.score).toBe(20)
    expect(result.breakdown.clarity).toBe(0)
  })

  it('multiple structures reduces clarity', () => {
    const answers: WhenAnswers = {
      q11: ['framed'],                // 10
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['majority_without_fund', 'majority_with_minority'], // 2 options
      q16: '>450'
    }

    const result = calculateWhenScore(answers)

    // fitFinancier = 40 (best of combinations)
    // clarity = 20 (two compatible options)
    // projectStatus = 10
    expect(result.breakdown.clarity).toBe(20)
  })

  it('Q11 uses highest selected option', () => {
    // Multiple project statuses selected - highest counts
    const answers: WhenAnswers = {
      q11: ['discovery', 'exploratory', 'framed'], // 0, 5, 10 - highest = 10
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['manager_with_majority'],
      q16: '>450'
    }

    const result = calculateWhenScore(answers)

    expect(result.breakdown.projectStatus).toBe(10)
  })

  it('empty Q11 = 0 project status', () => {
    const answers: WhenAnswers = {
      q11: [],
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['manager_with_majority'],
      q16: '>450'
    }

    const result = calculateWhenScore(answers)

    expect(result.breakdown.projectStatus).toBe(0)
  })

  it('mid-range score example (80)', () => {
    // Amber fit + clear + LOI = 20 + 40 + 20 = 80
    const answers: WhenAnswers = {
      q11: ['loi'],                        // 20
      q12: [],
      q13: [],
      q14: ['3-5M'],
      q15: ['majority_with_minority'],     // Single (clarity=40)
      q16: '251-350'                       // AMBER (1) -> 20
    }

    const result = calculateWhenScore(answers)

    expect(result.score).toBe(80)
  })
})

// ========================================
// Flag Detection Tests
// ========================================

describe('Flag Detection', () => {
  const baseAnswers: WhenAnswers = {
    q11: ['framed'],
    q12: [],
    q13: [],
    q14: ['1-3M'],
    q15: ['majority_with_minority'],
    q16: '>450'
  }

  it('no flags when all selections valid', () => {
    const result = detectFlags(baseAnswers)
    expect(result.flags).toEqual([])
  })

  it('F1 triggers with >5M + TBD equity', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['>5M'],
      q16: 'tbd'
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F1')
  })

  it('F1 does not trigger with >5M + defined equity', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['>5M'],
      q16: '>450'
    }

    const result = detectFlags(answers)

    expect(result.flags).not.toContain('F1')
  })

  it('F2 triggers with majority owner + majority fund', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q15: ['majority_without_fund', 'manager_with_majority']
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F2')
  })

  it('F2 triggers with minority fund + majority fund', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q15: ['majority_with_minority', 'manager_with_majority']
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F2')
  })

  it('F3 triggers with havent_thought', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q15: ['havent_thought']
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F3')
  })

  it('F3 triggers with 2+ structures selected', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q15: ['majority_without_fund', 'majority_with_minority']
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F3')
  })

  it('F3 does not trigger with single valid structure', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q15: ['majority_with_minority']
    }

    const result = detectFlags(answers)

    expect(result.flags).not.toContain('F3')
  })

  it('F4 triggers with solo + 1-3M + 151-250K', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['1-3M'],
      q15: ['majority_without_fund'],
      q16: '151-250'
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F4')
  })

  it('F4 triggers with solo + 1-3M + TBD', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['1-3M'],
      q15: ['majority_without_fund'],
      q16: 'tbd'
    }

    const result = detectFlags(answers)

    expect(result.flags).toContain('F4')
  })

  it('F4 does not trigger with higher equity', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['1-3M'],
      q15: ['majority_without_fund'],
      q16: '251-350'
    }

    const result = detectFlags(answers)

    expect(result.flags).not.toContain('F4')
  })

  it('F4 does not trigger with multiple deal sizes', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['1-3M', '3-5M'], // Not "only" 1-3M
      q15: ['majority_without_fund'],
      q16: '151-250'
    }

    const result = detectFlags(answers)

    expect(result.flags).not.toContain('F4')
  })

  it('multiple flags can be triggered', () => {
    const answers: WhenAnswers = {
      ...baseAnswers,
      q14: ['>5M'],
      q15: ['majority_without_fund', 'manager_with_majority'],
      q16: 'tbd'
    }

    const result = detectFlags(answers)

    // F1: >5M + TBD
    // F2: majority owner + majority fund
    // F3: multiple structures
    expect(result.flags).toContain('F1')
    expect(result.flags).toContain('F2')
    expect(result.flags).toContain('F3')
    expect(result.flags.length).toBe(3)
  })

  it('provides flag descriptions', () => {
    const result = detectFlags(baseAnswers)

    expect(result.descriptions.F1).toBeDefined()
    expect(result.descriptions.F2).toBeDefined()
    expect(result.descriptions.F3).toBeDefined()
    expect(result.descriptions.F4).toBeDefined()
    expect(result.descriptions.F5).toBeDefined()
  })
})

// ========================================
// Recommendation Tests
// ========================================

describe('Recommendation Logic', () => {
  it('any flag -> starter_pack', () => {
    expect(getRecommendedAction(90, 90, ['F1'])).toBe('starter_pack')
    expect(getRecommendedAction(80, 85, ['F3'])).toBe('starter_pack')
    expect(getRecommendedAction(100, 100, ['F2', 'F3'])).toBe('starter_pack')
  })

  it('WHO≥70 + WHEN≥80 -> deal_flow', () => {
    expect(getRecommendedAction(70, 80, [])).toBe('deal_flow')
    expect(getRecommendedAction(80, 90, [])).toBe('deal_flow')
    expect(getRecommendedAction(100, 100, [])).toBe('deal_flow')
  })

  it('WHO≥70 + WHEN 40-79 -> priority_interview', () => {
    expect(getRecommendedAction(70, 40, [])).toBe('priority_interview')
    expect(getRecommendedAction(75, 50, [])).toBe('priority_interview')
    expect(getRecommendedAction(80, 79, [])).toBe('priority_interview')
  })

  it('WHO<70 + WHEN≥80 -> interview', () => {
    expect(getRecommendedAction(60, 80, [])).toBe('interview')
    expect(getRecommendedAction(69, 85, [])).toBe('interview')
    expect(getRecommendedAction(50, 100, [])).toBe('interview')
  })

  it('WHEN<40 -> starter_pack', () => {
    expect(getRecommendedAction(90, 39, [])).toBe('starter_pack')
    expect(getRecommendedAction(50, 30, [])).toBe('starter_pack')
    expect(getRecommendedAction(100, 0, [])).toBe('starter_pack')
  })

  it('low scores -> starter_pack', () => {
    expect(getRecommendedAction(50, 50, [])).toBe('starter_pack')
    expect(getRecommendedAction(60, 60, [])).toBe('starter_pack')
    expect(getRecommendedAction(69, 79, [])).toBe('starter_pack')
  })

  it('boundary cases', () => {
    // Exactly at threshold
    expect(getRecommendedAction(70, 80, [])).toBe('deal_flow')
    expect(getRecommendedAction(69, 80, [])).toBe('interview')
    expect(getRecommendedAction(70, 79, [])).toBe('priority_interview')
    expect(getRecommendedAction(70, 39, [])).toBe('starter_pack')
  })
})

// ========================================
// Integration Tests
// ========================================

describe('Integration - calculateDualScore', () => {
  it('full intake scenario: strong profile + framed project', () => {
    const whoAnswers: WhoAnswers = {
      q05: 'entrepreneur',
      q06: 'more_than_20',
      q07: 'general_management',
      q08: 'multiple',
      q09: 'both',
      q10: 'financial'
    }

    const whenAnswers: WhenAnswers = {
      q11: ['loi'],
      q12: ['ile-de-france'],
      q13: ['tech'],
      q14: ['1-3M'],
      q15: ['majority_with_minority'],
      q16: '>450'
    }

    const result = calculateDualScore(whoAnswers, whenAnswers)

    expect(result.who.score).toBe(100)
    expect(result.when.score).toBe(100)
    expect(result.flags.flags).toEqual([])
    expect(result.recommendation).toBe('deal_flow')
  })

  it('full intake scenario: weak profile + exploring', () => {
    const whoAnswers: WhoAnswers = {
      q05: 'employee',
      q06: 'less_than_10',
      q07: 'none',
      q08: 'none',
      q09: 'none',
      q10: 'none'
    }

    const whenAnswers: WhenAnswers = {
      q11: ['discovery'],
      q12: [],
      q13: [],
      q14: ['1-3M'],
      q15: ['havent_thought'],
      q16: 'tbd'
    }

    const result = calculateDualScore(whoAnswers, whenAnswers)

    expect(result.who.score).toBe(8) // 3+5+0+0+0+0
    expect(result.when.score).toBe(0)
    expect(result.flags.flags).toContain('F3') // havent_thought
    expect(result.recommendation).toBe('starter_pack')
  })

  it('full intake scenario: strong profile but unclear financials', () => {
    const whoAnswers: WhoAnswers = {
      q05: 'entrepreneur',
      q06: 'more_than_20',
      q07: 'mgmt_over_10',
      q08: 'multiple',
      q09: 'both',
      q10: 'trajectory'
    }

    const whenAnswers: WhenAnswers = {
      q11: ['searching'],
      q12: ['all-france'],
      q13: ['industry'],
      q14: ['>5M'],
      q15: ['manager_with_majority'],
      q16: 'tbd'
    }

    const result = calculateDualScore(whoAnswers, whenAnswers)

    expect(result.who.score).toBe(87) // 5+15+20+20+15+12 = 87
    expect(result.flags.flags).toContain('F1') // >5M + TBD
    expect(result.recommendation).toBe('starter_pack') // Flags override
  })

  it('returns all required fields', () => {
    const whoAnswers: WhoAnswers = {
      q05: 'employee',
      q06: '10_to_20',
      q07: 'mgmt_under_10',
      q08: 'once',
      q09: 'professional',
      q10: 'limited'
    }

    const whenAnswers: WhenAnswers = {
      q11: ['framed'],
      q12: [],
      q13: [],
      q14: ['3-5M'],
      q15: ['majority_with_minority'],
      q16: '351-450'
    }

    const result = calculateDualScore(whoAnswers, whenAnswers)

    // Verify structure
    expect(result).toHaveProperty('who')
    expect(result).toHaveProperty('when')
    expect(result).toHaveProperty('flags')
    expect(result).toHaveProperty('recommendation')

    expect(result.who).toHaveProperty('score')
    expect(result.who).toHaveProperty('breakdown')

    expect(result.when).toHaveProperty('score')
    expect(result.when).toHaveProperty('breakdown')

    expect(result.flags).toHaveProperty('flags')
    expect(result.flags).toHaveProperty('descriptions')
  })
})
