# Cost Tracking Methodology - AI Recruitment Platform

**Platform:** AI Recruitment Platform (archived)
**Purpose:** Document how candidate assessment costs were calculated and tracked
**Philosophy:** "Good practice, good hygiene, financial hygiene even for a startup"

---

## Overview

The AI platform tracked **cost-per-candidate** at the assessment stage (Stage 3) to provide visibility into recruitment economics and inform pricing/monetization decisions.

**Core principle:** Every hour spent assessing candidates has a cost. Tracking this creates accountability and enables ROI analysis.

---

## Cost Calculation Formula

### Basic Formula

```
Assessment Cost = Σ (Assessor Hourly Rate × Time Spent × Number of Assessors)
```

### Components

1. **Assessor Hourly Rate** - Pre-defined for each team member
2. **Time Spent** - Minutes/hours recorded per assessment
3. **Number of Assessors** - How many people participated

---

## Example from Meeting Transcript

**Scenario:** Ian and Amelie assess a candidate together

**Inputs:**
- **Assessors:** Ian + Amelie (2 people)
- **Time spent:** 30 minutes (0.5 hours)
- **Assessment type:** Technical interview

**Calculation (example):**
- Ian's rate: €100/hour (hypothetical)
- Amelie's rate: €50/hour (hypothetical)
- Combined rate: €150/hour
- Time: 0.5 hours
- **Total cost:** €150 × 0.5 = **€75**

**Platform behavior:**
> "First of all, it calculates the cost for this assessment based on time 30 minutes and even time... and then it creates $75."

**Note:** Meeting transcript shows €75 for 30-minute assessment with 2 assessors. Actual individual rates not disclosed.

---

## Team Member Setup

### Assessor Roster

Each team member has a profile with:
- **Name**
- **Role** (e.g., Co-founder, Technical Advisor, HR Lead)
- **Hourly Rate** (€/hour)
- **Availability** (can be selected for assessments)

**AI Assessor Exception:**
- **Rate:** €0/hour
- **Rationale:** No human time cost, pure automation

**From meeting:**
> "AI is free because every assessor has a price per hour."

### Rate Setting Philosophy

**Not explicitly stated in meeting, but likely based on:**
- Opportunity cost (what else could person do with that time)
- Market rate for similar roles
- Internal value (founder time worth more than junior team member)
- Consistency (same rate applied across all assessments for fairness)

---

## Assessment Types & Typical Time Investments

**Mentioned in meeting:**

| Assessment Type | Typical Duration | Typical Assessors | Example Cost |
|----------------|------------------|-------------------|--------------|
| **Skill Test** | 5 minutes | 1 person (AI or human) | €8-10 |
| **Technical Interview** | 30 minutes | 2 people | €75 |
| **Business Case Review** | 1 hour | 2-3 people | €150-300 |
| **Final Interview** | 1 hour | 2-3 people (including founders) | €200-400 |

**AI-only assessments:** €0 (Stage 1 CV screening)

---

## Cost Tracking Workflow

### 1. Assessment Creation

**User action:** Create new assessment for candidate
**Platform prompts for:**
- Assessment type (dropdown)
- Assessor(s) selection (multi-select from team roster)
- Time estimate (minutes/hours)
- Date/time conducted

### 2. Real-Time Cost Calculation

**Platform automatically:**
- Looks up hourly rates for selected assessors
- Multiplies by time spent
- Displays cost immediately

**From meeting:**
> "This creates the assessment here. First of all, it calculates the cost for this assessment based on time 30 minutes and even time."

### 3. Cost Recording

**Platform stores:**
- Assessment ID
- Candidate ID
- Assessor(s)
- Time spent
- Cost calculated
- Date

### 4. Feedback Capture

**In addition to cost, platform captures:**
- Assessment notes (meeting transcript, email exchange, written feedback)
- Score/rating (if applicable)
- Next steps (progress to next stage, reject, hold)

**From meeting:**
> "The assessment feedback could be the meeting notes, could be a couple of sentences written by Emily."

### 5. AI Summary Generation

**Platform automatically:**
- Analyzes feedback text
- Generates concise summary
- Associates with candidate profile

**Purpose:** Quick reference for future decisions, partner introductions, historical context

---

## Dashboard Metrics

### Daily View

**Displayed on dashboard:**
- **Cost today:** Total €/$ spent on assessments (current day)
- **Assessments today:** Number of candidates assessed
- **Cost per assessment:** Average cost (today's total ÷ assessments)

**Example from meeting:**
> "This dashboard is the assessment. This is today today we spend €75 in in assessing a candidate."

### Cumulative View

**Tracked over time:**
- **Total cost to date:** All assessment costs since platform launch
- **Candidates assessed:** Total count
- **Average cost per candidate:** Lifetime average
- **Cost by stage:** Breakdown (Stage 1 / Stage 2 / Stage 3 costs)

**From meeting:**
> "And this is we build up day by day all all the costs that we we have to check resumeumés send emails and everything."

### Team Member View

**Cost per assessor:**
- Total hours invested per person
- Total cost attributed to each person
- Number of assessments participated in
- Average time per assessment

**Purpose:** Identify bottlenecks, balance workload, justify compensation or hiring

---

## Cost Categories (Implied)

### Stage 1: CV Screening
**Typical cost:** €0 (AI-automated)
**Exception:** If human reviews AI-rejected CVs, add human hourly rate × review time

### Stage 2: Questionnaire Review
**Typical cost:** €10-20
**Activity:** Human reviews Stage 2 responses, adjusts scoring
**Time:** ~5-10 minutes per candidate

### Stage 3: Assessments
**Typical cost:** €75-400+ (varies by assessment type)
**Activities:**
- Technical interviews
- Business case reviews
- Cultural fit conversations
- Final founder interviews

### Post-Selection (Not explicitly tracked in platform but implied)
**Activities:**
- Onboarding
- Coaching sessions
- Partner introductions
- Ongoing relationship management

**Future CRM consideration:** Should these be tracked too? (See CRM pivot decision)

---

## Financial Hygiene Rationale

**Ivan's philosophy (from meeting):**
> "This is just you know good practice, good hygiene uh financial hygiene I think even for a startup."

### Why Track Costs?

**1. Unit Economics Visibility**
- Understand cost-per-candidate-acquired
- Inform pricing (must charge more than cost to be profitable)
- Identify efficiency opportunities

**2. Resource Allocation**
- Which assessments are time sinks?
- Who's spending most time on recruitment?
- Should we hire recruiter vs. DIY?

**3. Monetization Validation**
- If spending €X per candidate, partners must pay €Y commission to break even
- ROI analysis: Cost to acquire candidate vs. revenue from partner/repreneur

**4. Process Optimization**
- High cost per candidate → Need to improve screening (reduce false positives)
- AI saves money → Quantify savings to justify investment

**5. Scalability Planning**
- At 100 candidates/year, total cost = €X
- Can we afford that? If not, automate or adjust process

---

## Historical Cost Data (Hypothetical Examples)

**Campaign #1 (without AI platform):**
- 60 candidates
- ~20 selected for interviews
- Average 1 hour per interview × 2 people × €100/hour = €200/interview
- Total: 20 × €200 = **€4,000**
- Plus manual CV screening time: ~30 hours × €100/hour = **€3,000**
- **Total: €7,000 for 60 candidates = €116/candidate**

**With AI Platform (hypothetical):**
- 60 candidates
- AI screens at €0
- Human reviews 20 top-scored at 5 min each = 1.67 hours × €100/hour = **€167**
- 15 selected for interviews (AI reduces false positives)
- 15 × €200/interview = **€3,000**
- **Total: €3,167 for 60 candidates = €53/candidate**
- **Savings: 54%**

**This is the business case for the AI platform.**

---

## Limitations & Considerations

### What's NOT Tracked

**Meeting transcript doesn't indicate these were tracked:**
- CV sourcing costs (advertising, LinkedIn, outreach)
- Platform development cost (Ivan's time building the system)
- Platform maintenance & hosting
- Email delivery costs
- Overhead (office, tools, etc.)

**Pure focus:** Direct assessment time costs

### Hourly Rate Assumptions

**Challenges:**
- Founder time: What's "fair" hourly rate for Bertrand? (Opportunity cost? Market rate? Arbitrary?)
- Volunteer/advisor time: If unpaid, is cost €0 or should impute market rate?
- Blended activities: If Bertrand uses interview to also network/learn, is full time chargeable to recruitment?

**Platform design:** Flexible - user sets rates, can adjust anytime

**From meeting:**
> "You can change a rate even rate you can add new new guy and it becomes immediately available to um to be choose for for making a part being part of the renew team."

### Cost vs. Value

**Critical distinction:**
- Cost tracking ≠ value measurement
- €400 interview that lands high-value repreneur worth it
- €50 interview that leads nowhere is waste

**Need to track BOTH:**
- Cost per candidate (input)
- Revenue per candidate (output)
- **ROI = Revenue ÷ Cost**

---

## Application to CRM Model (Future)

**From ATS → CRM pivot decision:**

Re-New shifted from recruitment (select candidates) to relationship management (serve repreneurs). Does cost tracking still apply?

**Yes, but different metrics:**

### CRM Cost Tracking Should Capture

| Metric | ATS Model (Old) | CRM Model (New) |
|--------|-----------------|-----------------|
| **Cost per candidate** | ✓ Tracked | ✗ Wrong metric |
| **Cost per repreneur** | ✗ Not tracked | ✓ Track |
| **Cost per service delivered** | ✗ Not tracked | ✓ Track (coaching, intro, deal flow) |
| **Revenue per repreneur** | ✗ Not tracked | ✓ Track |
| **Profit per repreneur** | ✗ Not tracked | ✓ Track (Revenue - Cost) |
| **Lifetime value (LTV)** | ✗ Not tracked | ✓ Track |
| **Cost to acquire repreneur (CAC)** | ✓ Tracked | ✓ Track |
| **LTV/CAC ratio** | ✗ Not tracked | ✓ Track (key SaaS metric) |

**Insight:** The cost-tracking methodology is still valuable, but applied to CRM activities instead of ATS activities.

---

## Integration with Assessment Summarization

**Cost tracking + AI summarization = Complete assessment record**

**From meeting:**
> "You can always keep track of the whole candidate flow. You will never know if one day you want to take back an interview and get some piece of information that could be useful for one of our partners."

**Use case example:**
1. Candidate interviewed 6 months ago (cost: €200)
2. Didn't select at the time
3. New partner asks for candidates in specific sector
4. Search platform: Find old candidate with sector expertise
5. Review AI summary of interview
6. Reactivate candidate, introduce to partner
7. **Result:** €200 assessment investment pays off months later

**This justifies comprehensive record-keeping.**

---

## Reporting & Analytics

**Dashboard should enable:**
- Filter by date range (this week, this month, Q1, etc.)
- Filter by assessor (Bertrand's time, Amelie's time, etc.)
- Filter by candidate stage (Stage 3 only, or full funnel)
- Filter by outcome (selected vs. rejected - did expensive interviews lead to good hires?)
- Export to CSV for external analysis

**Goal:** Data-driven optimization of recruitment process

---

## Related Documents

**Archive (this folder):**
- [platform-overview.md](platform-overview.md) - Full platform architecture
- [cv-extraction-fields.md](cv-extraction-fields.md) - Scoring criteria

**Active Process:**
- [DEC-20241101-ats-to-crm-operational-pivot.md](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md) - Why cost-per-candidate became less relevant

**Future Application:**
- CRM should track cost-per-repreneur and revenue-per-repreneur for true unit economics

---

**Last Updated:** 2025-10-25
**Author:** Ivan (methodology extracted from meeting transcript)
**Status:** Archived - concept remains valuable for CRM model with different metrics
