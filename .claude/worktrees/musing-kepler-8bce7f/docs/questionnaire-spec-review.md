# Questionnaire Spec Review



## Questions

1. **Q11** — Intentionally missing or omitted from paste?
2. **Triangulation** — Matrix logic correct?
3. **Calculations** — Examples check out?
4. **General check** - Is all teh rest sas you expect? 

Once confirmed, we start building. 🏃‍♂️ 🏃‍♂️



---

## Two Scores, 100 Points Each

| Score | Measures | Questions |
|-------|----------|-----------|
| **WHO** | Profile & execution capacity | Q05 to Q10 |
| **WHEN** | Project maturity & thesis coherence | Q12 to Q16 |

---

## Q01 to Q04: Data Entry (0 points)

Assumed contact fields, no scoring:

| Q | Field |
|---|-------|
| Q01 | First name |
| Q02 | Last name |
| Q03 | Email |
| Q04 | Phone / LinkedIn |

**Confirm?**

---

## Q05 to Q10: WHO Score (0 to 100)

Simple sum of all answers.

| Q | Question | Options → Score |
|---|----------|-----------------|
| Q05 | Current status | Entrepreneur (5), Freelance (4), Employee (3), Transition (2), Other (1) |
| Q06 | Years experience | >20 yrs (15), 10-20 yrs (10), <10 yrs (5) |
| Q07 | Leadership / P&L | CEO/P&L (30), Mgmt >10 (20), Mgmt <10 (10), None (0) |
| Q08 | Crisis management | Multiple (20), Once (10), Never (0) |
| Q09 | Investment decisions | Both personal+pro (15), Personal (12), Pro (10), None (0) |
| Q10 | Lasting personal impact | Financial (15), Career (12), Limited (6), None (0) |

**Max = 5 + 15 + 30 + 20 + 15 + 15 = 100** ✓

---

## Q11: Missing?

Spec jumps from Q10 to Q12. **Intentional or omitted?**

---

## Q12 to Q16: WHEN Score (0 to 100)

These feed a formula, not simple addition.

| Q | Question | Type | Options |
|---|----------|------|---------|
| Q12 | Geographic zones | Multi | Regions FR, All France, Don't know |
| Q13 | Target sectors | Multi | Industry, Services, Healthcare, Other, Don't know |
| Q14 | Deal size | Multi | 1-3M, 3-5M, >5M, Don't know |
| Q15 | Capital structure | Multi | Solo, Fund minority, Fund majority, Haven't thought |
| Q16 | Equity contribution | Single | TBD, 151-250K, 251-350K, 351-450K, >450K |

---

## WHEN Formula

```
WHEN = (fit_financier + clarity + maturity) × 20
```

| Component | Points | Rule |
|-----------|--------|------|
| fit_financier | 0-2 | Triangulation Q14 × Q15 × Q16 (see below) |
| clarity | 0-2 | 0 if Q15 = "Haven't thought", else 2 |
| maturity | 0-1 | 1 if Q16 defined AND Q15 not "Haven't thought", else 0 |

**Max = (2 + 2 + 1) × 20 = 100** ✓

---

## Triangulation Matrix (Needs Validation)

Proposed logic: equity should be ~20-30% of deal, adjusted for fund involvement.

| Deal | Structure | GREEN (2) | AMBER (1) | RED (0) |
|------|-----------|-----------|-----------|---------|
| 1-3M | Solo | ≥251K | 151-250K | <150K / TBD |
| 1-3M | Fund minority | ≥151K | <150K | TBD only |
| 1-3M | Fund majority | Any defined | — | TBD only |
| 3-5M | Solo | ≥351K | 251-350K | <250K |
| 3-5M | Fund minority | ≥251K | 151-250K | <150K |
| 3-5M | Fund majority | ≥151K | <150K | TBD only |
| >5M | Solo | Not viable | ≥450K | <450K |
| >5M | Fund minority | ≥351K | 251-350K | <250K |
| >5M | Fund majority | ≥251K | 151-250K | <150K |

Multi-select: evaluate all combos, keep best result.

**Does this match your business reality?**

---

## Flags

| Flag | Trigger |
|------|---------|
| THESIS_NOT_COMPUTABLE | Q14, Q15, or Q16 missing |
| INCOHERENT_THESIS | RED fit with all pivots answered |
| GEO_UNKNOWN | Q12 = "Don't know" |
| SECTOR_UNKNOWN | Q13 = "Don't know" |

---

## Recommendations

| Condition | Action |
|-----------|--------|
| THESIS_NOT_COMPUTABLE or INCOHERENT_THESIS | Starter Pack (overrides scores) |
| WHEN ≥ 80, WHO ≥ 70 | Priority interview, advanced |
| WHEN ≥ 80, WHO < 70 | Priority interview, validate execution |
| WHEN 40-79 | Starter Pack + clarification call |
| WHEN ≤ 20 | Starter Pack, explorer profile |

---

## Example: WHO Calculation

| Q | Answer | Score |
|---|--------|-------|
| Q05 | Employee | 3 |
| Q06 | 15 years | 10 |
| Q07 | Mgmt >10 | 20 |
| Q08 | Once | 10 |
| Q09 | Pro only | 10 |
| Q10 | Limited | 6 |
| **Total** | | **59/100** |

---

## Example: WHEN Calculation

Candidate selects: 3-5M deal, Fund minority, 251-350K equity.

| Component | Calculation | Score |
|-----------|-------------|-------|
| fit_financier | 3-5M + Fund min + 251-350K = GREEN | 2 |
| clarity | Q15 is real answer | 2 |
| maturity | Q16 defined + Q15 not "Haven't thought" | 1 |
| **WHEN** | (2 + 2 + 1) × 20 | **100/100** |

---

