# Discovery Phase - Deep Dive Analysis

## Overview

The Discovery Phase is the **most thoroughly specified section** of the Re-New dashboard. It serves as the **mandatory entry point** for all new users and is designed to assess readiness and establish the matching criteria for acquisition opportunities.

**Location:** `/02_PAGE_SPECIFICATIONS/03-discovery/` (6 complete specifications)

---

## 1. Discovery Phase Architecture

```
User Signup
    |
    v
Discovery Hub (/discovery)
    |
    +---> Readiness Quiz (/discovery/readiness-quiz)
    |         |
    |         v
    |     Results (/discovery/results)
    |         |
    |         v
    |     Lead de Cadrage (/discovery/lead-de-cadrage) [MANDATORY]
    |         |
    |         v
    |     Learning Path (/discovery/learning-path)
    |         |
    |         v
    |     Expert Consultation (/discovery/consultation) [PREMIUM]
    |
    +---> Dashboard Access (once Lead de Cadrage complete)
```

---

## 2. Hub Page (/discovery)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/hub.md`

**Purpose:** Landing page for discovery phase with overview and access to all tools

**Components:**
- Hero section with icon + headline + CTA
- Progress overview card showing:
  - Readiness Quiz status
  - Lead de Cadrage status
  - Consultation booking status
  - Overall completion %
- Tool cards grid (2 columns):
  - Readiness Assessment
  - Acquisition Criteria Builder
  - Learning Path
  - Expert Consultation (premium, locked)

**States:**
- Not started (show "Start" CTAs)
- Partially completed (show "Continue" CTAs)
- Fully completed (show checkmarks and "View" CTAs)
- Premium gate (Consultation card locked for free users)

---

## 3. Readiness Assessment Quiz (/discovery/readiness-quiz)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/readiness-quiz.md`

**Purpose:** Self-diagnostic tool to assess if user is ready for acquisition entrepreneurship

**Structure:**
- Single-column centered quiz interface
- 20 questions total
- 3 major sections
- Progress tracking (X/20 displayed at top)
- Auto-save after each answer
- Back/Next navigation

### Questions Breakdown

**SECTION 1: FINANCIAL READINESS (7 Questions)**

Question 1: Capital Available
- Radio buttons: €50K, €50-150K, €150-300K, €300-500K, €500K+
- Scoring impact: High - capital is critical for acquisitions

Question 2: Monthly Runway
- Options: 3 months, 6 months, 12 months, 18+ months
- Assesses financial cushion for acquisition search

Question 3: Risk Tolerance
- Scale: 1-5 (very low to very high)
- Slider input
- Important for realistic deal assessment

Question 4: Debt Comfort
- Radio: Yes, No, Maybe
- Assesses willingness to use leverage

Question 5: Income Requirements
- Radio: Can go 6+ months without salary vs. need income
- Tests financial independence

Question 6: Financial Dependents
- Options: 0, 1-2, 3+
- Family obligations factor

Question 7: Emergency Fund
- Options: 3 months, 6 months, 12+ months
- Financial stability indicator

**SECTION 2: OPERATIONAL READINESS (7 Questions)**

Question 1: Years of Professional Experience
- Options: 0-5, 5-10, 10-15, 15+
- Career progression assessment

Question 2: P&L Ownership Experience
- Radio: None, Partial, Full
- Profit/loss responsibility experience

Question 3: Team Management Experience
- Options: 0, 1-5 people, 5-20, 20+
- Leadership experience level

Question 4: Industry Expertise
- Dropdown: None, Some knowledge, Expert
- Domain knowledge

Question 5: Operational Skills (Multi-select)
- Checkboxes: Sales, Operations, Finance, Technology
- Identifies skill gaps and strengths

Question 6: Deal Evaluation Experience
- Radio: Never evaluated, 1-3 deals, 3+ deals
- M&A experience level

Question 7: SME Exposure
- Radio: Yes/No
- Has worked in Small-Medium Enterprise

**SECTION 3: PERSONAL READINESS (6 Questions)**

Question 1: Primary Motivation
- Radio: Autonomy, Wealth, Impact, Learning
- Identifies core driver

Question 2: Timeline
- Options: Exploring, 12-18 months, 6-12 months, Immediate
- Urgency and commitment level

Question 3: Geographic Flexibility
- Radio: Current city only, Regional, National, International
- Willingness to relocate

Question 4: Family Support
- Radio: Fully supportive, Neutral, Concerns, Opposed
- Family buy-in assessment

Question 5: Work-Life Balance Expectations
- Radio: Maintain balance, Willing to sacrifice short-term, All-in
- Commitment level expectations

Question 6: Failure Tolerance
- Scale: 1-5 (would devastate to calculated risk)
- Risk appetite and resilience

### UI/UX Patterns

**Progress Display:**
- Header shows "Question 3 of 20"
- Progress bar visually shows completion
- Section label (Financial/Operational/Personal) visible

**Question Display:**
- Clear, single question per screen
- Section context
- Answer options clearly laid out
- Next button only enabled after answer selected

**Navigation:**
- Back button (returns to previous question)
- Next button (saves answer, goes to next)
- Save & Exit (preserves progress, returns to Hub)
- Auto-save (every answer saved immediately to backend)

**Loading & States:**
- Skeleton screens while loading questions
- Shimmer effect
- Error recovery (if load fails)

---

## 4. Results Page (/discovery/results)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/results.md`

**Purpose:** Display quiz results, identify gaps, recommend learning paths

**Components:**
- Overall readiness score (percentage or grade)
- Section-by-section breakdown:
  - Financial Readiness: [X/7 points]
  - Operational Readiness: [X/7 points]
  - Personal Readiness: [X/6 points]
- Gap analysis:
  - Identified weaknesses
  - Recommended improvements
- Learning recommendations based on gaps
- Call-to-action to Lead de Cadrage

**Scoring System:**
- Each question has a scoring weight
- Gaps identified based on low scores in sections
- Personalized learning path generated based on gaps

**Next Step:**
- Prominent CTA to "Build Your Acquisition Criteria" (Lead de Cadrage)
- Option to retake quiz later

---

## 5. Lead de Cadrage Builder (/discovery/lead-de-cadrage)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/lead-de-cadrage.md`

**STATUS: MANDATORY** - Users cannot access deal flow without completing this

**Purpose:** Define ideal acquisition criteria to enable deal matching and filtering

### Lead de Cadrage Means "Scope Definition"

This is the **critical matching profile** - all deal recommendations and filtering are based on these criteria.

### Form Structure

**Layout:**
- Left sidebar with 7 section navigation
- Right side: form content area
- Progress indicator: "4/7 sections complete"
- Section completion checkmarks
- Save & Exit button

### 7 Sections Detailed

**SECTION 1: GEOGRAPHY**

Question: "Where are you willing to search for businesses?"

Fields:
1. Primary Country (single select dropdown)
   - France
   - Italy
   - Belgium
   - Spain
   - Germany
   - Other (text input)

2. Secondary Countries (multi-select)
   - Expand search to other countries

3. Relocation Willingness (checkbox)
   - "I'm willing to relocate"

4. Preferred Regions (conditional, if France selected)
   - Checkboxes for French regions:
     - Île-de-France
     - Auvergne-Rhône-Alpes
     - Provence-Alpes-Côte d'Azur
     - [other regions...]

5. Urban vs. Rural (radio)
   - Urban centers
   - Rural/suburban
   - No preference

**SECTION 2: INDUSTRY**

Question: "Which industries interest you most?"

Fields:
1. Preferred Industries (multi-select, max 5)
   - Manufacturing
   - Professional Services
   - Healthcare
   - Technology
   - Retail & E-commerce
   - Hospitality & Tourism
   - Construction & Real Estate
   - Education
   - Food & Beverage
   - Other (text input)

2. Must-Avoid Industries (multi-select)
   - Same list as above
   - For each selected:
     - Dropdown reason: "I lack expertise" / "Ethical concerns" / "High risk" / "Other"

3. Industry Expertise (dropdown)
   - None
   - Some knowledge
   - Expert

**SECTION 3: SIZE**

Question: "What size business are you looking for?"

Fields:
1. Revenue Range (dual slider)
   - Min: €500K
   - Max: €10M
   - Default: €1M - €5M
   - Text inputs for exact values

2. Employee Count (dual slider)
   - Min: 5
   - Max: 100+
   - Default: 10 - 50

3. EBITDA Range (dual slider)
   - Min: €100K
   - Max: €2M
   - Default: €200K - €800K

4. Age of Business (dropdown)
   - 5+ years
   - 10+ years
   - 20+ years
   - No preference

5. Growth Stage (radio)
   - Stable/mature
   - Growing
   - Declining (turnaround)
   - No preference

**SECTION 4: BUSINESS MODEL**

Question: "What business model interests you?"

Fields:
1. B2B vs. B2C (radio)
   - B2B only
   - B2C only
   - Either

2. Revenue Type (checkboxes)
   - Recurring (subscriptions, contracts)
   - Project-based
   - Transactional (one-time sales)
   - Mixed

3. Customer Concentration (dropdown)
   - No single customer >20%
   - Willing to accept concentration
   - No preference

4. Digital vs. Physical (radio)
   - Primarily digital
   - Primarily physical
   - Hybrid
   - No preference

5. Seasonality (radio)
   - Year-round revenue
   - Willing to accept seasonality
   - No preference

**SECTION 5: FINANCIAL PROFILE**

Question: "What are your financial expectations?"

Fields:
1. EBITDA Margin (slider)
   - Min: 5%
   - Max: 40%
   - Default: 15% minimum

2. Revenue Growth (dropdown)
   - Stable (0-5% YoY)
   - Moderate (5-15%)
   - High (15%+)
   - No preference

3. Debt Tolerance (radio)
   - Prefer no debt
   - Some debt acceptable
   - Willing to take on debt

4. Cash Flow (radio)
   - Positive cash flow required
   - Break-even acceptable
   - Willing to invest for turnaround

5. Historical Performance (radio)
   - 3+ years profitability
   - 1+ year profitability
   - Can be break-even

**SECTION 6: YOUR ROLE**

Question: "How involved do you want to be?"

Fields:
1. Involvement Level (radio)
   - Hands-on operator (day-to-day management)
   - Strategic owner (weekly oversight)
   - Passive investor (quarterly check-ins)

2. Management Team (radio)
   - Prefer existing team in place
   - Willing to build/replace team
   - No preference

3. Skills You Bring (checkboxes)
   - Sales & Marketing
   - Operations & Process
   - Finance & Strategy
   - Technology & Innovation
   - People & Culture
   - Product Development

4. Work Style (radio)
   - Solo leadership
   - Co-owner partnership
   - Family business succession

**SECTION 7: DEAL STRUCTURE**

Question: "How do you want to structure the deal?"

Fields:
1. Purchase Price Range (dual slider)
   - Min: €500K
   - Max: €10M
   - Auto-suggested based on revenue/EBITDA from Section 3
   - Default: €1M - €5M

2. Equity Ownership (slider)
   - Min: 51%
   - Max: 100%
   - Default: 100% (full ownership)

3. Financing Structure (checkboxes)
   - Bank loan / SBA equivalent
   - Seller financing
   - Investor equity
   - Personal capital
   - Hybrid (multiple sources)

4. Timeline (dropdown)
   - 6 months
   - 12 months
   - 18 months
   - No rush

5. Earnout Willingness (radio)
   - Prefer no earnout
   - Open to earnout
   - No preference

### Navigation & Interaction

**Section Navigation:**
- Click section in sidebar to jump to that section
- Back/Next buttons to navigate sequentially
- Each section must be completed before proceeding to next
- Validation: Shows error if required fields empty

**Auto-Save:**
- Every field change saved immediately
- Server-side persistence
- Resume from last saved section if user closes and returns

**Progress Tracking:**
- Visual progress indicator (X/7)
- Checkmarks on completed sections
- Current section highlighted

**Completion:**
- All 7 sections must be complete
- "Build Profile" button appears
- User can now access deal flow

---

## 6. Learning Path (/discovery/learning-path)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/learning-path.md`

**Purpose:** Recommend personalized learning resources based on readiness assessment gaps

**Components:**
- Personalized course recommendations
- Learning progress tracking
- Course categories:
  - Financial preparation
  - Operational readiness
  - Personal development
  - Deal evaluation
  - Post-acquisition topics
- Course completion badges
- Estimated time to complete

---

## 7. Expert Consultation (/discovery/consultation)

**File:** `/Users/ivanpaudice/Library/Mobile Documents/com~apple~CloudDocs/Progetti/Re-New/02_PAGE_SPECIFICATIONS/03-discovery/consultation.md`

**Purpose:** Premium feature - Book 1-on-1 consultation with readiness expert

**Status:** Premium only (gated feature)

**Components:**
- Expert profile cards
- Calendar integration for booking
- Consultation types offered
- Pricing information
- Testimonials

**Call-to-Action:**
- Free users see "Upgrade to Access"
- Premium users see "Book Consultation"

---

## Key Implementation Insights

### 1. Form Patterns Established

The discovery phase establishes **two critical form patterns** that repeat throughout the app:

**Pattern A: Sequential Quiz**
- Single question per screen
- Progress tracking
- Auto-save
- Linear navigation
- Used in: Readiness Quiz, other assessments

**Pattern B: Multi-Step Form**
- Multiple fields per section
- Sidebar navigation
- Validation on proceed
- Auto-save
- Used in: Lead de Cadrage, other detailed forms

### 2. Critical User Decision Points

1. **After Readiness Quiz:** Are they ready? Or need learning?
2. **Lead de Cadrage Completion:** Only then access deal flow
3. **Matching Logic:** Lead de Cadrage becomes the "match profile"

### 3. Data Structure

Discovery phase data includes:

```
{
  user_id: string,
  readiness_quiz: {
    financial_readiness: [answers...],
    operational_readiness: [answers...],
    personal_readiness: [answers...],
    completion_date: timestamp,
    score: number
  },
  lead_de_cadrage: {
    geography: {...},
    industry: {...},
    size: {...},
    business_model: {...},
    financial_profile: {...},
    your_role: {...},
    deal_structure: {...},
    completion_date: timestamp,
    status: "not_started" | "in_progress" | "completed"
  },
  learning_path: {
    recommended_courses: [...],
    progress: {...}
  }
}
```

### 4. Accessibility Requirements

All discovery pages include:
- WCAG AA compliance (4.5:1 contrast minimum)
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support (ARIA labels)
- Focus management
- Error messaging clarity

### 5. Analytics Events

Discovery phase events tracked:
- discovery_hub_viewed
- readiness_quiz_started
- readiness_quiz_completed
- readiness_quiz_results_viewed
- lead_de_cadrage_started
- lead_de_cadrage_section_completed
- lead_de_cadrage_completed
- learning_path_viewed
- consultation_booked

---

## Development Implementation Order

1. **Build Form Components First**
   - Quiz form (sequential, single question)
   - Multi-step form (Lead de Cadrage)
   - Establish patterns for reuse

2. **Implement Readiness Quiz**
   - Establish question types
   - Question navigation
   - Auto-save mechanism
   - Results calculation

3. **Build Lead de Cadrage**
   - 7-section form with sidebar
   - Field validation
   - Progress tracking
   - Completion state

4. **Add Results Display**
   - Score calculation
   - Gap identification
   - Recommendation engine

5. **Create Learning Path**
   - Course recommendations
   - Progress tracking

6. **Add Premium Features**
   - Consultation booking
   - Expert profiles

---

## Critical Success Factors

1. **Auto-save is essential** - Users may start and abandon
2. **Lead de Cadrage completion is mandatory** - Gate to deal flow
3. **Mobile responsiveness critical** - Forms must work on phone
4. **Error handling** - Forms must gracefully handle validation failures
5. **Clear feedback** - Users need to know progress and status

---

Generated: November 12, 2025
Source: `/02_PAGE_SPECIFICATIONS/03-discovery/` (6 comprehensive specification files)
