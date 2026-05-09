# User Journeys - Renew Dashboard

> **End-to-end flows for acquisition entrepreneurs from discovery to exit**

*Last Updated: 2025-11-12*

---

## Overview

This document maps the complete user journey for acquisition entrepreneurs through the Renew Dashboard platform, organized by persona and lifecycle stage.

**Journey Phases:**
1. **Discovery** (Months 0-3) - Assessment and preparation
2. **Acquisition** (Months 3-18) - Deal search and closing
3. **Post-Acquisition** (Months 18-60) - Operations and growth
4. **Exit Planning** (Months 48+) - Value optimization and sale

**Sources:**
- [User Personas](user-personas.md) - Detailed persona profiles
- [Information Architecture](information-architecture.md) - Platform structure
- [Product Overview](product-overview.md) - Value proposition
- Page specifications in [02_PAGE_SPECIFICATIONS/](../02_PAGE_SPECIFICATIONS/)

---

## Table of Contents

1. [Journey Overview](#journey-overview)
2. [Explorer Journey (Discovery Phase)](#explorer-journey-discovery-phase)
3. [Active Searcher Journey (Acquisition Phase)](#active-searcher-journey-acquisition-phase)
4. [First-Time Owner Journey (Post-Acquisition Phase)](#first-time-owner-journey-post-acquisition-phase)
5. [Exit Planning Journey](#exit-planning-journey)
6. [Cross-Journey Touchpoints](#cross-journey-touchpoints)
7. [Journey Metrics & Success Criteria](#journey-metrics--success-criteria)

---

## Journey Overview

### Complete Lifecycle Map

```
SIGNUP → DISCOVERY → ACQUISITION → POST-ACQUISITION → EXIT
  ↓         ↓            ↓              ↓              ↓
Auth    Readiness    Deal Flow     Operations      Planning
        Assessment   Pipeline      Support         & Sale
        Criteria     Expert        Operating       Optimization
        Learning     Network       Partner         Exit
```

### Journey Timeline

| Phase | Duration | Success Rate | Key Metrics |
|-------|----------|--------------|-------------|
| **Discovery** | 3-6 months | 60% → Acquisition | Readiness score, criteria completion |
| **Acquisition** | 12-18 months | 30% → Close deal | Deals viewed, saved, LOI submitted |
| **Post-Acquisition** | 24-36 months | 80% → Stabilize | EBITDA maintained, team retained |
| **Exit Planning** | 12-24 months | 70% → Successful exit | Valuation multiple, sale completion |

---

## Explorer Journey (Discovery Phase)

**Persona:** The Explorer (Early Stage)
**Goal:** Validate acquisition path and get acquisition-ready
**Duration:** 3-6 months
**Subscription:** Starter (€99/month)

### Journey Map

```
ARRIVAL → ASSESSMENT → CRITERIA → LEARNING → COMMUNITY → DECISION
```

---

### Step 1: Arrival & Onboarding

**Trigger:** User signs up (marketing, referral, or campaign)

**Pages:**
- [/signup](../02_PAGE_SPECIFICATIONS/01-authentication/signup.md)
- [/onboarding](../02_PAGE_SPECIFICATIONS/01-authentication/onboarding.md)

**Actions:**
1. Create account (email/password or OAuth)
2. Complete onboarding questions:
   - Journey stage: "Just exploring" vs. "Actively searching"
   - Background: Industry, years of experience
   - Capital available: €50K-150K range
   - Timeline: "No rush" vs. "12-18 months"
3. Select subscription tier (Starter for Explorer)

**Outcomes:**
- Account created
- Profile initialized
- Recommended next steps displayed

**Emotional State:** Curious, slightly overwhelmed, seeking validation

---

### Step 2: Readiness Assessment

**Trigger:** Onboarding completion → Redirected to Discovery Hub

**Pages:**
- [/discovery](../02_PAGE_SPECIFICATIONS/03-discovery/hub.md)
- /discovery/readiness-quiz
- /discovery/results

**Actions:**
1. View Discovery Hub landing page
2. Click "Start Readiness Assessment"
3. Complete 15-20 question assessment:
   - Financial readiness (capital, runway, risk tolerance)
   - Operational readiness (experience, skills, gaps)
   - Personal readiness (motivation, family buy-in, timeline)
4. Receive personalized results:
   - Overall readiness score (0-100)
   - Category breakdown (financial, operational, personal)
   - Identified gaps and recommendations
   - Suggested actions (courses, criteria building, consultation)

**Outcomes:**
- Readiness score saved to profile
- Gap analysis documented
- Personalized learning path generated
- Confidence increased or concerns validated

**Emotional State:** Self-aware, validated (or appropriately cautioned), motivated to address gaps

---

### Step 3: Define Acquisition Criteria

**Trigger:** Readiness assessment complete → "Build Your Criteria" CTA

**Pages:**
- /discovery/lead-de-cadrage

**Actions:**
1. Complete Lead de Cadrage (structured acquisition criteria):
   - **Geography:** Target regions, willingness to relocate
   - **Industry:** Preferred sectors, must-avoid industries
   - **Size:** Revenue range (€1-5M), employee count (10-50)
   - **Business Model:** B2B, B2C, recurring revenue preference
   - **Financial Profile:** EBITDA margins, growth trajectory
   - **Role:** Hands-on operator vs. strategic owner
   - **Deal Structure:** Purchase price range, equity %, financing needs
2. Save criteria to profile
3. Receive matching algorithm setup (for future deal flow)

**Outcomes:**
- Acquisition criteria documented and saved
- Matching profile activated for deal flow
- Clarity on target opportunity
- **Mandatory step** before deal flow access

**Emotional State:** Clear, focused, empowered

---

### Step 4: Personalized Learning Path

**Trigger:** Criteria saved → "Start Learning" CTA

**Pages:**
- /discovery/learning-path
- /resources/courses
- /resources/library

**Actions:**
1. View personalized learning path (based on readiness gaps)
2. Browse recommended courses:
   - "Acquisition Fundamentals" (if new)
   - "Financial Due Diligence" (if gap identified)
   - "Financing Options for First-Time Buyers"
3. Access resource library:
   - Articles, templates, case studies
   - Filters by topic, journey stage, difficulty
4. Track learning progress (courses completed, time invested)

**Outcomes:**
- Knowledge gaps addressed
- Confidence increased
- Preparation for next phase (acquisition)

**Emotional State:** Empowered, less intimidated, ready to progress

---

### Step 5: Community Engagement

**Trigger:** Parallel to learning (exploratory)

**Pages:**
- /network/hub
- /network/peers
- /network/events

**Actions:**
1. Browse member directory (repreneurs at similar stage)
2. Join peer discussion groups (optional)
3. Attend virtual events (monthly webinars, Q&A sessions)
4. Read success stories from other repreneurs

**Outcomes:**
- Peer validation ("Others like me are doing this")
- Reduced isolation
- Network building for future support
- Referrals and tips from experienced members

**Emotional State:** Connected, validated, motivated

---

### Step 6: Decision Point - Consultation

**Trigger:** After 2-4 weeks of platform usage

**Pages:**
- /discovery/consultation

**Actions:**
1. Book 1-on-1 consultation with Renew advisor
2. Discuss:
   - Readiness assessment results
   - Acquisition criteria refinement
   - Gap closure plan
   - Timeline and next steps
3. Receive personalized recommendations:
   - "You're ready to start searching" → Upgrade to Professional
   - "Focus on these 3 gaps first" → Continue learning
   - "Consider this alternative path" → Pivot or pause

**Outcomes:**
- Clear decision on next steps
- Upgrade to Professional tier (if ready) or continue discovery
- Confidence to proceed or realistic pause

**Emotional State:** Clear, confident, ready to commit (or appropriately cautious)

---

### Explorer Journey Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Readiness Assessment Completion** | 80% | % of signups completing quiz |
| **Lead de Cadrage Completion** | 60% | % completing criteria builder |
| **Learning Engagement** | 3+ courses | Avg. courses completed |
| **Time to Decision** | 3-6 months | Avg. time from signup to upgrade/churn |
| **Conversion to Active Searcher** | 40% | % upgrading to Professional tier |

---

## Active Searcher Journey (Acquisition Phase)

**Persona:** The Active Searcher (Mid Stage)
**Goal:** Find and close the right acquisition
**Duration:** 12-18 months
**Subscription:** Professional (€249/month)

### Journey Map

```
UPGRADE → DEAL FLOW → PIPELINE → DUE DILIGENCE → FINANCING → CLOSING
```

---

### Step 1: Upgrade & Criteria Review

**Trigger:** Conversion from Explorer OR direct signup as Active Searcher

**Pages:**
- /dashboard
- /discovery/lead-de-cadrage (edit)

**Actions:**
1. Upgrade to Professional tier (if Explorer)
2. Review and refine acquisition criteria (Lead de Cadrage)
3. Confirm deal flow preferences and alerts
4. Access full platform features (deal flow, experts, coaching)

**Outcomes:**
- Professional subscription active
- Criteria locked in for matching
- Deal flow access enabled

**Emotional State:** Committed, eager, slightly anxious about timeline

---

### Step 2: Deal Flow Discovery

**Trigger:** Subscription active → Deal flow notifications begin

**Pages:**
- /deal-flow/landing
- /deal-flow/browse
- /deal-flow/deal-detail

**Actions:**
1. Browse curated deal flow (filtered by criteria)
2. View deal cards:
   - Company overview, industry, location
   - Financials (revenue, EBITDA, asking price)
   - Match score (% alignment with criteria)
3. Click through to deal detail pages:
   - Full business description
   - Detailed financials
   - Seller motivation and timeline
   - Renew assessment/notes
4. Save deals of interest (bookmark for later)
5. Set up custom alerts (new deals matching specific filters)

**Outcomes:**
- 5-10 deals saved per month
- 2-3 high-interest deals identified per quarter
- Realistic expectations set (deal flow quality and velocity)

**Emotional State:** Excited when good match found, frustrated when dry spells, learning to assess quickly

---

### Step 3: Pipeline Management

**Trigger:** 2+ deals saved → Encouraged to track progress

**Pages:**
- /deal-flow/saved
- /deal-flow/pipeline

**Actions:**
1. View saved deals collection
2. Move deals into pipeline stages:
   - **Exploring** (initial review)
   - **Interested** (requesting more info)
   - **Due Diligence** (active vetting)
   - **LOI Submitted** (offer made)
   - **Closing** (final negotiations)
   - **Passed** (decided against)
3. Add notes and tasks to each deal
4. Track timeline and next actions

**Outcomes:**
- Organized deal management (5-10 deals in pipeline)
- Clear visibility into progress
- Prioritization of best opportunities

**Emotional State:** Organized, strategic, managing multiple options

---

### Step 4: Due Diligence & Expert Support

**Trigger:** Deal moves to "Due Diligence" stage in pipeline

**Pages:**
- /acquisition-support/hub
- /acquisition-support/due-diligence
- /acquisition-support/experts
- /acquisition-support/valuation

**Actions:**
1. Access due diligence checklists:
   - Financial review (P&L, balance sheet, cash flow)
   - Operations review (processes, systems, team)
   - Customer/supplier concentration
   - Legal/compliance risks
2. Use valuation calculator:
   - Input financials
   - Model different scenarios
   - Determine maximum offer price
3. Connect with expert network:
   - Book lawyer for contract review
   - Book accountant for financial audit
   - Book industry expert for market validation
4. Track due diligence progress (checklist completion)

**Outcomes:**
- Thorough vetting completed
- Confidence in deal quality (or red flags identified)
- Expert validation received
- Offer price determined

**Emotional State:** Analytical, cautious, seeking validation

---

### Step 5: Financing Facilitation

**Trigger:** Due diligence positive → Need to secure capital

**Pages:**
- /acquisition-support/financing
- /acquisition-support/experts (lenders)

**Actions:**
1. Explore financing options:
   - Bank loan (traditional)
   - SBA-equivalent (if available)
   - Seller financing
   - Investor equity
   - Hybrid structures
2. Use financing calculator:
   - Model different structures
   - Understand debt service coverage
   - Calculate equity required
3. Connect with lenders in Renew network:
   - Submit preliminary applications
   - Receive indicative terms
   - Compare options
4. Prepare financing package (with advisor support)

**Outcomes:**
- Financing strategy determined
- Lender relationships initiated
- Capital commitments secured (or in process)
- Confidence to submit LOI

**Emotional State:** Anxious about capital, relieved when commitments secured, ready to move fast

---

### Step 6: LOI & Negotiation

**Trigger:** Financing secured + due diligence positive → Ready to make offer

**Pages:**
- /acquisition-support/coaching
- /acquisition-support/templates

**Actions:**
1. Draft Letter of Intent (LOI):
   - Use Renew template
   - Input deal terms (price, structure, timeline)
   - Review with Renew advisor
2. Submit LOI to seller (via broker or direct)
3. Negotiate terms:
   - Book coaching sessions for guidance
   - Real-time support during negotiations
   - Adjust terms based on advisor feedback
4. Execute LOI (move to exclusivity)

**Outcomes:**
- LOI accepted (or terms negotiated)
- Exclusivity period begins (60-90 days)
- Final due diligence and closing process initiated

**Emotional State:** Nervous, excited, high-stakes, grateful for coaching

---

### Step 7: Closing

**Trigger:** LOI accepted → Final due diligence and legal work

**Pages:**
- /acquisition-support/hub
- /acquisition-support/experts
- /acquisition-support/templates

**Actions:**
1. Complete final due diligence (deep dive)
2. Finalize financing (execute loan docs, wire funds)
3. Negotiate purchase agreement:
   - Work with lawyer
   - Review with Renew advisor
   - Address contingencies and reps/warranties
4. Coordinate closing logistics:
   - Escrow setup
   - Transition planning
   - Announcement to team/customers
5. Sign and close deal

**Outcomes:**
- **Deal closed!** Ownership transferred
- Transition plan in place
- Post-acquisition support activated
- Celebration and relief

**Emotional State:** Exhausted, exhilarated, nervous about next phase, grateful for support

---

### Active Searcher Journey Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Deals Viewed** | 20-50 | Avg. deals viewed per user |
| **Deals Saved** | 5-10 | Avg. deals saved per user |
| **Pipeline Management** | 3-5 | Avg. deals in active pipeline |
| **Expert Consultations** | 10-15 | Avg. sessions booked |
| **Time to Close** | 12-18 months | Avg. time from upgrade to closing |
| **Closing Rate** | 30% | % of Active Searchers who close deals |

---

## First-Time Owner Journey (Post-Acquisition Phase)

**Persona:** The First-Time Owner (Post-Acquisition)
**Goal:** Successfully transition and stabilize the business
**Duration:** 24-36 months
**Subscription:** Enterprise (€349/month) + Operating Partner Retainer (€1,500-3,000/month)

### Journey Map

```
TRANSITION (Days 1-90) → STABILIZATION (Months 3-12) → OPTIMIZATION (Months 12-36) → EXIT PREP
```

---

### Step 1: Immediate Transition (Days 1-30)

**Trigger:** Deal closed → Onboarding as new owner

**Pages:**
- /post-acquisition/hub
- /post-acquisition/milestones (30/60/90 day plan)
- /post-acquisition/coaching

**Actions:**
1. Set up post-acquisition profile:
   - Business details (name, industry, size, EBITDA)
   - Acquisition details (price, structure, date)
   - Key metrics to track (revenue, EBITDA, cash, team size)
2. Review 30-day transition plan:
   - Meet entire team (1-on-1s)
   - Meet top customers
   - Understand cash flow cycle
   - Identify critical processes
   - Quick wins to demonstrate capability
3. Schedule Operating Partner sessions:
   - Initial kickoff (strategy and plan review)
   - Weekly check-ins (first 30 days)
   - Ad-hoc support as needed (unlimited)

**Outcomes:**
- Transition plan activated
- Operating Partner relationship established
- First 30 days survived without major incidents
- Team and customers reassured

**Emotional State:** Overwhelmed, firefighting, grateful for operating partner support

---

### Step 2: Stabilization (Months 3-12)

**Trigger:** 30-day plan complete → Focus shifts to stabilization

**Pages:**
- /post-acquisition/milestones (60/90/180 day plans)
- /post-acquisition/kpi-dashboard
- /post-acquisition/coaching
- /post-acquisition/peer-groups

**Actions:**
1. Execute 60/90/180 day milestone plans:
   - Implement operational improvements
   - Address identified risks
   - Build relationships with key stakeholders
2. Monitor KPI dashboard daily:
   - Revenue, EBITDA, cash flow
   - Customer retention, team turnover
   - Pipeline health, operational metrics
3. Operating Partner coaching (bi-weekly):
   - Strategic decisions
   - Problem-solving
   - Operational optimization
4. Join peer advisory circle:
   - Monthly mastermind with other first-time owners
   - Share challenges and solutions
   - Accountability and support

**Outcomes:**
- Business stabilized (metrics maintained or improved)
- Team and customers retained
- Major risks addressed
- Owner confidence increasing

**Emotional State:** Cautiously optimistic, learning fast, building confidence

---

### Step 3: Optimization (Months 12-36)

**Trigger:** Business stable → Focus shifts to growth and value creation

**Pages:**
- /post-acquisition/kpi-dashboard
- /post-acquisition/initiatives
- /post-acquisition/experts
- /network/hub

**Actions:**
1. Identify growth initiatives:
   - New customer acquisition strategies
   - Product/service expansion
   - Operational efficiency improvements
   - Team development and hiring
2. Track initiative progress:
   - Goals, timelines, owners
   - ROI and impact measurement
3. Operating Partner coaching (monthly):
   - Strategic planning
   - Growth execution support
   - Scaling challenges
4. Leverage expert network:
   - Hire specialists for specific needs (marketing, tech, HR)
   - On-demand consultations
5. Engage with community:
   - Mentor newer owners
   - Attend events and workshops
   - Build network for future opportunities

**Outcomes:**
- Business growing (revenue +10-30% YoY)
- EBITDA improving (margin optimization)
- Owner mastery increasing (less reliance on operating partner)
- Value creation for future exit

**Emotional State:** Confident, strategic, enjoying ownership, planning long-term

---

### Step 4: Exit Planning Transition

**Trigger:** 3-5 years post-acquisition → Thinking about exit

**Pages:**
- /exit-planning/hub
- /exit-planning/readiness
- /exit-planning/valuation

**Actions:**
1. Complete exit readiness assessment:
   - Business sellability (financials, operations, team)
   - Market timing and conditions
   - Owner readiness (financial goals, next chapter)
2. Estimate business valuation:
   - Compare to acquisition price
   - Calculate value created
   - Identify value optimization opportunities
3. Develop exit strategy:
   - Target timeline (2-5 years)
   - Value optimization roadmap
   - Buyer identification strategy

**Outcomes:**
- Exit goal defined (timeline, price, structure)
- Roadmap to maximize value before sale
- Transition to Exit Planning phase (covered in next section)

**Emotional State:** Reflective, proud of accomplishments, ready to plan next chapter

---

### First-Time Owner Journey Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **30-Day Survival** | 95% | % completing 30-day plan without crisis |
| **Business Stability** | 80% | % maintaining EBITDA within 10% of acquisition |
| **Team Retention** | 85% | % retaining key employees (first 12 months) |
| **Customer Retention** | 90% | % retaining top 20% customers (first 12 months) |
| **Revenue Growth** | +15% | Avg. YoY revenue growth (years 2-3) |
| **Operating Partner Utilization** | 12+ sessions | Avg. sessions per year |
| **Subscription Retention** | 90% | % renewing Enterprise subscription annually |

---

## Exit Planning Journey

**Persona:** Preparing for Exit (Post-Acquisition, 3-5 years in)
**Goal:** Maximize business value and execute successful exit
**Duration:** 12-24 months
**Subscription:** Enterprise (€349/month) + Optional Operating Partner for exit prep

### Journey Map

```
ASSESSMENT → OPTIMIZATION → MARKETING → NEGOTIATION → SALE
```

---

### Step 1: Exit Readiness Assessment

**Trigger:** Owner decides to explore exit (3-5 years post-acquisition)

**Pages:**
- /exit-planning/hub
- /exit-planning/readiness
- /exit-planning/readiness-results

**Actions:**
1. Complete exit readiness assessment:
   - **Business:** Financials clean, operations documented, team independent
   - **Market:** Timing, buyer demand, comparable multiples
   - **Owner:** Financial goals, next plans, emotional readiness
2. Receive readiness score and recommendations:
   - "Ready to sell now" (high score)
   - "Optimize for 12-24 months first" (medium score)
   - "Address critical issues before considering sale" (low score)
3. Identify value optimization opportunities

**Outcomes:**
- Clear understanding of sellability
- Roadmap for value maximization
- Realistic timeline for exit

**Emotional State:** Excited about potential exit, focused on maximizing value

---

### Step 2: Value Optimization

**Trigger:** Readiness assessment complete → Execute optimization roadmap

**Pages:**
- /exit-planning/roadmap
- /exit-planning/valuation
- /post-acquisition/experts

**Actions:**
1. Execute value optimization plan (12-24 months):
   - Clean up financials (documented, predictable)
   - Systematize operations (reduce owner dependency)
   - Grow revenue and EBITDA (demonstrate momentum)
   - Build strong management team (buyer confidence)
   - Address red flags (customer concentration, legal issues, etc.)
2. Track valuation over time:
   - Quarterly valuation estimates
   - Monitor multiple expansion
   - Celebrate value creation milestones
3. Engage experts as needed:
   - Accountant for financial cleanup
   - Lawyer for legal risk mitigation
   - Operational consultants for systematization

**Outcomes:**
- Business optimized for sale (higher multiple)
- Valuation increased (vs. initial assessment)
- Owner ready to launch sale process

**Emotional State:** Strategic, patient, executing with discipline

---

### Step 3: Buyer Identification & Marketing

**Trigger:** Optimization complete → Ready to market business

**Pages:**
- /exit-planning/buyers
- /exit-planning/process
- /acquisition-support/experts (M&A advisors)

**Actions:**
1. Identify potential buyers:
   - **Renew Network:** Other repreneurs seeking acquisitions (platform advantage)
   - **Strategic Buyers:** Competitors, adjacent industries
   - **Financial Buyers:** Search funds, PE firms, family offices
2. Prepare marketing materials:
   - Confidential Information Memorandum (CIM)
   - Financial package (3-5 years historical + projections)
   - Operational documentation
3. Engage M&A advisor (Renew network or external):
   - Determine marketing strategy
   - Coordinate buyer outreach
   - Manage process and timeline

**Outcomes:**
- 5-10 qualified buyers identified
- Marketing materials prepared
- Sale process launched

**Emotional State:** Anticipation, nervous about exposure, excited about outcome

---

### Step 4: Negotiation & Sale

**Trigger:** Buyers engaged → LOIs received

**Pages:**
- /exit-planning/process
- /acquisition-support/experts (advisors)

**Actions:**
1. Review and compare LOIs:
   - Price, structure, terms
   - Buyer credibility and cultural fit
   - Timeline and contingencies
2. Negotiate final terms:
   - Work with M&A advisor
   - Balance price, structure, and risk
   - Address buyer concerns
3. Execute sale:
   - Final due diligence (buyer vetting business)
   - Purchase agreement negotiation
   - Closing and transition
4. Transition support (if required):
   - 3-6 month handover period
   - Training new owner
   - Customer/team introductions

**Outcomes:**
- **Business sold!** Exit executed successfully
- Multiple of 4-6x EBITDA (value created)
- Capital realized for next chapter
- Potential to re-enter as serial acquirer

**Emotional State:** Relief, satisfaction, pride, ready for next chapter

---

### Exit Planning Journey Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Exit Readiness Score** | 70+ | Avg. score at assessment |
| **Value Optimization Time** | 12-18 months | Avg. time from assessment to sale launch |
| **Valuation Multiple** | 4-6x EBITDA | Avg. exit multiple |
| **Value Created** | 2-3x | Multiple of exit price vs. acquisition price |
| **Time to Close** | 6-12 months | Avg. time from launch to close |
| **Successful Exit Rate** | 70% | % completing sale vs. withdrawing |

---

## Cross-Journey Touchpoints

**Features Used Across All Personas:**

### 1. Dashboard (Home)
- **Purpose:** Overview of progress and key metrics
- **Usage:** Daily (owners) → Weekly (searchers) → 2-3x/week (explorers)
- **Content:** Personalized by journey stage

### 2. Network
- **Purpose:** Community, mentorship, peer support
- **Usage:** Explorers seek validation, Searchers seek advice, Owners mentor
- **Value:** Peer learning, reduced isolation, referrals

### 3. Resources
- **Purpose:** Educational content and tools
- **Usage:** High during Discovery, moderate during Acquisition, low post-acquisition
- **Content:** Articles, courses, templates, reports, tools

### 4. Settings
- **Purpose:** Profile, subscription, preferences management
- **Usage:** Occasional (setup, upgrades, changes)
- **Content:** Personal info, billing, notifications, documents

### 5. Expert Network
- **Purpose:** On-demand access to specialists
- **Usage:** All phases (lawyers, accountants, advisors, coaches)
- **Value:** High-quality, vetted professionals in Renew network

---

## Journey Metrics & Success Criteria

### Overall Platform Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Signup → Onboarding Completion** | % completing onboarding flow | 85% |
| **Onboarding → Readiness Assessment** | % completing quiz within 7 days | 70% |
| **Readiness → Lead de Cadrage** | % completing criteria builder | 60% |
| **Explorer → Active Searcher Conversion** | % upgrading to Professional tier | 40% |
| **Active Searcher → Deal Closed** | % closing acquisition deal | 30% |
| **Deal Closed → Enterprise Subscription** | % of owners subscribing to Enterprise + OP | 80% |
| **Enterprise Retention (Annual)** | % renewing Enterprise subscription | 90% |
| **Exit Completion Rate** | % of owners successfully exiting | 70% |

### Engagement Metrics by Phase

| Phase | Login Frequency | Avg. Session Length | Key Actions |
|-------|----------------|---------------------|-------------|
| **Discovery** | 2-3x/week | 15-30 min | Assessments, learning, community |
| **Acquisition** | Daily | 30-60 min | Deal browsing, pipeline, coaching |
| **Post-Acquisition** | Daily → Weekly | 10-45 min | KPIs, coaching, peer groups |
| **Exit Planning** | Weekly | 20-40 min | Optimization tracking, buyer research |

### Revenue Metrics by Journey Stage

| Phase | Avg. Subscription | Avg. Duration | LTV |
|-------|------------------|---------------|-----|
| **Discovery** | €99/month | 6 months | €594 |
| **Acquisition** | €249/month | 15 months | €3,735 |
| **Post-Acquisition** | €349/month + €2,000 OP | 24 months | €56,376 |
| **Exit Planning** | €349/month | 18 months | €6,282 |
| **Lifetime Total** | - | 63 months | **€66,987** |

**Key Insight:** 84% of total LTV comes from Post-Acquisition phase (Enterprise + Operating Partner retainer).

---

## Journey Optimization Opportunities

### Increase Discovery → Acquisition Conversion (Target: 40% → 60%)
- Improve readiness assessment (more actionable recommendations)
- Shorten learning paths (prioritize critical knowledge)
- Increase consultation touchpoints (human validation)
- Showcase peer success stories (validation and motivation)

### Reduce Time to Close (Target: 18 months → 12 months)
- Improve deal flow quality (better matching)
- Increase coaching availability (reduce friction)
- Streamline financing process (lender partnerships)
- Provide negotiation templates and playbooks

### Increase Post-Acquisition Retention (Target: 90% → 95%)
- Proactive Operating Partner outreach (prevent churn)
- Celebrate milestones (reinforce value)
- Peer advisory circles (community retention)
- Value demonstration (ROI tracking and reporting)

### Increase Exit Success Rate (Target: 70% → 80%)
- Earlier exit planning (start conversations at 18 months)
- Value optimization roadmaps (maximize sale price)
- Buyer matching via Renew network (platform advantage)
- M&A advisor vetting and partnerships

---

*These journeys should inform feature prioritization, UX design, and customer success strategies. Reference this document when planning product roadmap, writing copy, or analyzing user behavior.*

---

**Related Documents:**
- [User Personas](user-personas.md) - Detailed persona profiles
- [Feature Requirements](feature-requirements.md) - Features mapped to journey stages
- [Information Architecture](information-architecture.md) - Platform structure
- [Product Overview](product-overview.md) - High-level product context
