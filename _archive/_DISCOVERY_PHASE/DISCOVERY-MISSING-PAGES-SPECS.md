# Discovery Phase - Missing Pages Specifications

## Current Status
✅ **Built:** Discovery Hub, Readiness Quiz (15 questions)
❌ **Missing:** Lead de Cadrage, Results Page, Learning Path, Consultation Booking

---

## 1. Lead de Cadrage (Acquisition Criteria Builder)

### Purpose
Capture user's ideal business criteria to enable deal matching.

### Page Layout
```
Header: "Define Your Ideal Acquisition"
Subtitle: "Tell us what you're looking for"
Progress: 7 sections with visual stepper
```

### Form Sections

**Section 1: Industry & Business Type**
- Industry checkboxes (multiple select)
  - Healthcare
  - Technology
  - Professional Services
  - Manufacturing
  - Retail
  - Food & Hospitality
  - Construction
  - Other (text input)
- Business model preference (radio)
  - B2B
  - B2C
  - Both
  - No preference

**Section 2: Geographic Preferences**
- Primary regions (checkboxes)
  - Paris Region
  - Lyon Region
  - Marseille Region
  - Other major cities
  - Rural areas
  - Anywhere in France
- Willing to relocate? (Yes/No toggle)
- Maximum distance from current location (slider: 0-500km)

**Section 3: Financial Criteria**
- Purchase price range
  - Min: €[input]
  - Max: €[input]
  - Preset buttons: <500K, 500K-1M, 1-3M, 3-5M, 5M+
- Annual revenue preference
  - Min: €[input]
  - Max: €[input]
- EBITDA margin minimum (slider: 0-50%)
- Cash available for down payment: €[input]

**Section 4: Business Size**
- Number of employees
  - Min: [input]
  - Max: [input]
  - Preset: 1-5, 5-20, 20-50, 50+
- Years in operation minimum (slider: 0-50 years)
- Customer base size preference (optional)

**Section 5: Deal Structure**
- Transaction type (checkboxes)
  - Full acquisition
  - Majority stake
  - Partnership
  - Management buyout
- Seller staying? (radio)
  - Must stay 6+ months
  - Prefer some transition
  - Prefer clean exit
  - No preference
- Financing (checkboxes)
  - SBA loan eligible
  - Seller financing available
  - All cash
  - Open to any

**Section 6: Business Characteristics**
- Growth preference (radio)
  - High growth (20%+)
  - Steady growth (5-20%)
  - Stable/mature
  - Turnaround opportunity
- Technology level (radio)
  - Tech-enabled
  - Traditional with digital potential
  - Traditional
  - No preference
- Recurring revenue importance (slider: Not important to Critical)

**Section 7: Timeline & Urgency**
- When to acquire? (radio)
  - Next 3 months
  - 3-6 months
  - 6-12 months
  - 12+ months
- Current status (radio)
  - Actively searching
  - Preparing to search
  - Still exploring
- Deal alerts (toggle on/off)
  - Email frequency: Instant/Daily/Weekly

### UI Components Needed
- Multi-step form with section navigation
- Progress indicator
- Field validation (required fields marked)
- Save draft functionality
- Preview summary before submit
- Edit mode for returning users

### Data Output
- JSON object with all criteria
- Feeds into matching algorithm
- Creates user's "acquisition profile"

---

## 2. Readiness Results Page

### Purpose
Show quiz results with actionable insights and next steps.

### Page Layout
```
Header: "Your Readiness Assessment Results"
Overall Score: [Visual score display]
Three category breakdowns
Recommended actions
Next steps CTA
```

### Score Display
**Overall Readiness Score**
- Large circular progress chart (0-100)
- Color coding: Red (0-40), Yellow (41-70), Green (71-100)
- Label: "Not Ready" / "Getting Ready" / "Ready to Acquire"

### Category Breakdowns

**Financial Readiness: [Score]/100**
- Visual bar chart
- Strengths:
  - ✓ Sufficient capital available
  - ✓ Understanding of financing options
- Gaps:
  - ✗ Need financial cushion
  - ✗ Risk tolerance concerns
- Recommended actions:
  - Build 12-month emergency fund
  - Meet with SBA lender
  - Review financial planning course

**Experience & Skills: [Score]/100**
- Visual bar chart
- Strengths:
  - ✓ Management experience
  - ✓ Industry knowledge
- Gaps:
  - ✗ Limited P&L experience
  - ✗ Financial modeling skills
- Recommended actions:
  - Take financial analysis course
  - Shadow a business owner
  - Join peer advisory group

**Personal Readiness: [Score]/100**
- Visual bar chart
- Strengths:
  - ✓ Family support
  - ✓ Clear motivation
- Gaps:
  - ✗ Timeline too aggressive
  - ✗ Geographic limitations
- Recommended actions:
  - Extend timeline to 12 months
  - Consider wider geographic area
  - Attend acquisition workshop

### Comparison Section
"How you compare to successful acquirers"
- Your score vs. Average first-time buyer
- Your score vs. Successful acquirer benchmark
- Time to readiness estimate: "Most users like you are ready in 3-6 months"

### Action Plan
**Priority Actions** (numbered list)
1. Complete Lead de Cadrage to define criteria
2. Address top 3 gaps from assessment
3. Start learning path (personalized based on gaps)
4. Connect with advisor (if premium)

### CTAs
- Primary: "Define Your Criteria" → Lead de Cadrage
- Secondary: "Start Learning Path" → Learning modules
- Tertiary: "Retake Assessment" (in 3 months)

### UI Components
- Score visualization charts
- Expandable sections for details
- Progress bars for each category
- Action checklist
- Share results option (PDF download)

---

## 3. Learning Path Page

### Purpose
Personalized education based on readiness gaps.

### Page Layout
```
Header: "Your Personalized Learning Path"
Subtitle: "Build skills for successful acquisition"
Progress: X of Y modules completed
Three learning tracks based on gaps
```

### Learning Modules Structure

**Track 1: Financial Mastery**
Required if financial score < 70

Modules:
1. **Understanding Business Financials**
   - Reading P&L statements
   - Balance sheet basics
   - Cash flow analysis
   - Time: 2 hours
   - Format: Video + Quiz

2. **Valuation Fundamentals**
   - Valuation methods
   - Multiple analysis
   - DCF basics
   - Time: 3 hours
   - Format: Video + Exercises

3. **Financing Your Acquisition**
   - SBA loans explained
   - Seller financing
   - Equity structures
   - Time: 2 hours
   - Format: Video + Calculator

**Track 2: Operational Excellence**
Required if experience score < 70

Modules:
1. **Due Diligence Essentials**
   - What to examine
   - Red flags checklist
   - Question templates
   - Time: 3 hours
   - Format: Guide + Checklist

2. **Transition Planning**
   - First 100 days
   - Employee communication
   - Customer retention
   - Time: 2 hours
   - Format: Video + Templates

3. **Growth Strategies**
   - Digital transformation
   - Market expansion
   - Operational improvement
   - Time: 2 hours
   - Format: Case studies

**Track 3: Personal Preparation**
Required if personal score < 70

Modules:
1. **Entrepreneur Mindset**
   - From employee to owner
   - Risk management
   - Decision making
   - Time: 1 hour
   - Format: Video + Assessment

2. **Work-Life Integration**
   - Family preparation
   - Time management
   - Stress management
   - Time: 1 hour
   - Format: Guide + Worksheet

3. **Building Your Team**
   - Advisor selection
   - Key hires
   - Board/mentors
   - Time: 1.5 hours
   - Format: Video + Templates

### Module Card Design
- Module title
- Time to complete
- Format badge (Video/Guide/Exercise)
- Progress indicator
- "Start" / "Continue" / "Completed" button
- Completion certificate icon when done

### Gamification Elements
- Progress bar for each track
- Badges for completion
- Overall completion percentage
- Estimated time to complete all: X hours
- "Learning streak" counter

### UI Components
- Module cards in grid layout
- Track progress bars
- Filter by format/time/topic
- Search modules
- Bookmark for later
- Note-taking interface

---

## 4. Consultation Booking Page

### Purpose
Schedule 1-on-1 advisor session (premium feature).

### Page Layout
```
Header: "Book Your Readiness Consultation"
Subtitle: "Get personalized guidance from an acquisition expert"
Two columns: Calendar + Booking form
```

### Advisor Selection
**Choose Your Advisor** (cards)
- Advisor photo
- Name and credentials
- Specializations (industries/deal sizes)
- Experience: X years, Y deals
- Languages spoken
- Next availability
- "Select" button

### Calendar Interface
- Month view with available dates
- Available dates in blue
- Unavailable in gray
- Selected date highlighted
- Time slots shown when date selected:
  - Morning: 9:00, 10:00, 11:00
  - Afternoon: 14:00, 15:00, 16:00, 17:00
- Duration: 45 minutes

### Booking Form
**Your Information**
- Name (pre-filled)
- Email (pre-filled)
- Phone number
- Company (if applicable)

**Consultation Focus** (checkboxes)
- Review readiness results
- Discuss acquisition criteria
- Financing options
- Industry specific questions
- Deal evaluation
- Other (text field)

**Preparation Questions**
1. What's your biggest concern about acquiring? (text)
2. Have you identified any businesses? (Yes/No)
3. What do you hope to achieve in this session? (text)

**Share Documents** (optional)
- Upload readiness results (auto-attached)
- Upload financial summary
- Upload target business info
- Drag & drop zone

### Confirmation Details
**Your Consultation**
- Date: [Selected date]
- Time: [Selected time]
- Duration: 45 minutes
- Format: Video call (Zoom link sent)
- Advisor: [Name]
- Price: Included in Premium / €149 one-time

### Post-Booking
**Confirmation Page**
- Calendar invite sent
- Email confirmation sent
- Preparation checklist:
  - ✓ Review your readiness results
  - ✓ Prepare questions
  - ✓ Have financials ready
  - ✓ Test video connection
- "Add to Calendar" button
- "Reschedule" link
- "Cancel" link (24hr notice)

### UI Components
- Calendar widget
- Time slot selector
- File upload zone
- Form validation
- Loading states
- Success confirmation
- Email templates

---

## Information Architecture Update

### Discovery Section Structure
```
/discovery
  /discovery/quiz          → Readiness Assessment (15 questions)
  /discovery/results       → Results & recommendations
  /discovery/criteria      → Lead de Cadrage form
  /discovery/learning      → Personalized learning path
  /discovery/consultation  → Book advisor session
```

### Navigation Flow
1. Discovery Hub → Quiz
2. Quiz → Results
3. Results → Criteria OR Learning
4. Criteria → Deal Browse (when ready)
5. Learning → Track progress → Consultation
6. Consultation → Booked → Follow-up

### Data Requirements
- User profile to store:
  - Quiz answers
  - Quiz scores
  - Criteria selections
  - Learning progress
  - Consultation bookings
- Matching algorithm inputs:
  - All criteria from Lead de Cadrage
  - Readiness score as qualifier

### Component Reuse
Use existing components from prototype:
- PageLayout
- PageHeader
- Card
- Button
- Badge
- Input
- Progress bars
- Form elements from UI library

### Responsive Design
- Mobile: Single column, stacked sections
- Tablet: Two columns where applicable
- Desktop: Full layouts as specified
- Breakpoints: 640px, 768px, 1024px

---

## Next Implementation Steps
1. Build Lead de Cadrage form with all 7 sections
2. Create Results page with score calculations
3. Design Learning Path with module cards
4. Add Consultation booking with calendar
5. Connect all pages with navigation
6. Add data persistence layer
7. Implement matching algorithm inputs