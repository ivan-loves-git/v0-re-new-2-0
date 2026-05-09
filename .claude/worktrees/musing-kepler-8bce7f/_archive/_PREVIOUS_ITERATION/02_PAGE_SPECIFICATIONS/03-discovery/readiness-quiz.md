# Page Specification: Readiness Assessment Quiz

**Route:** `/discovery/readiness-quiz`
**Section:** Discovery
**Authentication Required:** Yes

---

## Purpose

Help users assess their readiness for acquisition entrepreneurship through a structured self-diagnostic quiz covering financial, operational, and personal readiness.

---

## Layout Structure

Single-column centered quiz interface with progress tracking

```
┌─────────────────────────────────────┐
│  [Logo] [Progress: 3/20]     [X]   │
│  ────────────────────────────────   │
│                                     │
│  Section: Financial Readiness       │
│                                     │
│  How much capital do you have       │
│  available for acquisition?         │
│                                     │
│  ○ Less than €50K                   │
│  ○ €50K - €150K                     │
│  ○ €150K - €300K                    │
│  ○ €300K - €500K                    │
│  ○ More than €500K                  │
│                                     │
│  [Back]              [Next →]       │
└─────────────────────────────────────┘
```

---

## Key Components

### Quiz Header
- Logo (top left)
- Progress indicator: "Question 3 of 20" + progress bar
- Exit button (X) - saves progress and returns to Discovery Hub

### Question Display
- Section label (Financial / Operational / Personal)
- Question text (clear, concise)
- Question type indicators:
  - Single choice (radio buttons)
  - Multiple choice (checkboxes)
  - Scale (1-5 slider)
  - Text input (short answer)

### Question Types

**Financial Readiness (7 questions):**
1. Capital available (€50K, €50-150K, €150-300K, €300-500K, €500K+)
2. Monthly runway (3 months, 6 months, 12 months, 18+ months)
3. Risk tolerance (very low → very high, 1-5 scale)
4. Debt comfort (willing to take on debt: yes/no/maybe)
5. Income needs (can you go 6+ months without salary: yes/no)
6. Financial dependents (0, 1-2, 3+)
7. Emergency fund (3 months, 6 months, 12+ months)

**Operational Readiness (7 questions):**
1. Years of professional experience (0-5, 5-10, 10-15, 15+)
2. P&L ownership experience (none, partial, full)
3. Team management experience (0, 1-5 people, 5-20, 20+)
4. Industry expertise (none, some, expert)
5. Operational skills (sales, ops, finance, tech - checkboxes)
6. Deal evaluation experience (never evaluated, 1-3 deals, 3+ deals)
7. SME exposure (worked in SME: yes/no)

**Personal Readiness (6 questions):**
1. Primary motivation (autonomy, wealth, impact, learning)
2. Timeline (exploring, 12-18 months, 6-12 months, immediate)
3. Geographic flexibility (current city only, regional, national, international)
4. Family support (fully supportive, neutral, concerns, opposed)
5. Work-life balance expectations (maintain balance, willing to sacrifice short-term, all-in)
6. Failure tolerance (would devastate me → calculated risk I accept, 1-5 scale)

### Navigation Controls
- **Back button:** Return to previous question
- **Next button:** Proceed to next question (enabled when answer provided)
- **Save & Exit:** Save progress, return to Discovery Hub
- **Progress auto-save:** Every answer saved immediately

---

## Interactive Elements

1. **Answer Selection:**
   - Radio buttons highlight on selection (blue border)
   - Checkboxes allow multiple selections
   - Sliders show current value as user drags

2. **Progress Tracking:**
   - Progress bar fills as questions completed
   - "Question X of 20" updates dynamically
   - Section transitions indicated ("Now entering: Operational Readiness")

3. **Validation:**
   - "Next" button disabled until answer provided
   - Highlight required fields if user attempts to skip

4. **Auto-Save:**
   - Every answer automatically saved to backend
   - "Saved" checkmark appears briefly after each answer
   - Can resume quiz later from where left off

5. **Exit Handling:**
   - Click X or "Save & Exit" → Confirmation modal
   - "Your progress has been saved. Resume anytime from Discovery Hub."
   - Return to `/discovery`

---

## Navigation

### FROM
- Discovery Hub (`/discovery`) - "Start Readiness Assessment" button
- Dashboard (`/dashboard`) - If quiz incomplete, reminder widget

### TO
- Results page (`/discovery/results`) - Upon completing final question
- Discovery Hub (`/discovery`) - If user exits mid-quiz (progress saved)

---

## Content

**Quiz Introduction (Before Question 1):**
- **Headline:** "Let's Assess Your Acquisition Readiness"
- **Subheadline:** "This 5-minute assessment will help you understand your strengths and gaps."
- **What to Expect:** 20 questions across 3 categories (Financial, Operational, Personal)
- **Privacy:** "Your answers are private and used only to personalize your experience."
- **CTA:** "Start Assessment" button

**Section Transitions:**
- "Financial Readiness Complete! Next: Operational Readiness"
- Brief section intro: "Now let's assess your operational experience and skills."

**Completion Screen:**
- **Headline:** "Assessment Complete!"
- **Message:** "Calculating your results..."
- **Action:** Auto-redirect to `/discovery/results` after 2 seconds

---

## States

### 1. Initial Load
- Show quiz introduction screen
- "Start Assessment" button

### 2. Quiz In Progress
- Display current question
- Progress bar updates
- Back/Next navigation enabled
- Auto-save indicator appears after each answer

### 3. Section Transition
- Brief transition screen (1 second)
- "Financial Readiness Complete! ✓"
- "Next: Operational Readiness"

### 4. Exit Confirmation
- User clicks X or "Save & Exit"
- Modal: "Save your progress and exit?"
- Options: "Yes, Save & Exit" / "Cancel"

### 5. Quiz Complete
- Final question submitted
- "Assessment Complete!" screen
- Loading spinner
- Auto-redirect to results page

---

## Edge Cases

### Incomplete Quiz
- User can resume from Discovery Hub
- "Continue Assessment" button shows progress (e.g., "12/20 questions completed")
- Clicking resumes from next unanswered question

### Network Error During Save
- Retry save automatically (3 attempts)
- If fails, show error: "Unable to save. Check connection and try again."
- Allow user to continue answering (cache locally, sync when online)

### Multiple Devices
- If user starts quiz on desktop, can continue on mobile
- Progress synced across devices
- If quiz open on multiple devices, show warning: "Quiz is open elsewhere. Continue here?"

### Quiz Already Completed
- If user has results, "Start Assessment" changes to "Retake Assessment"
- Confirmation: "You'll replace your current results. Continue?"

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through answer options
  - Enter to select
  - Arrow keys to navigate radio buttons
  - Shift+Tab to go back

- **Screen Reader:**
  - Announce section changes
  - Announce progress updates ("Question 3 of 20")
  - Label all form inputs
  - Announce validation errors

- **Color Contrast:** 4.5:1 minimum for all text

- **ARIA:**
  - `role="radiogroup"` for radio button sets
  - `aria-label` on progress bar
  - `aria-live="polite"` for progress updates
  - `aria-required="true"` on question containers

---

## Analytics

**Events:**
1. "readiness_quiz_started"
2. "readiness_quiz_section_completed" (section_name)
3. "readiness_quiz_question_answered" (question_id, answer)
4. "readiness_quiz_exited" (questions_completed)
5. "readiness_quiz_resumed"
6. "readiness_quiz_completed"

**Metrics to Track:**
- Completion rate (% finishing quiz)
- Time to complete (average)
- Drop-off points (which questions cause exits)
- Answer distribution (for each question)

---

## Technical Notes

**API Endpoint:** `POST /api/discovery/readiness-quiz/answer`

**Payload (Per Answer):**
```json
{
  "userId": "string",
  "questionId": "string",
  "answer": "string or array",
  "timestamp": "ISO 8601"
}
```

**Response (200):**
```json
{
  "saved": true,
  "progress": {
    "questionsCompleted": 12,
    "totalQuestions": 20,
    "currentSection": "operational"
  }
}
```

**Get Quiz State:** `GET /api/discovery/readiness-quiz/state`

**Response (200):**
```json
{
  "inProgress": true,
  "questionsCompleted": 12,
  "totalQuestions": 20,
  "nextQuestionId": "op-3",
  "completed": false
}
```

**Submit Final Answer:** Triggers results calculation

**Scoring Algorithm:**
- Each question weighted by importance
- Category scores calculated (Financial, Operational, Personal)
- Overall readiness score (0-100)
- Gap identification based on low-scoring categories

---

## Design System References

**Components:** Radio Button, Checkbox, Slider, Progress Bar, Button, Modal
**Colors:** Primary `#2D65F8`, Success `#10B981`, Neutral `#6B7280`
**Typography:** H2 24px Bold (question text), Body 16px Regular (options)
**Spacing:** Question padding 32px, option gaps 12px

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
