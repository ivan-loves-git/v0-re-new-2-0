# Page Specification: Consultation Booking

**Route:** `/discovery/consultation`
**Section:** Discovery (cross-journey feature)
**Authentication Required:** Yes

---

## Purpose

Allow users to book 1-on-1 advisory sessions with Renew team advisors for personalized guidance throughout their acquisition journey (Discovery, Acquisition, Post-Acquisition phases).

---

## Layout Structure

Two-column layout: consultation types (left) + booking calendar (right)

```
┌─────────────────────────────────────┐
│  [← Back to Discovery]              │
│  ─────────────────────────────────  │
│                                     │
│  Book a Consultation                │
│                                     │
│  ┌──────────┬──────────────────┐   │
│  │ Types    │  Calendar         │   │
│  │          │                   │   │
│  │○ Discov. │  Nov 2025         │   │
│  │● Deal    │  S M T W T F S    │   │
│  │○ Post-Ac │  1 2 3 4 5 6 7    │   │
│  │          │  8 [9] ...        │   │
│  │          │                   │   │
│  │Duration  │  Available Times  │   │
│  │● 30 min  │  ○ 9:00 AM        │   │
│  │○ 60 min  │  ● 10:00 AM       │   │
│  │          │  ○ 2:00 PM        │   │
│  │          │                   │   │
│  │Advisor   │  [Confirm →]      │   │
│  │[Auto]▾   │                   │   │
│  └──────────┴──────────────────┘   │
└─────────────────────────────────────┘
```

---

## Key Components

### Consultation Type Selection (Left Panel)
**Three Consultation Types:**

1. **Discovery Consultation (30 or 60 min)**
   - Icon: 🔍
   - Description: "Assess readiness, refine criteria, discuss preparation strategy"
   - Best For: Explorers (Early Stage)
   - Included: 1/month in Starter tier, 3/month in Professional+
   - Topics covered:
     - Readiness assessment review
     - Acquisition criteria refinement
     - Gap closure planning
     - Timeline and next steps

2. **Deal Review Consultation (30 or 60 min)**
   - Icon: 📊
   - Description: "Review specific deals, discuss valuation, due diligence guidance"
   - Best For: Active Searchers (Mid Stage)
   - Included: 3/month in Professional, 5/month in Enterprise
   - Topics covered:
     - Deal evaluation and fit
     - Valuation analysis
     - Due diligence priorities
     - Negotiation strategy
     - Financing options

3. **Post-Acquisition Consultation (30 or 60 min)**
   - Icon: 🚀
   - Description: "Strategic guidance for first-time owners (transition, operations, growth)"
   - Best For: First-Time Owners (Post-Acquisition)
   - Included: 5/month in Enterprise, unlimited in Operating Partner program
   - Topics covered:
     - Transition challenges
     - Team and customer management
     - Operational improvements
     - Growth strategy
     - Problem-solving

**Selection:**
- Radio buttons to select type
- Selected type highlights (blue border)
- Duration options appear after type selection (30 min / 60 min radio)

### Duration Selection
- Radio: **30 minutes** (standard)
- Radio: **60 minutes** (deep dive)
- Note: Duration affects advisor availability (60 min slots less common)

### Advisor Selection (Optional)
- Dropdown: **"Auto-assign best match"** (default)
- Option to select specific advisor:
  - Advisor name
  - Photo, specialty, brief bio
  - Availability indicator (green dot = available this week)
- Tooltip: "We'll match you with an advisor who specializes in your consultation type."

### Calendar View (Right Panel)
**Month Calendar:**
- Current month displayed (e.g., "November 2025")
- Previous/Next month navigation arrows
- Days grid (Sunday → Saturday)
- Available days: Default style
- Selected day: Blue highlight
- Unavailable days: Grayed out
- Today: Blue outline

**Date Selection:**
- Click any available day → show time slots

### Time Slot Selection
**Available Times List:**
- After selecting date, show available time slots
- Times displayed in user's timezone (auto-detected or user setting)
- Each slot: Radio button + time (e.g., "○ 10:00 AM")
- Select time → "Confirm" button enabled

### Booking Details Form (After Time Selection)
**User Information:**
- Name (pre-filled from profile)
- Email (pre-filled)
- Phone (optional, for reminders)

**Consultation Details:**
- **Topic/Question:** Text area (required)
  - Placeholder: "What would you like to discuss? (e.g., 'Review my acquisition criteria' or 'Discuss deal at 123 Main St')"
  - Max 500 characters
- **Upload Document (optional):** File upload button
  - Accepted: PDF, DOCX, XLSX (financials, CIM, etc.)
  - Max 10MB
  - Use case: "Share deal financials or documents for review"

**Meeting Preferences:**
- Video call (default): Zoom / Google Meet (auto-selected)
- Phone call: User provides number

### Confirmation Screen
**After Booking:**
- **Success Message:** "Consultation Booked! ✓"
- **Booking Summary:**
  - Type: Discovery Consultation
  - Date: November 9, 2025
  - Time: 10:00 AM - 10:30 AM (CET)
  - Advisor: [Auto-assigned] or [Specific Name]
  - Meeting Link: [Zoom URL]
- **Actions:**
  - "Add to Calendar" (download .ics file)
  - "View All Consultations" (history)
  - "Book Another" (return to booking flow)
- **Email Confirmation:** "Check your email for details and meeting link."

---

## Interactive Elements

1. **Type Selection:**
   - Click consultation type → highlight and show duration options
   - Description expands to show topics covered

2. **Calendar Navigation:**
   - Click arrows → move to previous/next month
   - Click date → show available time slots
   - Unavailable dates (grayed) → tooltip: "No availability on this date"

3. **Time Slot Selection:**
   - Click time slot → highlight in blue
   - "Confirm" button becomes enabled

4. **Advisor Selection:**
   - Dropdown opens advisor list with photos and bios
   - Hover over advisor → show full bio and specialty
   - Select → calendar updates with advisor-specific availability

5. **Form Validation:**
   - Required field: "Topic/Question"
   - If empty on submit → highlight in red, error message
   - Submit button disabled until valid

6. **Document Upload:**
   - Click "Upload" → file picker dialog
   - Show file name after upload: "financials.pdf ✓"
   - Remove button (X) to delete uploaded file

7. **Timezone Detection:**
   - Auto-detect user timezone
   - Display timezone in time slots: "10:00 AM (CET)"
   - Link to change timezone: "Change timezone"

---

## Navigation

### FROM
- Discovery Hub (`/discovery`) - "Book Consultation" button
- Readiness Results (`/discovery/results`) - "Book Consultation" recommendation
- Dashboard (`/dashboard`) - "Book Consultation" widget
- Deal Detail Page (`/deal-flow/deal-detail/{id}`) - "Book Deal Review" CTA
- Post-Acquisition Hub (`/post-acquisition/hub`) - "Book Coaching" CTA

### TO
- Consultation History (`/discovery/consultation` - history tab) - "View All Consultations" link
- Discovery Hub (`/discovery`) - "Back to Discovery" link
- Dashboard (`/dashboard`) - After booking confirmation

---

## Content

**Page Header:**
- **Headline:** "Book a Consultation"
- **Subheadline:** "Get personalized guidance from a Renew advisor."

**Consultation Type Descriptions:**

**Discovery Consultation:**
- "Ideal for exploring acquisition entrepreneurship, refining criteria, and planning your preparation strategy."
- Included: 1/month (Starter), 3/month (Professional+)

**Deal Review Consultation:**
- "Review specific deals with an advisor. Discuss valuation, due diligence, negotiation, and financing strategies."
- Included: 3/month (Professional), 5/month (Enterprise)

**Post-Acquisition Consultation:**
- "Strategic guidance for first-time owners navigating transition, operations, and growth challenges."
- Included: 5/month (Enterprise), unlimited (Operating Partner)

**Tier Limits:**
- Starter (€99/month): 1 consultation/month included
- Professional (€249/month): 3 consultations/month included
- Enterprise (€349/month): 5 consultations/month included
- Operating Partner (add-on): Unlimited consultations

**Exceeded Limit Message:**
- "You've used all included consultations this month."
- Options:
  - "Wait until next month" (reset date shown)
  - "Book additional session (€150)" (pay per session)
  - "Upgrade tier for more included sessions"

**Confirmation Email Content:**
- Subject: "Consultation Confirmed: [Date] at [Time]"
- Body:
  - Booking details (type, date, time, advisor)
  - Meeting link (Zoom/Google Meet)
  - Calendar attachment (.ics)
  - Preparation tips: "Review your criteria/deal details before call"
  - Reschedule/cancel link

**Reminder Emails:**
- 24 hours before: "Your consultation is tomorrow at [time]"
- 1 hour before: "Your consultation starts in 1 hour. [Meeting Link]"

---

## States

### 1. Initial Load
- Show all consultation types
- Calendar displays current month
- No date/time selected yet
- "Confirm" button disabled

### 2. Type Selected
- Consultation type highlighted
- Duration options appear
- Calendar available for selection

### 3. Date Selected
- Date highlighted on calendar
- Available time slots displayed
- User can select time

### 4. Time Selected
- Time slot highlighted
- Booking details form appears
- "Confirm" button enabled (after required fields filled)

### 5. Submitting Booking
- "Confirm" button shows spinner: "Booking..."
- Disable form to prevent double-submit

### 6. Booking Confirmed
- Show success message and booking summary
- Email confirmation sent
- Actions: Add to calendar, view history, book another

### 7. Booking Failed
- Error message: "Unable to book. This time may no longer be available."
- CTA: "Try another time" (return to calendar)
- Support link: "Contact support if issue persists"

### 8. Exceeded Limit (Usage Cap)
- Banner: "You've used all included consultations this month."
- Options: Wait, pay additional, or upgrade
- Lock unavailable types (grayed out)

### 9. No Availability
- If no slots available in selected date range
- Message: "No availability in [current month]. Try next month."
- CTA: Navigate to next month
- Alternative: "Request custom time" (support form)

---

## Edge Cases

### Booking Within 24 Hours
- Show warning: "Bookings less than 24 hours in advance require advisor approval."
- Submit → "Request sent. You'll receive confirmation within 2 hours."

### Advisor Unavailable
- If selected advisor has no availability
- Message: "This advisor is fully booked. Try another advisor or date."
- Option: Auto-assign different advisor

### Timezone Confusion
- User travels or changes timezone
- Detect timezone change → show banner: "We detected a timezone change. Update booking?"
- Reschedule link

### Double Booking
- User tries to book time slot that just became unavailable
- Error: "This slot is no longer available. Please select another time."
- Refresh calendar automatically

### Consultation Doesn't Happen
- Advisor no-show or technical issue
- Email follow-up: "We're sorry for the inconvenience. Rebook for free."
- Credit account with extra session

### Free Tier Limit
- User on Starter tier (1/month limit) tries to book 2nd
- Upsell modal: "Upgrade to Professional for 3 consultations/month"
- Option: Pay €150 for additional session

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through type options, calendar days, time slots
  - Arrow keys to navigate calendar
  - Enter to select date/time
  - Shift+Tab to go back

- **Screen Reader:**
  - Announce consultation types and descriptions
  - Read calendar dates and availability
  - Announce time slots with timezone
  - Confirm booking details before submitting

- **Color Contrast:** 4.5:1 minimum

- **ARIA:**
  - `role="radiogroup"` for type and duration options
  - `role="grid"` for calendar with proper row/column headers
  - `aria-label` on calendar navigation
  - `aria-selected="true"` on selected date/time
  - `aria-disabled="true"` on unavailable dates

---

## Analytics

**Events:**
1. "consultation_booking_started" (type)
2. "consultation_type_selected" (type, duration)
3. "consultation_date_selected" (date)
4. "consultation_time_selected" (time)
5. "consultation_booked" (type, date, time, advisor)
6. "consultation_booking_failed" (error_reason)
7. "consultation_limit_exceeded" (tier)
8. "consultation_upsell_viewed" (upgrade or pay)

**Metrics to Track:**
- Booking conversion rate (started → completed)
- Most popular consultation types
- Most popular days/times
- Advisor selection (auto vs. manual)
- Usage by tier (consultations/month)
- No-show rate
- Rescheduling rate

---

## Technical Notes

**API Endpoint:** `GET /api/consultations/availability`

**Query Parameters:**
- `type`: discovery | deal_review | post_acquisition
- `duration`: 30 | 60
- `month`: 2025-11
- `advisorId`: (optional) specific advisor

**Response (200):**
```json
{
  "availability": [
    {
      "date": "2025-11-09",
      "slots": [
        {"time": "09:00", "available": true},
        {"time": "10:00", "available": true},
        {"time": "14:00", "available": false}
      ]
    }
  ],
  "userLimit": {
    "tier": "professional",
    "included": 3,
    "used": 1,
    "remaining": 2
  }
}
```

**Book Consultation:** `POST /api/consultations/book`

**Payload:**
```json
{
  "type": "discovery",
  "duration": 30,
  "date": "2025-11-09",
  "time": "10:00",
  "timezone": "Europe/Paris",
  "advisorId": "auto",
  "topic": "Review my acquisition criteria",
  "meeting Preference": "video",
  "document": "https://cdn.renew.com/uploads/user-123-file.pdf"
}
```

**Response (200):**
```json
{
  "bookingId": "cons-12345",
  "confirmed": true,
  "advisor": {
    "id": "adv-001",
    "name": "Marie Dubois",
    "email": "marie@renew.com"
  },
  "meetingLink": "https://zoom.us/j/123456789",
  "icsUrl": "https://api.renew.com/consultations/cons-12345.ics"
}
```

**Reschedule/Cancel:** `PATCH /api/consultations/{bookingId}`

---

## Design System References

**Components:** Radio Button, Calendar, Button, Form Input, Text Area, File Upload, Modal
**Colors:** Primary `#2D65F8`, Success `#10B981`, Neutral `#6B7280`
**Typography:** H2 24px Bold (type titles), Body 16px Regular (descriptions), Caption 14px (metadata)
**Spacing:** Panel padding 32px, form gaps 16px, calendar cell size 40px

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
