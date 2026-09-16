import { describe, expect, it } from 'vitest'
import { validatePlan, digest, EXPECTED_KINDS } from '../../scripts/pursuit-v4-clarifications.mjs'

const plan = () => ({ sourceReference: 'https://re-newplatform.slack.com/archives/C0BRS8B1NF4/p1234567890', rows: [...EXPECTED_KINDS].map(([sourceRow,kind]) => ({ sourceRow,kind,...(['linked_history','reopened'].includes(kind) ? {targetReference:`Synthetic-${sourceRow}`} : {}) })) })

describe('bounded pursuit clarification approval', () => {
  it('accepts only the complete explicit treatment, without choosing identities', () => {
    expect(() => validatePlan(plan())).not.toThrow()
    expect(() => validatePlan({...plan(),rows:plan().rows.slice(1)})).toThrow('complete_16_row_plan_required')
  })
  it('rejects duplicate rows, changed confidential treatment and missing targets', () => {
    const duplicate = plan(); duplicate.rows[1] = duplicate.rows[0]
    expect(() => validatePlan(duplicate)).toThrow('duplicate_source_row')
    const confidential = plan(); confidential.rows.find(r => r.sourceRow === 71)!.kind = 'external_history'
    expect(() => validatePlan(confidential)).toThrow('unexpected_row_or_treatment')
    const target = plan(); delete target.rows.find(r => r.sourceRow === 41)!.targetReference
    expect(() => validatePlan(target)).toThrow('target_reference_invalid')
  })
  it('rejects source provenance outside the original staff thread channel', () => {
    expect(() => validatePlan({...plan(),sourceReference:'https://example.org/source'})).toThrow('source_reference_required')
  })
  it('keeps the approval digest stable through PostgreSQL JSONB key ordering', () => {
    expect(digest({z:1,a:{y:2,x:3}})).toBe(digest({a:{x:3,y:2},z:1}))
    expect(digest({rows:[1,2]})).not.toBe(digest({rows:[2,1]}))
  })
})
