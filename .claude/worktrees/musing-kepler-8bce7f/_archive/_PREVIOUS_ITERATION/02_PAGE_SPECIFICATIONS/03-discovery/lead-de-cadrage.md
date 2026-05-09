# Page Specification: Lead de Cadrage (Acquisition Criteria Builder)

**Route:** `/discovery/lead-de-cadrage`
**Section:** Discovery
**Authentication Required:** Yes

---

## Purpose

Structured tool for users to define their ideal acquisition criteria ("Lead de Cadrage" = acquisition framework). This is **mandatory before deal flow access** and serves as the matching profile for deal recommendations.

---

## Layout Structure

Multi-step form with sidebar navigation and progress tracking

```
┌─────────────────────────────────────┐
│  ┌────────┐  Build Your             │
│  │Section │  Acquisition Criteria   │
│  │Nav     │                          │
│  │        │  ┌────────────────────┐ │
│  │1.Geo ✓ │  │ Geography          │ │
│  │2.Ind ✓ │  │                    │ │
│  │3.Size  │  │ Where are you      │ │
│  │4.Model │  │ willing to search? │ │
│  │5.Fin   │  │                    │ │
│  │6.Role  │  │ [France] [Italy]   │ │
│  │7.Deal  │  │ [Belgium] [Spain]  │ │
│  │        │  │                    │ │
│  │[4/7]   │  │ ☐ Willing to       │ │
│  └────────┘  │   relocate          │ │
│              │                    │ │
│              │ [Back] [Next →]    │ │
│              └────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Key Components

### Sidebar Navigation
- **Section List:** 7 sections with icons
  1. Geography (🗺️)
  2. Industry (🏭)
  3. Size (📏)
  4. Business Model (🔄)
  5. Financial Profile (💰)
  6. Your Role (👤)
  7. Deal Structure (🤝)
- **Progress Indicator:** "4/7 sections complete"
- **Save & Exit:** Button to save progress and return later
- **Completion Status:** Checkmarks on completed sections

### Form Sections (7 Total)

**Section 1: Geography**
- **Question:** "Where are you willing to search for businesses?"
- **Primary Country:** Single select (France, Italy, Belgium, Spain, Germany, Other)
- **Secondary Countries:** Multi-select (expand search)
- **Relocation Willingness:** Checkbox: "I'm willing to relocate"
- **Preferred Regions:** (If France selected) → Checkboxes: Île-de-France, Auvergne-Rhône-Alpes, etc.
- **Urban vs. Rural:** Radio: "Urban centers" / "Rural/suburban" / "No preference"

**Section 2: Industry**
- **Question:** "Which industries interest you most?"
- **Preferred Industries:** Multi-select (up to 5):
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
- **Must-Avoid Industries:** Multi-select:
  - Same list as above
  - Reason: "I lack expertise" / "Ethical concerns" / "High risk" / "Other"
- **Industry Expertise:** Dropdown: "None" / "Some knowledge" / "Expert"

**Section 3: Size**
- **Revenue Range:** Dual slider (€500K - €10M)
  - Default: €1M - €5M
- **Employee Count:** Dual slider (5 - 100 employees)
  - Default: 10 - 50
- **EBITDA:** Dual slider (€100K - €2M)
  - Default: €200K - €800K
- **Age of Business:** Dropdown: "5+ years" / "10+ years" / "20+ years" / "No preference"
- **Growth Stage:** Radio: "Stable/mature" / "Growing" / "Declining (turnaround)" / "No preference"

**Section 4: Business Model**
- **B2B vs. B2C:** Radio: "B2B only" / "B2C only" / "Either"
- **Revenue Type:** Checkboxes:
  - Recurring (subscriptions, contracts)
  - Project-based
  - Transactional (one-time sales)
  - Mixed
- **Customer Concentration:** Dropdown: "No single customer >20%" / "Willing to accept concentration" / "No preference"
- **Digital vs. Physical:** Radio: "Primarily digital" / "Primarily physical" / "Hybrid" / "No preference"
- **Seasonality:** Radio: "Year-round revenue" / "Willing to accept seasonality" / "No preference"

**Section 5: Financial Profile**
- **EBITDA Margin:** Slider (5% - 40%)
  - Default: 15% minimum
- **Revenue Growth:** Dropdown: "Stable (0-5% YoY)" / "Moderate (5-15%)" / "High (15%+)" / "No preference"
- **Debt Tolerance:** Radio: "Prefer no debt" / "Some debt acceptable" / "Willing to take on debt"
- **Cash Flow:** Radio: "Positive cash flow required" / "Break-even acceptable" / "Willing to invest for turnaround"
- **Historical Performance:** Radio: "3+ years profitability" / "1+ year profitability" / "Can be break-even"

**Section 6: Your Role**
- **Involvement Level:** Radio:
  - "Hands-on operator (day-to-day management)"
  - "Strategic owner (weekly oversight)"
  - "Passive investor (quarterly check-ins)"
- **Management Team:** Radio:
  - "Prefer existing team in place"
  - "Willing to build/replace team"
  - "No preference"
- **Skills You Bring:** Checkboxes:
  - Sales & Marketing
  - Operations & Process
  - Finance & Strategy
  - Technology & Innovation
  - People & Culture
  - Product Development
- **Work Style:** Radio: "Solo leadership" / "Co-owner partnership" / "Family business succession"

**Section 7: Deal Structure**
- **Purchase Price Range:** Dual slider (€500K - €10M)
  - Based on earlier revenue/EBITDA inputs (auto-suggested)
- **Equity Ownership:** Slider (51% - 100%)
  - Default: 100% (full ownership)
- **Financing Structure:** Checkboxes:
  - Bank loan / SBA equivalent
  - Seller financing
  - Investor equity
  - Personal capital
  - Hybrid (multiple sources)
- **Timeline:** Dropdown: "6 months" / "12 months" / "18 months" / "No rush"
- **Earnout Willingness:** Radio: "Prefer no earnout" / "Open to earnout" / "No preference"

### Navigation Controls
- **Back Button:** Return to previous section
- **Next Button:** Proceed to next section (validate current section first)
- **Save & Exit:** Save progress, return to Discovery Hub
- **Progress Auto-Save:** Every field change saved immediately

### Summary & Confirmation
**Final Review Screen (After Section 7):**
- **Headline:** "Review Your Acquisition Criteria"
- **Summary Cards:** All 7 sections displayed in read-only format
- **Edit Buttons:** Click to return to any section for changes
- **Confirmation Message:** "This criteria will be used to match you with relevant deal opportunities."
- **CTAs:**
  - "Confirm & Save" → Mark criteria as complete
  - "Edit" → Return to specific section

---

## Interactive Elements

1. **Section Navigation:**
   - Click sidebar item → navigate to that section
   - Completed sections show checkmark
   - Current section highlighted

2. **Field Validation:**
   - Required fields highlighted if empty when clicking "Next"
   - Inline validation for number ranges (min/max)
   - Sliders show current values dynamically

3. **Smart Defaults:**
   - If readiness assessment completed, pre-fill based on answers
   - Example: If user said €150-300K capital → suggest €500K-3M price range

4. **Tooltips:**
   - Hover over field labels → explanation
   - Example: "EBITDA" → "Earnings Before Interest, Taxes, Depreciation, and Amortization"

5. **Conditional Logic:**
   - If "Willing to relocate" unchecked → show only local opportunities
   - If "B2B only" selected → hide B2C-specific questions

6. **Progress Saving:**
   - Auto-save every field change
   - "Saved ✓" indicator appears briefly
   - Can resume later from sidebar

---

## Navigation

### FROM
- Discovery Hub (`/discovery`) - "Build Criteria" button
- Readiness Results (`/discovery/results`) - "Build Criteria" recommendation
- Dashboard (`/dashboard`) - If criteria incomplete, reminder widget
- Deal Flow Browse (`/deal-flow/browse`) - "Edit Criteria" link (if Professional tier)

### TO
- Discovery Hub (`/discovery`) - "Save & Exit" or after confirmation
- Learning Path (`/discovery/learning-path`) - "Next: Learning Path" CTA after confirmation
- Deal Flow Browse (`/deal-flow/browse`) - If Professional/Enterprise tier, "View Matching Deals" CTA

---

## Content

**Page Introduction:**
- **Headline:** "Build Your Acquisition Criteria"
- **Subheadline:** "Define your ideal business to help us match you with the right opportunities."
- **Why This Matters:** "Your criteria guides our deal matching and personalizes your experience."
- **Estimated Time:** "10-15 minutes to complete"

**Section-Specific Guidance:**
- Geography: "Consider where you want to live and manage the business."
- Industry: "Focus on industries where you have expertise or strong interest."
- Size: "Balance ambition with affordability and manageability."
- Business Model: "Think about the type of business that fits your skills and lifestyle."
- Financial Profile: "Be realistic about financial requirements and risk tolerance."
- Your Role: "Honest self-assessment of involvement level prevents future regrets."
- Deal Structure: "Understanding financing options helps refine your search."

**Completion Message:**
- **Headline:** "Criteria Saved!"
- **Message:** "Your acquisition criteria is complete. We'll use this to match you with relevant opportunities."
- **Next Steps:**
  - "View Learning Path" (personalized courses)
  - "Book Consultation" (discuss criteria with advisor)
  - "Explore Deal Flow" (Professional tier only)

---

## States

### 1. Initial Load (New User)
- Show introduction screen
- "Start Building" CTA
- Empty form fields (smart defaults if readiness assessment completed)

### 2. In Progress
- Current section displayed
- Sidebar shows progress (X/7 complete)
- Back/Next navigation enabled
- Auto-save indicator

### 3. Section Validation Error
- Highlight required fields in red
- Error message: "Please complete required fields before continuing."
- Disable "Next" until valid

### 4. Section Complete
- Checkmark appears in sidebar
- Move to next section automatically (or click "Next")

### 5. All Sections Complete
- Show final review screen
- Summary of all criteria
- "Confirm & Save" CTA

### 6. Criteria Confirmed
- Success message: "Criteria Saved! ✓"
- Celebration animation (brief)
- Next steps displayed

### 7. Edit Mode (After Confirmation)
- User can return and edit any section
- Changes saved immediately
- No need to re-confirm (already marked complete)

### 8. Save & Exit
- Progress saved to backend
- Return to Discovery Hub
- "Continue Building Criteria" button shows progress

---

## Edge Cases

### Incomplete Criteria (Accessing Deal Flow)
- If user tries to access `/deal-flow` without completing criteria
- Block access with modal: "Complete your acquisition criteria first to view deals."
- CTA: "Build Criteria Now"

### Conflicting Criteria
- Example: High EBITDA requirement + low revenue range = unrealistic
- Show warning: "Your criteria may be too narrow. Consider adjusting."
- Suggest: Broaden ranges or accept lower margins

### No Matches Found
- After confirmation, show message: "No current deals match your exact criteria."
- Suggest: "Broaden your search or get notified when matches arrive."
- CTA: "Adjust Criteria" / "Set Deal Alerts"

### Criteria Too Broad
- Example: All industries, all geographies, all sizes = not focused
- Show tip: "Consider narrowing your criteria for better matches."
- No blocking (user can proceed)

### Readiness Integration
- If readiness score < 50, show banner:
- "Your readiness assessment suggests building knowledge first. Consider this criteria a working draft."

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through all fields
  - Arrow keys for radio buttons
  - Space to toggle checkboxes
  - Enter to submit section

- **Screen Reader:**
  - Announce section changes
  - Announce progress updates
  - Label all form inputs
  - Describe slider values on change

- **Color Contrast:** 4.5:1 minimum

- **ARIA:**
  - `role="form"` on each section
  - `aria-required="true"` on required fields
  - `aria-invalid="true"` on validation errors
  - `aria-label` on sliders with current values
  - `aria-live="polite"` for auto-save notifications

---

## Analytics

**Events:**
1. "criteria_builder_started"
2. "criteria_section_completed" (section_name)
3. "criteria_field_changed" (field_id, value)
4. "criteria_saved_exit" (sections_completed)
5. "criteria_confirmed"
6. "criteria_edited" (section_name)

**Metrics to Track:**
- Completion rate (% finishing all 7 sections)
- Time to complete (average)
- Drop-off sections (where users abandon)
- Field value distributions (most common criteria)
- Correlation: criteria specificity vs. deal matches

---

## Technical Notes

**API Endpoint:** `POST /api/discovery/lead-de-cadrage/save`

**Payload (Per Section):**
```json
{
  "userId": "string",
  "section": "geography",
  "data": {
    "primaryCountry": "France",
    "secondaryCountries": ["Italy", "Belgium"],
    "willingToRelocate": true,
    "preferredRegions": ["Île-de-France", "Auvergne-Rhône-Alpes"],
    "urbanRural": "no_preference"
  }
}
```

**Response (200):**
```json
{
  "saved": true,
  "sectionsCompleted": 4,
  "totalSections": 7,
  "criteriaComplete": false
}
```

**Get Criteria State:** `GET /api/discovery/lead-de-cadrage/state`

**Response (200):**
```json
{
  "complete": false,
  "sectionsCompleted": 4,
  "sections": {
    "geography": {...},
    "industry": {...},
    "size": {...},
    "businessModel": null,
    "financialProfile": null,
    "role": null,
    "dealStructure": null
  }
}
```

**Confirm Criteria:** `POST /api/discovery/lead-de-cadrage/confirm`

**Matching Algorithm:**
- Criteria stored as user profile
- Deal flow filtered/ranked by match percentage
- Mandatory fields: geography, industry, size, price range
- Nice-to-have fields: business model, role, deal structure

---

## Design System References

**Components:** Form Input, Radio, Checkbox, Slider, Dropdown, Button, Card, Sidebar, Progress Bar
**Colors:** Primary `#2D65F8`, Success `#10B981`, Error `#EF4444`
**Typography:** H2 24px Bold (section titles), Body 16px Regular (labels), Caption 14px (help text)
**Spacing:** Section padding 32px, field gaps 16px, sidebar width 240px

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
