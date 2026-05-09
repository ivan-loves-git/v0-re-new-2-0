# AI Recruitment Platform - Architecture Overview

**Project Date:** Pre-Campaign #2 (2024)
**Status:** Built but not deployed
**Reason for archiving:** Cost-per-candidate screening became non-critical as application volumes decreased
**Related:** Pivot to ATS → CRM model (Nov 2024)

---

## Executive Summary

Ivan built a comprehensive AI-powered recruitment platform for Re-New to automate candidate screening and reduce cost-per-candidate. The platform featured 3-stage evaluation, automated CV extraction, personalized email generation, and cost tracking.

**Key capabilities:**
- Automated CV text extraction and enrichment
- 8 parallel AI bots for scoring
- Multi-stage candidate evaluation (Stages 1-3)
- Cost-per-assessment tracking
- Personalized candidate communications
- Real-time dashboard monitoring

**Why not deployed:** Business priority shifted from "screen many candidates efficiently" to "manage fewer candidates deeply" when application volumes decreased and relationship management became the bottleneck.

---

## Platform Architecture

### Stage 1: Initial CV Screening

**Input:** Candidate CV (PDF/DOC)

**Process:**
1. **Text extraction** from CV
2. **Profile enrichment:**
   - LinkedIn photo lookup (auto, with manual override option)
   - Online profile aggregation
3. **AI scoring:** 8 independent AI bots analyze CV against specific criteria
4. **Automatic scoring** across multiple dimensions
5. **Star rating generation** (0-5 stars)

**Output:**
- Scored candidate profile
- Personalized email with 2-3 "connection points" between Re-New mission and candidate background
- Link to Stage 2 questionnaire (if threshold passed)

**Threshold logic:** If score < threshold → Rejection email; If score ≥ threshold → Personalized email with questionnaire link

---

### Stage 2: Extended Profile Collection

**Input:** Stage 1 score + additional questionnaire responses

**Process:**
1. Candidate receives personalized email (30-60 min after CV submission)
2. Email includes:
   - Acknowledgment signed by Bertrand
   - 2-3 connection points (AI-generated, tailored to candidate)
   - Link to additional questionnaire
3. Questionnaire captures data not available in CV:
   - Region of interest
   - What candidate is looking for
   - Personal contribution interests
   - Project stage/acquisition timeline
4. **Combined scoring:** Stage 1 score + Stage 2 responses

**Conversion optimization philosophy:** Two-step approach reduces initial friction (just CV) while building credibility through personalized response before asking for more information.

**Output:** Enhanced candidate score, updated star rating

---

### Stage 3: Assessment Tracking & Cost Management

**Input:** Candidate selected for interview/assessment

**Process:**
1. **Assessment creation:**
   - Select assessor(s) from team roster
   - Define assessment type (skill test, technical interview, business case, etc.)
   - Record time spent (minutes)
   - Capture assessment feedback (notes, transcript, email exchange)
2. **Cost calculation:**
   - Each team member has hourly rate
   - AI assessor = €0/hour
   - Auto-calculate: (Hours × Rate) × Number of assessors
3. **AI summarization:**
   - Platform generates summary of assessment feedback
   - Intended for copy-paste of meeting transcripts or email threads
4. **Archive creation:**
   - Full audit trail maintained
   - Retrievable for partner introductions or future reference

**Output:**
- Assessment summary
- Cost-per-candidate metric
- Updated candidate stage
- Historical record

---

## Key Features

### 1. Parallel Candidate Processing
- Multiple candidates processed simultaneously
- No bottlenecks in AI scoring stage
- Dashboard shows real-time progress

### 2. Data-Managed Dashboards
- All dashboards configurable
- Changes take 5-30 minutes to implement
- No code deployment needed for UI updates

### 3. Manual Override Capabilities
- AI scores are advisory, not final
- Human can adjust any field
- All selections immediately update downstream calculations

### 4. Star Rating System
- 0-5 stars per stage
- Cumulative scoring across stages
- Visual representation for quick candidate prioritization

### 5. Cost Tracking & Analytics
**Dashboard metrics:**
- Candidates processed per day
- Candidates by stage
- Candidate ranking distribution
- Assessment cost per day
- Assessment cost per team member
- Cumulative cost tracking

**Philosophy:** "Good practice, good hygiene, financial hygiene even for a startup"

### 6. Team Management
- Team roster with hourly rates
- Assignment to assessments
- Cost allocation per person
- Performance tracking (candidates assessed, time invested)

### 7. Email Automation & Personalization
**Rejection flow:**
- Generic but polite rejection email

**Progression flow:**
- Personalized email highlighting candidate strengths
- AI-generated connection points (2-3 specific items)
- Contextual questionnaire invitation
- Signed by Bertrand (with approval workflow option)

**Example personalization:**
> "After reviewing your profile, we identified several connections between your background and Re-New's mission: [Connection 1], [Connection 2], [Connection 3]. We'd like to learn more about where you are in your acquisition journey."

---

## Technical Capabilities

### AI Components
- **8 AI bots for Stage 1 scoring** (parallel processing)
- **Text extraction engine** (CV parsing)
- **Profile enrichment** (web scraping, LinkedIn lookup)
- **Personalization engine** (connection point generation)
- **Assessment summarization** (transcript → summary)

### Data Management
- Pseudonymization support (GDPR-aligned design)
- Structured data flow (CV → extracted fields → scores)
- Manual data correction at any stage
- Full audit trail

### Integration Points
- Email sending (automated, personalized)
- Calendar integration (for assessment scheduling - implied)
- External questionnaire (web form → platform)
- Dashboard refresh (real-time updates)

---

## User Interface

### Overview Dashboard
**Metrics displayed:**
- Candidates added per day (chart)
- Candidate stage distribution (chart)
- Candidate ranking distribution (chart)
- Cost analysis (daily, cumulative)

### Candidate Deep Dive
- Individual candidate profile view
- All fields editable
- Assessment history
- Stage progression timeline
- Manual score adjustment

### Assessment Management
- Create new assessment
- Select assessor(s)
- Define time spent
- Input feedback/notes
- Auto-calculate cost
- Generate AI summary

### Team Management
- Roster of assessors
- Hourly rates
- Assessment history per person
- Cost tracking per person

### System Documentation
- Built-in flow diagrams
- Process reminders
- In-platform documentation access

---

## Scoring Methodology

See [cv-extraction-fields.md](cv-extraction-fields.md) for detailed field-by-field scoring criteria.

**High-level approach:**
- Multiple dimensions evaluated independently
- Weighted scoring (some criteria more important than others)
- Threshold-based progression (must reach X stars to advance)
- Human review mandatory (AI assists, doesn't decide)

---

## Why It Wasn't Deployed

### Original Business Case
**Problem:** High volume of candidate CVs, limited team time to screen
**Solution:** AI-powered screening to reduce cost-per-candidate

### What Changed
1. **Application volumes decreased** → Less need for automation
2. **Relationship management became bottleneck** → Screening speed no longer critical
3. **Business model clarity:** Re-New is not in recruitment business → Wrong paradigm
4. **CRM > ATS realization:** Need to manage ongoing relationships, not just screen applicants

### Campaign #2 Outcome (Nov 2024)
**From decision log ([DEC-20241101-ats-to-crm-operational-pivot.md](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md)):**
> "ATS is dead, CRM is the future" - Amelie

**Core insight:** Re-New's value is ongoing repreneur support, not one-time candidate selection. The AI platform optimized for the wrong thing (fast screening) when the real challenge is relationship depth at scale.

---

## What Was Built vs. What Was Needed

| AI Platform (Built) | Actual Need (Discovered) |
|---------------------|--------------------------|
| Fast CV screening | Deep relationship management |
| Automated scoring | Service delivery tracking |
| Cost-per-candidate | Revenue per repreneur |
| Stage-based funnel | Lifecycle-based journey |
| Campaign batches | Continuous intake |
| Selection decisions | Monetization actions |

---

## Reusable Components

Even though the full platform wasn't deployed, several concepts remain valuable:

### 1. Two-Step Data Collection
- **Learning:** Don't ask for everything upfront
- **Application:** Campaign #2 used CV + optional questionnaire approach
- **Result:** Higher conversion (confirmed in Campaign #2 learnings)

### 2. Cost-Per-Interaction Tracking
- **Learning:** Track time/cost per candidate to understand unit economics
- **Application:** Could apply to CRM (cost-per-repreneur, cost-per-service-delivered)
- **Future:** Informs pricing (if spending €X per repreneur, must charge €Y to be profitable)

### 3. Personalization at Scale
- **Learning:** AI can generate tailored communications that build credibility
- **Application:** Could enhance CRM email templates (personalized follow-ups, partner intros)
- **Caution:** Must balance automation with authentic relationship-building

### 4. Structured Scoring as Thinking Tool
- **Learning:** Defining explicit criteria forces clarity on what matters
- **Application:** Campaign #2 scoring framework (see [scoring-framework.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-framework.md))
- **Value:** Even if AI doesn't score, having rubric helps humans decide consistently

---

## Lessons Learned

See [CANONICAL/knowledge/lessons-learned.md](../../00_CANONICAL/knowledge/lessons-learned.md) for extracted insights.

**Key takeaways:**
1. **Build for the business you have, not the business you imagine** → Assumed high volume problem; reality was relationship depth problem
2. **Validate demand before building tools** → Built platform before confirming AI screening was critical path
3. **Tools shape thinking** → ATS-style platform reinforced wrong mental model (selection vs. service)
4. **Automation works best for repeatable, high-volume tasks** → Candidate relationships are bespoke, not commoditized

---

## Platform Demonstration

**Meeting recording (Oct 2024):** Ivan presented platform to Bertrand/Amelie, walking through 3-stage flow, dashboards, cost tracking, and email automation.

**Key demonstration points:**
- CV upload → automated profile creation
- 8 AI bots scoring in parallel
- Manual score adjustment capability
- Personalized email generation
- Stage 2 questionnaire flow
- Stage 3 assessment tracking with cost calculation
- Dashboard metrics (candidates per day, stage distribution, cost analysis)

**Team reaction:** "Super cool," "amazing work," but ultimately recognized it solved problem they no longer had.

---

## Related Documentation

**Archive (this folder):**
- [cv-extraction-fields.md](cv-extraction-fields.md) - Detailed scoring criteria
- [cost-tracking-methodology.md](cost-tracking-methodology.md) - How assessment costs calculated
- [lessons-learned.md](lessons-learned.md) - What worked, what didn't, why

**Active Process (Campaign #2):**
- [scoring-framework.md](../../06_SCRATCHPAD/hr-recruitment-import/02-candidate-scoring/scoring-framework.md) - Simplified scoring for Campaign #2
- [interview-process-rounds.md](../../06_SCRATCHPAD/hr-recruitment-import/01-recruitment-process/interview-process-rounds.md) - Human-led interview structure

**Strategic Decisions:**
- [DEC-20241101-ats-to-crm-operational-pivot.md](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md) - Why ATS approach abandoned

---

## Technical Specifications

**Platform type:** Web application (implied)
**Database:** Data-managed (likely Firebase, Airtable, or similar)
**AI provider:** Not specified in meeting (likely GPT-3.5/4 or similar LLM)
**Email integration:** Automated sending with personalization
**Photo lookup:** Web scraping (LinkedIn, other sources)
**Cost calculation:** Real-time (hourly rate × time × assessors)

**Development timeline:** Estimated several weeks (Ivan: "I'm only 10% of my capacity" → significant time investment)

---

**Last Updated:** 2025-10-25
**Archived By:** Ivan
**Status:** Historical reference - not in active use
