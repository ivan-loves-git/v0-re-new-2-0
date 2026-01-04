# CV Extraction Fields & Scoring Criteria

**Platform:** AI Recruitment Platform (archived)
**Purpose:** Document the specific fields extracted from candidate CVs and scoring logic
**Source:** Meeting transcript (Oct 2024) - Ivan platform demonstration

---

## Overview

The AI platform used **8 independent AI bots** to analyze candidate CVs and extract structured data. Each bot focused on specific dimensions of candidate fit for Re-New's repreneur program.

**Scoring approach:**
- Single-selection fields (yes/no, categorical)
- Numeric thresholds (e.g., "4+ companies")
- Weighted scoring (each selection has associated points)
- Cumulative score → Star rating (0-5 stars)

---

## Extracted Fields & Scoring Logic

### 1. Distressed Company Management Experience

**Question:** Has the candidate managed a distressed company?

**Options:**
- ☐ Yes (Score: **TBD**)
- ☐ No (Score: **0**)

**Example from meeting:**
> "Ian doesn't have managed any distress company" → Score: 0

**Rationale:** Experience in turnaround situations indicates ability to handle high-pressure, complex challenges typical in acquisitions.

**AI extraction approach:** Keyword detection (restructuring, turnaround, distressed, bankruptcy, recovery, crisis management) + context analysis

---

### 2. Number of Companies in Career

**Question:** How many different companies has the candidate worked for?

**Options:**
- ☐ 1 company (Score: **TBD**)
- ☐ 2-3 companies (Score: **TBD**)
- ☐ 4+ companies (Score: **Higher**)

**Example from meeting:**
> "Has been in 4 or more companies" → Higher score

**Rationale:** Exposure to multiple organizations indicates adaptability, broader perspective, and ability to navigate different corporate cultures - valuable for entrepreneurs acquiring diverse businesses.

**AI extraction approach:** Parse employment history section, count distinct employer entries

**Note:** More isn't always better (job hopping vs. diverse experience) - human review considers tenure per role.

---

### 3. C-Suite Experience

**Question:** Has the candidate held C-level positions (CEO, CFO, COO, etc.)?

**Options:**
- ☐ CEO (Score: **Highest**)
- ☐ Other C-suite (CFO, COO, CTO, etc.) (Score: **High**)
- ☐ VP/Director level (Score: **Medium**)
- ☐ Manager level (Score: **Low**)
- ☐ No leadership (Score: **0**)

**Example from meeting:**
> "Doesn't have many CEO CEO blah yada yada" → Lower score

**Rationale:** C-suite experience demonstrates strategic thinking, P&L ownership, board interaction - directly applicable to running acquired business.

**AI extraction approach:** Title keyword detection + seniority classification

---

### 4. Leadership Role Depth

**Question:** What level of leadership responsibility has the candidate held?

**Scoring scale:** 0-8+ (implied from meeting transcript)

**Score ranges:**
- **0 points:** No leadership
- **Low points:** Team lead, project manager
- **Mid points:** Department head, senior manager
- **8+ points:** C-suite, business unit leader, P&L owner

**Example from meeting:**
> "Leadership role zero point" → No leadership experience
> "If you put him 8 leadership role [...] then the number starts to become interesting"

**Rationale:** Re-New seeks entrepreneurs who can lead organizations. Leadership track record is critical.

**AI extraction approach:** Combination of title analysis + team size + budget responsibility + reporting structure

---

### 5. Team Size Managed

**Question:** What is the largest team the candidate has managed?

**Thresholds mentioned:**
- 50+ people (mentioned as significant threshold)
- Smaller teams (implied lower scores)

**Example from meeting:**
> "Managing 50 more people doesn't make the change" (in context of otherwise weak candidate)

**Rationale:** Managing large teams indicates organizational leadership capability, but not sufficient alone - must combine with other factors.

**AI extraction approach:** Parse CV for "managed team of X," "led organization of Y people," "reported to me: Z direct reports"

---

### 6. Acquisition Experience

**Question:** Has the candidate been involved in M&A (mergers and acquisitions)?

**Options:**
- ☐ Led acquisition(s) as buyer (Score: **Highest**)
- ☐ Involved in M&A (due diligence, integration, etc.) (Score: **High**)
- ☐ Sold company (Score: **Medium-High**)
- ☐ No acquisition experience (Score: **0**)

**Example from meeting:**
> "No acquisition" → Score: 0

**Rationale:** Direct M&A experience dramatically increases acquisition success probability. Candidate understands process, pitfalls, due diligence, integration challenges.

**AI extraction approach:** Keyword detection (acquisition, M&A, due diligence, merger, bought company, sold business, transaction) + role context

---

### 7. Professional Years of Experience

**Question:** Total years of professional experience?

**Ranges (implied):**
- 0-5 years (Score: **Low**)
- 5-10 years (Score: **Medium**)
- 10-15 years (Score: **High**)
- 15+ years (Score: **Varies** - too senior can be risk)

**Example from meeting:**
> "Professional year fits" → Candidate had appropriate experience level

**Rationale:** Need sufficient experience for credibility (with banks, partners, employees) but not so senior that they can't adapt to entrepreneurial setting.

**Sweet spot (not explicitly stated but implied):** 10-20 years - enough gravitas, still hungry.

**AI extraction approach:** Calculate years from graduation date or first job to present, or parse "X years of experience in..."

---

### 8. Training & Development Focus

**Question:** Has the candidate invested in leadership/business training?

**Indicators:**
- Executive education (MBA, EMBA, executive programs)
- Leadership certifications
- Specialized training (finance, strategy, operations)
- Continuous learning evidence

**Example from meeting:**
> "A lot of training then the number starts to become interesting"

**Rationale:** Shows commitment to growth, coachability, investment in self-development - all critical for entrepreneurs navigating new challenges.

**AI extraction approach:** Parse education section + professional development + certifications

---

## Scoring Dimensions Summary

| Dimension | Weight (Implied) | Key Indicators |
|-----------|------------------|----------------|
| **Distressed Company Experience** | High | Turnaround roles, crisis management |
| **Career Breadth** | Medium | 4+ companies, diverse industries |
| **C-Suite Experience** | Very High | CEO, CFO, COO, etc. |
| **Leadership Depth** | Very High | 8+ leadership score, P&L ownership |
| **Team Size Managed** | Medium | 50+ people threshold |
| **Acquisition Experience** | Very High | M&A involvement, deal experience |
| **Professional Years** | Medium | 10-20 year sweet spot (implied) |
| **Training & Development** | Medium | Continuous learning, executive education |

---

## Scoring Logic

### Star Rating Calculation (Stage 1)

**0-5 star scale:**
- Each field contributes weighted points
- Total points mapped to star rating
- Thresholds for progression:
  - **4-5 stars:** A-list (priority interview)
  - **3 stars:** B-list (interview in 2-3 weeks)
  - **1-2 stars:** C-list (under review)
  - **0 stars:** Rejection

**Example from meeting:**
> "Ian was a one-star guy, not a great fit for Renew. Still a one-star guy managing 50 more people doesn't make the change but probably if you put him 8 leadership role or a lot of training then the number starts to become interesting and you get the ranking for stage one."

**Key insight:** No single factor determines fit - it's combination. Strong leadership (8 points) + training can compensate for lack of acquisition experience.

---

## Stage 2: Additional Fields (Questionnaire)

These fields were **not** extractable from CV, so asked in follow-up questionnaire:

### 1. Region of Interest
**Question:** Which geographic region(s) are you targeting for acquisition?
**Options:** France, Belgium, Switzerland, other EU, international

### 2. Sector Preferences
**Question:** What industry/sector are you targeting?
**Options:** Industrial, services, tech, retail, healthcare, etc.

### 3. Acquisition Timeline
**Question:** When do you plan to acquire?
**Options:** 0-6 months, 6-12 months, 1-2 years, exploring

### 4. Support Needs
**Question:** What support do you need from Re-New?
**Options:** Deal sourcing, due diligence, financing, post-acquisition operations, network

### 5. Personal Contribution
**Question:** What personal strengths do you bring to an acquisition?
**Type:** Open text (AI summarizes)

### 6. What You're Looking For
**Question:** What are you looking for in this program?
**Type:** Open text (AI summarizes)

---

## AI Bot Architecture (8 Bots)

**Meeting transcript:** "8 different AI bots that have gone through all the data"

**Likely bot specializations (inferred from fields):**
1. **Leadership Experience Bot** → Leadership roles, team size, seniority
2. **Industry Experience Bot** → Sectors, company types, career breadth
3. **M&A Experience Bot** → Acquisition involvement, deal experience
4. **Financial Acumen Bot** → Budget ownership, P&L responsibility, CFO experience
5. **Crisis Management Bot** → Distressed companies, turnarounds, restructuring
6. **Professional Development Bot** → Training, education, certifications
7. **Career Progression Bot** → Years of experience, progression speed, trajectory
8. **Cultural Fit Bot** → Values alignment, motivation indicators (from CV language)

**Why 8 bots:** Parallel processing for speed, specialized analysis for depth, redundancy for accuracy (multiple bots may flag same data point from different angles).

---

## Human Override & Manual Adjustment

**Critical feature:** All AI scores are advisory.

**From meeting:**
> "You can in every time manipulate. So you now I changed this and all the flow in the platform is updating."

**Use cases for manual override:**
1. **AI missed context** - CV language ambiguous, bot misinterpreted
2. **Borderline cases** - Candidate at threshold, human judgment tips scale
3. **Special circumstances** - Non-traditional background, unique value proposition
4. **Network effects** - Candidate has valuable connections not evident in CV

**Workflow:** Human reviews AI score → Adjusts fields → Platform recalculates → Star rating updates → Email tier changes (A/B/C list)

---

## Comparison to Campaign #2 Scoring

See [scoring-fields-comparison.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-fields-comparison.md) for detailed comparison.

**Key differences:**
- **AI Platform (this doc):** 8+ fields, automated extraction, 0-5 stars
- **Campaign #2:** Simpler rubric, human-scored, A/B/C/D lists

**Evolution:** Less automation, more human judgment, but retained structured criteria.

---

## Photo Enrichment (Non-Scoring Feature)

**Mentioned in meeting:**
> "Look online for a picture of the guy which often is not correct. This is the weakest part, but you can always replace it manually if you want. This picture is purely for navigating the file with the platform with some pleasure and readability."

**Purpose:** UI/UX enhancement, not scoring
**Source:** LinkedIn scraping, web search
**Accuracy:** Low ("often is not correct")
**User experience value:** High (visual recognition in dashboard)

---

## Limitations & Caveats

### 1. AI Extraction Accuracy
- CV formatting variations impact parsing
- Non-standard career paths may be misclassified
- Language/cultural differences (e.g., "Managing Director" in UK vs. US)

### 2. Scoring Rigidity
- Structured criteria may miss unique profiles
- Non-linear career paths penalized
- Overemphasis on traditional markers (C-suite, big teams)

### 3. Missing Qualitative Factors
- Motivation and drive (not in CV)
- Cultural fit (requires conversation)
- Network quality (not quantity)
- Coachability (only inferable from training history)

### 4. Threshold Gaming
- If criteria public, candidates may "optimize" CVs for scoring
- Risk of false positives (looks good on paper, weak in reality)

**This is why human review was mandatory in the platform design.**

---

## Related Documents

**Archive (this folder):**
- [platform-overview.md](platform-overview.md) - Full platform architecture
- [cost-tracking-methodology.md](cost-tracking-methodology.md) - Assessment cost calculation

**Active Process:**
- [scoring-framework.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-framework.md) - Campaign #2 scoring
- [evaluation-grids.md](../../06_SCRATCHPAD/hr-recruitment-import/01-recruitment-process/evaluation-grids.md) - Interview scoring

**Comparison:**
- [scoring-fields-comparison.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-fields-comparison.md) - AI vs. Campaign #2

---

**Last Updated:** 2025-10-25
**Author:** Ivan (extracted from meeting transcript)
**Status:** Archived - historical reference
