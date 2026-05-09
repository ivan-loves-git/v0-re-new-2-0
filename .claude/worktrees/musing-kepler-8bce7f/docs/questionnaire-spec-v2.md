# Re-New Questionnaire Specification v2

**Purpose:** Define the intake questionnaire for Re-New's repreneur qualification system.
**Status:** Draft - awaiting Bertrand's validation
**Last updated:** January 24, 2026

---

## Overview

The questionnaire produces two scores:

| Score | Measures | Questions | Max Points |
|-------|----------|-----------|------------|
| **WHO** | Profile quality and execution capacity | Q05 to Q10 | 100 |
| **WHEN** | Project maturity and financial coherence | Q12 to Q16 | 100 |

---

## Part 1: Contact Information (Q01-Q04)

No scoring. Data collection only.

| Q | Field | Required | Type |
|---|-------|----------|------|
| Q01 | Email | Yes | Email |
| Q02 | Phone | Yes | Phone |
| Q03 | CV | Yes | File upload |
| Q04 | LinkedIn URL | No | Text |

---

## Part 2: WHO Score (Q05-Q10)

**Scoring method:** Simple sum of all answers.
**Max score:** 100 points

### Q05: Current Status

**Question:** What is your current professional status?

| Option | Points |
|--------|--------|
| Entrepreneur / Business owner | 5 |
| Freelance / Independent | 4 |
| Employee | 3 |
| In professional transition | 2 |
| Other | 1 |

### Q06: Years of Experience

**Question:** How many years of professional experience do you have?

| Option | Points |
|--------|--------|
| More than 20 years | 15 |
| 10 to 20 years | 10 |
| Less than 10 years | 5 |

### Q07: Leadership Experience

**Question:** Have you held leadership or senior management positions?

| Option | Points |
|--------|--------|
| General management / Full P&L responsibility | 30 |
| Management of teams > 10 people | 20 |
| Management of teams < 10 people | 10 |
| No | 0 |

### Q08: Crisis Management

**Question:** Have you managed a situation of high complexity or crisis?

| Option | Points |
|--------|--------|
| Yes, multiple times | 20 |
| Yes, once | 10 |
| No | 0 |

### Q09: Investment Decisions

**Question:** Have you been involved in a significant investment decision? (e.g., M&A, acquisition)

| Option | Points |
|--------|--------|
| Yes, both personally and professionally | 15 |
| Yes, personally | 12 |
| Yes, professionally | 10 |
| No | 0 |

### Q10: Personal Impact Decisions

**Question:** Have you made a professional decision with direct and lasting personal impact?

| Option | Points |
|--------|--------|
| Yes, with significant personal financial impact (e.g., sustained income reduction, investment, guarantees) | 15 |
| Yes, with lasting impact on my professional trajectory (e.g., leaving a stable position, major sector change, expatriation) | 12 |
| Yes, with limited personal impact (e.g., role evolution without high exposure) | 6 |
| No | 0 |

### WHO Score Calculation

```
WHO = Q05 + Q06 + Q07 + Q08 + Q09 + Q10
Max = 5 + 15 + 30 + 20 + 15 + 15 = 100
```

---

## Part 3: Project Status (Q11) - Contributes to WHEN

**Question:** At this stage, where is your acquisition project?

| Option | Points |
|--------|--------|
| Discovery / I want to learn more | 0 |
| Exploratory phase / reflecting | 5 |
| Project framed (target and contribution defined) | 10 |
| Actively searching for targets | 15 |
| Advanced discussions (LOI in progress) | 20 |

**Type:** Multi-select (highest selected option counts)
**Max:** 20 points (contributes directly to WHEN score)

---

## Part 4: WHEN Score (Q12-Q16)

**Scoring method:** Formula based on 3 components.
**Max score:** 5 points

### Input Questions

#### Q12: Geographic Zones

**Question:** Priority geographic search zone(s)?
**Type:** Multi-select
**Options:** French regions + "All of France"

#### Q13: Target Sectors

**Question:** Which sector(s) are you targeting for your acquisition project?
**Type:** Multi-select
**Options:** All sectors, Retail/Distribution, Industry, Services, Construction, Healthcare, Tech/Digital, Environment, Hospitality, Transport/Logistics, Other

#### Q14: Deal Size

**Question:** Target deal size (equity value)?
**Type:** Multi-select
**Options:**
- 1-3 M
- 3-5 M
- More than 5 M

#### Q15: Capital Structure

**Question:** How do you envision the capital structure and your role?
**Type:** Multi-select
**Options:**
- Majority owner without fund
- Majority owner with minority fund
- Manager partnered with majority fund
- Haven't thought about it yet

#### Q16: Personal Equity Contribution

**Question:** What is your total personal contribution?
**Type:** Single-select
**Options:**
- Being evaluated / to be defined (TBD)
- 151-250 K
- 251-350 K
- 351-450 K
- More than 450 K

### WHEN Formula

```
WHEN = (fit_financier × 20) + (clarity × 20) + Q11_project_status
```

| Component | Raw | Final | Rule |
|-----------|-----|-------|------|
| fit_financier | 0-2 | 0-40 | Based on triangulation matrix (see below) |
| clarity | 0-2 | 0-40 | 2 = one structure selected (not "haven't thought"); 1 = two compatible options; 0 = contradiction or "haven't thought" |
| Q11_project_status | 0-20 | 0-20 | See Q11 scoring above (Discovery=0, LOI=20) |

```
Max WHEN = 40 + 40 + 20 = 100
```

---

## Triangulation Matrix (fit_financier)

Evaluates coherence between: **Deal Size x Capital Structure x Equity Contribution**

### 1-3 M Deals

| Structure | GREEN (2) | AMBER (1) | RED (0) |
|-----------|-----------|-----------|---------|
| Majority without fund | > 450 K | 251-350 K or 351-450 K | 151-250 K |
| Majority + minority fund | 251 K or more | 151-250 K | - |
| Majority fund | 151 K or more | - | - |

**Note:** Without fund = requires high contribution + credible debt capacity.

### 3-5 M Deals

| Structure | GREEN (2) | AMBER (1) | RED (0) |
|-----------|-----------|-----------|---------|
| Majority without fund | - | > 450 K (often to challenge) | 151-450 K |
| Majority + minority fund | 351 K or more | 251-350 K | 151-250 K |
| Majority fund | 351 K or more | 251-350 K | 151-250 K |

**Note:** Without fund = generally too tight beyond 3M.

### More than 5 M Deals

| Structure | GREEN (2) | AMBER (1) | RED (0) |
|-----------|-----------|-----------|---------|
| Majority without fund | - | - | Almost always incoherent |
| Majority + minority fund | > 450 K | 351-450 K | 151-350 K |
| Majority fund | 351 K or more | 251-350 K | 151-250 K |

**Note:** Without fund at > 5M = even 450 K rarely sufficient.

### Special Rules

- **"TBD" equity** = treated as RED (0)
- **Multi-select on Q14/Q15:** evaluate all combinations, keep the best result

---

## Flags (Warning Signals)

**FLAGS OVERRIDE SCORE-BASED RECOMMENDATIONS.**

If any flag is triggered, the repreneur is recommended for **Starter Pack** regardless of WHO/WHEN scores. Flags must be displayed prominently in the UI.

| Flag | Trigger | Why It's a Signal | Override Action |
|------|---------|-------------------|-----------------|
| F1 | High deal size (>5M) + equity "TBD" | Ambition not connected to means | → Starter Pack |
| F2 | "Majority owner" + "majority fund" both selected | Governance contradiction | → Starter Pack |
| F3 | Multiple structures selected OR "haven't thought" | Unclear on role/dilution | → Starter Pack |
| F4 | "Majority without fund" + equity ≤250K on 1-3M | Misunderstanding of requirements | → Starter Pack |
| F5 | Deal <1M with "majority fund" | LBO model doesn't apply | → Starter Pack |

---

## Part 5: Needs Assessment (Q17-Q18)

#### Q17: Current Needs

**Question:** In this type of project, what is your main need today?
**Type:** Multi-select
**Options:**
- Project launch / framing
- Access to acquisition opportunities
- Access to partners (lawyers, accountants)
- Financing research
- Other support

#### Q18: Investment Thesis Document

**Question:** Share your framing letter (lettre de cadrage)
**Type:** File upload
**Required:** No

---

## Score Interpretation and Recommendations

**Step 1: Check for flags**
If ANY flag is triggered → **Starter Pack** (skip score-based logic)

**Step 2: If no flags, use scores**

| WHO | WHEN | Profile | Recommended Action |
|-----|------|---------|-------------------|
| ≥70 | ≥80 | Strong + Framed | Priority interview, Deal Flow |
| ≥70 | 40-79 | Strong + Exploring | Interview, validate thesis |
| <70 | ≥80 | Weaker + Framed | Interview, validate execution |
| Any | <40 | Explorer | Starter Pack + clarification call |

---

## Pending: Triangulation Matrix Validation

**Bertrand to confirm this matrix is correct:**

| Deal Size | Structure | GREEN (2 pts) | AMBER (1 pt) | RED (0 pts) |
|-----------|-----------|---------------|--------------|-------------|
| 1-3 M | Solo (no fund) | > 450 K | 251-450 K | 151-250 K |
| 1-3 M | Majority + minority fund | 251 K+ | 151-250 K | — |
| 1-3 M | Majority fund | 151 K+ | — | — |
| 3-5 M | Solo (no fund) | — | > 450 K | 151-450 K |
| 3-5 M | Majority + minority fund | 351 K+ | 251-350 K | 151-250 K |
| 3-5 M | Majority fund | 351 K+ | 251-350 K | 151-250 K |
| > 5 M | Solo (no fund) | — | — | Always RED |
| > 5 M | Majority + minority fund | > 450 K | 351-450 K | 151-350 K |
| > 5 M | Majority fund | 351 K+ | 251-350 K | 151-250 K |

---

## Resolved Questions

- **Q11 scoring:** YES, contributes to WHEN (0-20 points based on project stage)
- **Flags override:** YES, any flag → Starter Pack regardless of scores
