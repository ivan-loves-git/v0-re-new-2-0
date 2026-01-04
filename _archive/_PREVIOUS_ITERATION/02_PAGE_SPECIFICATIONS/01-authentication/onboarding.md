# Page Specification: Onboarding Wizard

**Route:** `/onboarding`
**Section:** Authentication
**Authentication Required:** Yes (just registered)

---

## Purpose

Guide new users through readiness quiz and Lead de Cadrage setup to personalize their experience.

---

## Layout Structure

Full-screen wizard (no sidebar yet)

```
┌─────────────────────────────────────┐
│  [Progress: Step 1 of 3]            │
│  ┌───────────────────┐              │
│  │                   │              │
│  │  Wizard Content   │              │
│  │   (Centered)      │              │
│  │                   │              │
│  └───────────────────┘              │
│  [Back]  [Skip]  [Next/Complete]    │
└─────────────────────────────────────┘
```

---

## Key Components

### Progress Indicator (Top)
- Progress bar: "Step X of 3"
- Step labels visible: Welcome → Readiness → Criteria

### Step 1: Welcome
- Welcome message: "Welcome to Renew, [First Name]!"
- Subheadline: "Let's get to know you and your acquisition goals"
- Bullet points explaining next steps
- Video/animation (2 min): "How Renew Works"
- "Get Started" button

### Step 2: Readiness Quiz
- Embedded readiness assessment (15-20 questions)
- Categories: Financial, Experience, Personal
- Question types: Multiple choice, scale ratings, yes/no
- Progress within quiz shown
- "Save & Continue Later" option

### Step 3: Lead de Cadrage
- **Industry preferences** (multi-select)
- **Geography** (France regions, checkboxes)
- **Company size** (revenue slider, employee range)
- **Budget** (available capital range)
- **Timeline** (dropdown: <6mo, 6-12mo, 12-24mo, 24+mo)
- **Deal structure** (Asset/Stock/Both)

### Final Screen
- Summary of responses
- "You're All Set!" headline
- Summary cards (readiness score + criteria)
- "Take me to my dashboard" button

### Navigation Buttons
- "Back" (previous step)
- "Skip" (optional, goes to dashboard with prompt)
- "Next" (disabled until step complete)
- "Save & Continue Later"

---

## Interactive Elements

1. **Progress Navigation:** Click step indicator to jump (if completed)
2. **Form Inputs:** Dropdowns, checkboxes, sliders, radio buttons
3. **Video Player:** Play/pause controls
4. **Skip Option:** Confirmation modal "Complete later? You can finish in Discovery section"
5. **Auto-Save:** Saves progress every 30 seconds
6. **Validation:** Real-time for quiz questions, on submit for criteria

---

## Navigation

### FROM
- `/signup` (automatic redirect after registration)
- `/dashboard` (if user skipped, prompt to complete)

### TO
- `/dashboard` (after completion or skip)
- Can exit to dashboard anytime with "Save & Continue Later"

---

## Content

### Welcome Step
**Headline:** "Welcome to Renew, [FirstName]!"
**Subheadline:** "Let's get to know you and your acquisition goals"
**Bullets:**
- "Complete a quick readiness assessment"
- "Define your ideal acquisition criteria"
- "Get personalized recommendations"

**Video:** "How Renew Works" (2 minutes)

### Readiness Quiz
**Section Headers:**
- "Financial Readiness"
- "Experience & Skills"
- "Personal Commitment"

**Example Questions:**
- "What is your available capital?" (Multiple choice)
- "Years of professional experience?" (<5, 5-10, 10-20, >20)
- "Have you managed a team?" (Yes/No)
- "Rate your commitment level" (Scale 1-5)

(See [readiness-quiz.md](../03-discovery/readiness-quiz.md) for complete list)

### Lead de Cadrage
**Help Text:**
- Industry: "Select all industries you'd consider"
- Geography: "Where are you willing to operate?"
- Size: "Larger businesses cost more but easier to finance"

### Completion
**Headline:** "You're All Set!"
**Summary:**
- "Your readiness: [Score]% - [Getting Ready]"
- "You're looking for: [Industry] businesses in [Location], €[X-Y]M revenue"

---

## States

### 1. Step In Progress
- Current step content visible
- Progress bar updates
- Next button enabled/disabled based on completion

### 2. Moving Between Steps
- Brief transition animation (slide left/right)
- Progress bar animates
- Previous content fades out, new fades in

### 3. Validation Error
- Incomplete required fields highlighted
- Error message: "Please complete all required fields"
- Focus moves to first error

### 4. Auto-Saving
- Small "Saved" indicator appears briefly (checkmark)
- No interruption to user flow

### 5. Skip Confirmation
- Modal: "Are you sure? This helps personalize your experience"
- Options: "Go Back" or "Skip for Now"

### 6. Completion
- Success animation (confetti or checkmark)
- "You're All Set!" message
- 2-second display before dashboard redirect

---

## Edge Cases

- **User refreshes:** Resume at last saved step
- **Session expires:** Save progress, redirect to login, then resume
- **Incomplete data:** Allow skip, mark profile as "incomplete" in dashboard
- **Back button (browser):** Show confirmation "Save your progress?"

---

## Accessibility

- Keyboard navigation through all steps
- Skip links to jump forward
- Progress announced to screen readers
- All form elements properly labeled
- Focus management between steps

**ARIA:**
- `role="progressbar"` with `aria-valuenow`
- `role="tabpanel"` for step content
- `aria-live="polite"` for step transitions

---

## Analytics

**Events:**
1. "onboarding_started"
2. "onboarding_step_viewed" (step_number)
3. "onboarding_step_completed" (step_number, time_spent)
4. "onboarding_skipped" (at_step)
5. "onboarding_resumed"
6. "onboarding_completed"
7. "onboarding_video_watched" (percentage)

**Key Metric:** Completion rate (target: >70%)

---

## Technical Notes

**API Endpoints:**

`POST /api/onboarding/save-progress`
```json
{
  "step": 2,
  "data": { "quiz_responses": {...} }
}
```

`POST /api/onboarding/complete`
```json
{
  "readiness_score": 75,
  "lead_de_cadrage": {...}
}
```

**Local Storage:**
- Save progress locally as backup
- Sync with server every 30 seconds

**Performance:**
- Lazy load video (don't block page load)
- Preload next step content

---

## Design System References

**Components:** Wizard, Progress Bar, Form Inputs, Sliders, Checkboxes
**Colors:** Primary `#2D65F8`, Success `#10B981`
**Typography:** H1 36px, Body 14px
**Spacing:** Step padding 40px, button gaps 16px

---

*Version: 1.0 | Updated: 2025-11-11 | Status: Ready for Development*
