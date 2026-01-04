# Page Specification: Readiness Assessment Results

**Route:** `/discovery/results`
**Section:** Discovery
**Authentication Required:** Yes

---

## Purpose

Display personalized readiness assessment results with overall score, category breakdown, gap analysis, and actionable recommendations to help users understand their preparedness for acquisition entrepreneurship.

---

## Layout Structure

Scrollable results page with hero score section and detailed breakdowns

```
┌─────────────────────────────────────┐
│  [← Back to Discovery]              │
│  ─────────────────────────────────  │
│                                     │
│  Your Acquisition Readiness         │
│                                     │
│      ┌─────────────┐                │
│      │     78      │ Ready to       │
│      │   ──────    │ Begin Your     │
│      │    /100     │ Journey        │
│      └─────────────┘                │
│                                     │
│  Financial    ████████░░  80%       │
│  Operational  ███████░░░  70%       │
│  Personal     █████████░  85%       │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Gap Analysis                  │  │
│  │ Areas to Strengthen:          │  │
│  │ • Operational experience      │  │
│  │ • P&L ownership               │  │
│  └──────────────────────────────┘  │
│                                     │
│  Recommended Next Steps:            │
│  1. [Build Your Criteria]           │
│  2. [Take These 3 Courses]          │
│  3. [Book a Consultation]           │
│                                     │
│  [Download PDF Report]              │
│  [Retake Assessment]                │
└─────────────────────────────────────┘
```

---

## Key Components

### Hero Score Section
- **Overall Readiness Score:** Large circular progress indicator (0-100)
- **Readiness Level:** Text label based on score
  - 0-40: "Building Foundation" (orange)
  - 41-65: "Developing Readiness" (yellow)
  - 66-85: "Ready to Begin" (green)
  - 86-100: "Highly Prepared" (dark green)
- **Date Completed:** Timestamp of assessment

### Category Breakdown
**Three Category Cards:**
1. **Financial Readiness**
   - Score (0-100)
   - Progress bar visualization
   - Icon (dollar sign)
   - Status: "Strong" / "Adequate" / "Needs Work"

2. **Operational Readiness**
   - Score (0-100)
   - Progress bar visualization
   - Icon (briefcase)
   - Status: "Strong" / "Adequate" / "Needs Work"

3. **Personal Readiness**
   - Score (0-100)
   - Progress bar visualization
   - Icon (heart)
   - Status: "Strong" / "Adequate" / "Needs Work"

### Gap Analysis Section
**Identified Gaps:**
- List of specific areas to strengthen (based on low-scoring answers)
- Prioritized by importance (critical gaps first)
- Each gap includes:
  - Gap name (e.g., "Limited P&L ownership experience")
  - Why it matters (brief explanation)
  - Suggested action (course, consultation, resource)

**Example Gaps:**
- Financial: "Limited capital runway" → "Consider part-time search or build savings"
- Operational: "No team management experience" → "Seek management roles or volunteer leadership"
- Personal: "Family concerns about risk" → "Book consultation to discuss family alignment"

### Strengths Section
**Your Strengths:**
- Highlight top 3-5 strengths from assessment
- Positive reinforcement for what they're doing right
- Examples:
  - "Strong risk tolerance and entrepreneurial mindset"
  - "Sufficient capital for €1-3M acquisitions"
  - "Geographic flexibility and relocation willingness"

### Recommendations Section
**Personalized Next Steps:**

Dynamically generated based on readiness level:

**High Readiness (66-100):**
1. ✅ **Build Your Acquisition Criteria** (Lead de Cadrage)
   - "You're ready to define your target business."
   - CTA: "Build Criteria →"

2. ✅ **Explore Deal Flow** (Professional Tier upgrade)
   - "Start viewing opportunities matching your profile."
   - CTA: "View Deals →" (upgrade prompt if Starter tier)

3. ✅ **Book Consultation** (validate readiness)
   - "Discuss your criteria and timeline with an advisor."
   - CTA: "Book Now →"

**Medium Readiness (41-65):**
1. ✅ **Address Key Gaps** (personalized)
   - "Strengthen [specific gap] over next 3-6 months."
   - CTA: "View Courses →"

2. ✅ **Build Your Criteria** (even if gaps exist)
   - "Clarify your acquisition criteria to guide preparation."
   - CTA: "Build Criteria →"

3. ✅ **Join Community**
   - "Connect with peers and learn from their journeys."
   - CTA: "Explore Network →"

**Low Readiness (0-40):**
1. ✅ **Start with Education** (Learning Path)
   - "Build foundational knowledge before acquisition search."
   - CTA: "View Learning Path →"

2. ✅ **Book Consultation** (validate direction)
   - "Discuss whether acquisition is right for you now."
   - CTA: "Book Consultation →"

3. ✅ **Revisit in 6-12 Months**
   - "Work on identified gaps and retake assessment."
   - CTA: "Download Gap Closure Plan →"

### Detailed Results (Expandable Sections)

**Financial Readiness Details:**
- Capital Available: [user's answer + interpretation]
- Runway: [user's answer + interpretation]
- Risk Tolerance: [user's answer + interpretation]
- Debt Comfort: [user's answer + interpretation]
- Summary: "You have adequate capital (€150-300K) for €1-3M acquisitions with seller financing."

**Operational Readiness Details:**
- Years of Experience: [answer + interpretation]
- P&L Ownership: [answer + interpretation]
- Team Management: [answer + interpretation]
- Industry Expertise: [answer + interpretation]
- Summary: "You have strong general management skills but limited SME-specific experience."

**Personal Readiness Details:**
- Primary Motivation: [answer + interpretation]
- Timeline: [answer + interpretation]
- Geographic Flexibility: [answer + interpretation]
- Family Support: [answer + interpretation]
- Summary: "You're highly motivated and have family support, critical for long-term success."

### Actions
- **Download PDF Report:** Full results + recommendations in PDF format
- **Retake Assessment:** Start over (replaces current results)
- **Share Results:** (Optional) Share with advisor or mentor
- **Next Step CTAs:** Prominent buttons for recommended actions

---

## Interactive Elements

1. **Category Cards:**
   - Click to expand detailed breakdown
   - Collapse to see summary only

2. **Gap Analysis:**
   - Hover over gap → tooltip with explanation
   - Click gap → navigate to relevant resource (course, guide)

3. **Recommendations:**
   - Clear CTAs for each next step
   - Track clicks (analytics)

4. **Download PDF:**
   - Generate PDF with full results
   - Include: scores, gaps, strengths, recommendations
   - Downloadable for offline reference

5. **Retake Assessment:**
   - Confirmation modal: "This will replace your current results. Continue?"
   - Redirect to `/discovery/readiness-quiz`

6. **Celebration Animation:**
   - If high score (66+), brief confetti animation on load
   - Positive reinforcement for preparedness

---

## Navigation

### FROM
- Readiness Quiz (`/discovery/readiness-quiz`) - After completing final question
- Discovery Hub (`/discovery`) - If assessment already completed, "View Results" button

### TO
- Lead de Cadrage (`/discovery/lead-de-cadrage`) - "Build Criteria" CTA
- Learning Path (`/discovery/learning-path`) - "View Courses" CTA
- Consultation Booking (`/discovery/consultation`) - "Book Consultation" CTA
- Deal Flow (`/deal-flow/browse`) - "View Deals" CTA (upgrade prompt if needed)
- Discovery Hub (`/discovery`) - "Back to Discovery" link
- Readiness Quiz (`/discovery/readiness-quiz`) - "Retake Assessment" button

---

## Content

**Hero Section:**
- **Headline:** "Your Acquisition Readiness"
- **Score Display:** Large number (78) with "/100" below
- **Readiness Level:** "Ready to Begin Your Journey" (based on score)
- **Subheadline:** "Based on your responses, here's how prepared you are for acquisition entrepreneurship."

**Category Summaries:**
- **Financial Readiness:** "You have [adequate/strong/limited] capital and financial runway for acquisition search."
- **Operational Readiness:** "You have [strong/moderate/limited] relevant experience managing businesses."
- **Personal Readiness:** "You demonstrate [strong/moderate/limited] motivation and support for this path."

**Gap Analysis Intro:**
- **Headline:** "Areas to Strengthen"
- **Message:** "Every successful repreneur has gaps. Here's what to focus on over the next 3-6 months:"

**Strengths Intro:**
- **Headline:** "Your Strengths"
- **Message:** "You're already strong in these critical areas:"

**Recommendations Intro:**
- **Headline:** "Recommended Next Steps"
- **Message:** "Based on your readiness level, here's what we suggest:"

**Retake Assessment Note:**
- "We recommend retaking this assessment every 6 months as you progress."

---

## States

### 1. Loading Results
- Show loading spinner
- "Calculating your readiness..."
- Brief (2-3 seconds) before displaying results

### 2. Results Displayed
- Hero score animates (counts up from 0 to final score)
- Category bars animate (fill from left to right)
- Content fades in sequentially

### 3. High Score Celebration (66+)
- Confetti animation (brief, 2 seconds)
- Positive message: "Great job! You're ready to begin your acquisition journey."

### 4. Low Score Guidance (0-40)
- Supportive message: "Building readiness takes time. Here's how to get started:"
- Emphasize: "Many successful repreneurs started here."

### 5. Detailed View Expanded
- Click category → expand detailed breakdown
- Smooth animation (slide down)
- Collapse icon (chevron up)

### 6. Download PDF Loading
- Click "Download PDF" → Show spinner
- "Generating your report..."
- PDF downloads to browser

### 7. Retake Confirmation
- Modal: "Retake Assessment?"
- Message: "Your current results will be replaced. You can download them first."
- Actions: "Cancel" / "Download First" / "Retake Now"

---

## Edge Cases

### No Results Yet
- If user navigates to `/discovery/results` without completing quiz
- Redirect to `/discovery` with message: "Complete the readiness assessment first."

### Results Expired (Optional)
- If results older than 12 months, show banner:
- "Your results are from [date]. Consider retaking for updated guidance."
- CTA: "Retake Assessment"

### PDF Generation Fails
- Show error: "Unable to generate PDF. Please try again."
- Retry button
- Alternative: "Email results to me" option

### Very Low Score (0-20)
- Compassionate messaging: "Acquisition entrepreneurship requires significant preparation."
- Recommend: "Consider consulting with a career coach first."
- No pressure to proceed immediately

### Perfect Score (100)
- Rare, but celebrate: "Exceptional! You're in the top 1% of candidates."
- Encourage: "You're ready to move fast. Book a consultation to get started."

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through all interactive elements
  - Enter to expand/collapse sections
  - Arrow keys to navigate recommendations

- **Screen Reader:**
  - Announce readiness score: "Your readiness score is 78 out of 100"
  - Announce category scores: "Financial readiness: 80 percent"
  - Read gap analysis items in order
  - Announce state changes (expanded/collapsed)

- **Color Contrast:** 4.5:1 minimum

- **ARIA:**
  - `role="progressbar"` on score indicators
  - `aria-valuemin="0"` `aria-valuemax="100"` `aria-valuenow="78"`
  - `aria-expanded="false"` on collapsible sections
  - `aria-label` on all interactive elements

---

## Analytics

**Events:**
1. "readiness_results_viewed" (score, category_scores)
2. "readiness_category_expanded" (category)
3. "readiness_pdf_downloaded"
4. "readiness_retake_clicked"
5. "readiness_next_step_clicked" (action: criteria, courses, consultation, deals)
6. "readiness_gap_clicked" (gap_id)

**Metrics to Track:**
- Score distribution (histogram)
- Category score averages
- Common gaps identified
- Most clicked recommendations
- PDF download rate
- Retake rate
- Conversion to next step (criteria, courses, consultation)

---

## Technical Notes

**API Endpoint:** `GET /api/discovery/readiness-quiz/results`

**Response (200):**
```json
{
  "overallScore": 78,
  "readinessLevel": "ready_to_begin",
  "completedDate": "2025-11-12T10:30:00Z",
  "categoryScores": {
    "financial": 80,
    "operational": 70,
    "personal": 85
  },
  "gaps": [
    {
      "id": "op-pl-ownership",
      "category": "operational",
      "title": "Limited P&L ownership experience",
      "description": "...",
      "priority": "high",
      "suggestedAction": {
        "type": "course",
        "title": "Financial Management for First-Time Owners",
        "url": "/resources/courses/financial-management"
      }
    }
  ],
  "strengths": [
    {
      "category": "financial",
      "title": "Strong capital position",
      "description": "..."
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Build Your Acquisition Criteria",
      "description": "...",
      "cta": {
        "text": "Build Criteria",
        "url": "/discovery/lead-de-cadrage"
      }
    }
  ],
  "detailedResults": {
    "financial": {...},
    "operational": {...},
    "personal": {...}
  }
}
```

**PDF Generation:** `POST /api/discovery/readiness-quiz/generate-pdf`

**Response (200):**
```json
{
  "pdfUrl": "https://cdn.renew.com/reports/user-123-readiness-2025-11-12.pdf",
  "expiresAt": "2025-11-19T10:30:00Z"
}
```

**Scoring Logic:**
- Each question assigned weight (1-5 based on importance)
- Category scores = weighted average of category questions
- Overall score = weighted average of category scores
- Readiness level determined by overall score thresholds

---

## Design System References

**Components:** Progress Bar, Score Display, Card, Badge, Button, Modal
**Colors:**
- Success `#10B981` (high scores)
- Warning `#F59E0B` (medium scores)
- Error `#EF4444` (low scores)
- Primary `#2D65F8` (CTAs)
**Typography:** H1 48px Bold (score), H2 32px Bold (section), Body 16px Regular
**Spacing:** Section gaps 48px, card padding 24px

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
