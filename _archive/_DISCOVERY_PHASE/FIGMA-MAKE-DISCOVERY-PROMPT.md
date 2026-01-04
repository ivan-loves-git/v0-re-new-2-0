# Figma Make Prompt - Complete Discovery Phase

## Functionality Update

```
Build this following engineering best practices:
- Write all code to WCAG AA accessibility standards
- Create and use reusable components throughout
- Use semantic HTML and proper component architecture
- Avoid absolute positioning; use flexbox/grid layouts
- Build actual code components, not image SVGs
- Keep code clean, maintainable, and well-structured

Add 4 new pages to the Discovery section with these specifications:

## 1. LEAD DE CADRAGE PAGE (/discovery/criteria)

Create a 7-step form to capture acquisition criteria:

Step 1 - Industry & Business Type:
- Multi-select checkboxes: Healthcare, Technology, Professional Services, Manufacturing, Retail, Food & Hospitality, Construction, Other
- Radio buttons for business model: B2B, B2C, Both, No preference

Step 2 - Geographic Preferences:
- Checkboxes for regions: Paris, Lyon, Marseille, Other cities, Rural, Anywhere in France
- Yes/No toggle: "Willing to relocate?"
- Range slider: "Maximum distance from current location" (0-500km)

Step 3 - Financial Criteria:
- Two number inputs: "Purchase price Min/Max" with preset buttons (<500K, 500K-1M, 1-3M, 3-5M, 5M+)
- Two number inputs: "Annual revenue Min/Max"
- Slider: "Minimum EBITDA margin" (0-50%)
- Number input: "Cash available for down payment"

Step 4 - Business Size:
- Two number inputs: "Number of employees Min/Max" with presets (1-5, 5-20, 20-50, 50+)
- Slider: "Minimum years in operation" (0-50)
- Optional input: "Customer base size preference"

Step 5 - Deal Structure:
- Checkboxes: Full acquisition, Majority stake, Partnership, Management buyout
- Radio: Seller transition preference (Must stay 6+ months, Some transition, Clean exit, No preference)
- Checkboxes: SBA eligible, Seller financing, All cash, Open to any

Step 6 - Business Characteristics:
- Radio: Growth preference (High 20%+, Steady 5-20%, Stable/mature, Turnaround)
- Radio: Technology level (Tech-enabled, Traditional with potential, Traditional, No preference)
- Slider: "Recurring revenue importance" (Not important to Critical)

Step 7 - Timeline & Urgency:
- Radio: When to acquire (Next 3 months, 3-6, 6-12, 12+ months)
- Radio: Current status (Actively searching, Preparing, Still exploring)
- Toggle: Enable deal alerts with dropdown (Instant/Daily/Weekly)

Form features:
- Progress bar showing 7 steps
- Save draft functionality
- Validation on required fields
- Previous/Next navigation
- Summary review before submission

## 2. READINESS RESULTS PAGE (/discovery/results)

Display quiz results with three sections:

Overall Score Section:
- Large circular progress chart (0-100) with color gradient (red 0-40, yellow 41-70, green 71-100)
- Label: "Not Ready" / "Getting Ready" / "Ready to Acquire"

Three Category Cards (side by side on desktop, stacked mobile):

Financial Readiness Card:
- Score bar with percentage
- Strengths list with green checkmarks
- Gaps list with red X marks
- 3 recommended actions

Experience & Skills Card:
- Score bar with percentage
- Strengths list with green checkmarks
- Gaps list with red X marks
- 3 recommended actions

Personal Readiness Card:
- Score bar with percentage
- Strengths list with green checkmarks
- Gaps list with red X marks
- 3 recommended actions

Comparison Section:
- Bar chart: "Your score vs. Average first-time buyer vs. Successful acquirer"
- Text: "Most users like you are ready in X months"

Action Plan Section:
- Blue background box with numbered priority list
- Primary CTA: "Define Your Criteria" → /discovery/criteria
- Secondary CTA: "Start Learning Path" → /discovery/learning
- Link: "Retake in 3 months"

## 3. LEARNING PATH PAGE (/discovery/learning)

Create module-based learning interface:

Header Section:
- Title: "Your Personalized Learning Path"
- Overall progress bar: "X of Y modules completed"
- Percentage badge

Three Learning Tracks:

Track 1 - Financial Mastery:
- Show if financial score < 70
- 3 module cards:
  1. Understanding Business Financials (2 hours, Video + Quiz)
  2. Valuation Fundamentals (3 hours, Video + Exercises)
  3. Financing Your Acquisition (2 hours, Video + Calculator)

Track 2 - Operational Excellence:
- Show if experience score < 70
- 3 module cards:
  1. Due Diligence Essentials (3 hours, Guide + Checklist)
  2. Transition Planning (2 hours, Video + Templates)
  3. Growth Strategies (2 hours, Case studies)

Track 3 - Personal Preparation:
- Show if personal score < 70
- 3 module cards:
  1. Entrepreneur Mindset (1 hour, Video + Assessment)
  2. Work-Life Integration (1 hour, Guide + Worksheet)
  3. Building Your Team (1.5 hours, Video + Templates)

Each Module Card contains:
- Module number in circle
- Title
- Time to complete with clock icon
- Format badge (Video/Guide/Exercise)
- Progress bar at bottom
- Button: "Start" (gray) / "Continue" (blue) / "Completed" (green check)

Features:
- Filter by format/time/topic
- Search modules
- Bookmark functionality
- Completion certificates

## 4. CONSULTATION BOOKING PAGE (/discovery/consultation)

Two-column layout (stack on mobile):

Left Column - Advisor Selection:
- 3 advisor cards with:
  - 60px circular photo
  - Name and credentials
  - Specialty tags
  - "Next available: date"
  - Select button

Calendar Widget below:
- Month view with clickable dates
- Available dates in blue
- Selected date highlighted
- Time slots appear when date selected (9:00-17:00)

Right Column - Booking Form:
- Pre-filled: Name, Email
- Required: Phone number
- Checkboxes: Consultation focus topics
- 3 text areas for preparation questions
- File upload zone for documents

Confirmation Modal:
- Green success checkmark
- Booking details summary
- "Add to Calendar" button
- "Download confirmation" link

DESIGN TOKENS TO USE:
- Primary: #2D65F8
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444
- Text: #1F2937
- Muted: #6B7280
- Border: #E5E7EB
- Background: #F9FAFB
- Font: Inter
- Border radius: 8px (buttons), 12px (cards)
- Spacing: 8px grid system

RESPONSIVE BREAKPOINTS:
- Mobile: < 640px (single column)
- Tablet: 640-1024px (2 columns where noted)
- Desktop: > 1024px (full layouts)

REUSE THESE EXISTING COMPONENTS:
- PageLayout wrapper
- PageHeader with breadcrumbs
- Card component
- Button (primary/secondary/ghost variants)
- Badge component
- Form inputs from UI library
- Progress bars

NAVIGATION FLOW:
Discovery Hub → Quiz → Results → Criteria → Deal Browse (when ready)
Results can also go to → Learning Path → Consultation

Add proper loading states, error handling, form validation, and success confirmations throughout.
```