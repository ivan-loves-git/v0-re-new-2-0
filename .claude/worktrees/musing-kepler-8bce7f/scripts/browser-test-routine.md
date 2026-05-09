# Re-New Platform Browser Test Routine

## Setup: Connect Claude-in-Chrome to Claude Code CLI

The Chrome sidebar extension and Claude Code CLI are **separate**. To use browser automation from the terminal:

### Option 1: Use Claude-in-Chrome MCP (Recommended)
1. Make sure Chrome is open
2. The extension should be running (you see it in sidebar)
3. In Claude Code, run: `/mcp` to check MCP server status
4. If `claude-in-chrome` shows disconnected, try:
   - Restart Chrome completely (quit and reopen)
   - Restart Claude Code (`/exit` then `claude`)
   - Check if extension needs permissions update

### Option 2: Manual Testing with This Checklist
Use this checklist to test manually while browser automation is being sorted.

---

## Test Routine: 5 Core Flows

### Flow 1: Dashboard & Navigation
**URL:** `https://v0-re-new-2-0.vercel.app`

- [ ] Dashboard loads without errors
- [ ] Pipeline Stats card shows counts (Leads, Qualified, Clients)
- [ ] Top Rated section displays repreneurs with scores
- [ ] Top Tier 2 section displays star ratings
- [ ] Conversion Funnel visualization renders
- [ ] Journey Stages chart renders
- [ ] Activity Stream shows recent activities
- [ ] Recently Added shows latest repreneurs
- [ ] All sidebar links are clickable

**Console check:** Open DevTools (F12) → Console → No red errors

---

### Flow 2: Repreneurs List & Search
**URL:** `https://v0-re-new-2-0.vercel.app/repreneurs`

- [ ] Page loads with grouped view (Leads/Qualified/Clients/Rejected sections)
- [ ] Each section shows correct count badge
- [ ] Search bar works (type a name, results filter)
- [ ] Status dropdown filter works
- [ ] Pagination works within each group (if >8 items)
- [ ] Click column header to sort (Name, Email, Created)
- [ ] Click any row → navigates to profile page
- [ ] Collapse/expand group sections work

**Test data:**
- Search: "Charlie" or "Test"
- Filter: Select "Qualified" status

---

### Flow 3: Repreneur Profile & Editing
**URL:** Click any repreneur from list

- [ ] Profile page loads with all sections
- [ ] Avatar displays (or initials if no photo)
- [ ] Inline edit: Hover over name → pencil icon appears
- [ ] Click pencil → edit mode → type → press Enter → saves
- [ ] Rating card shows WHO/WHEN scores (or "Not rated")
- [ ] Tier 2 stars display if rated
- [ ] Investment Profile section shows dropdowns
- [ ] Questionnaire V2 card expands on click
- [ ] Notes section: Click "+ Add Note" → modal opens
- [ ] Add a test note → appears in list
- [ ] Delete note via dropdown menu → removes from list
- [ ] Back button returns to list

**Inline edit test:**
1. Click pencil on phone number
2. Change last digit
3. Press Enter
4. Verify toast says "Saved"
5. Refresh page → change persisted

---

### Flow 4: Pipeline/Kanban View
**URL:** `https://v0-re-new-2-0.vercel.app/pipeline`

- [ ] Kanban board loads with columns
- [ ] Columns visible: Lead, Qualified, Client (+ Rejected?)
- [ ] Cards display in correct columns based on status
- [ ] Card shows: Name, email, score/rating preview
- [ ] Click card → navigates to profile OR opens modal
- [ ] Drag card to different column → status updates
- [ ] After drag, refresh page → change persisted

**Drag test:**
1. Find a "Lead" card
2. Drag to "Qualified" column
3. Check toast notification
4. Refresh page
5. Card should still be in Qualified

---

### Flow 5: Public Intake Form (v2)
**URL:** `https://v0-re-new-2-0.vercel.app/intake-v2`

**Step 1: Contact Info**
- [ ] Form loads with progress bar (Step 1 of 6)
- [ ] Language toggle (EN/FR) works in top-right
- [ ] Required fields: First name, Last name, Email, Phone, CV
- [ ] Try clicking Next with empty fields → blocked or error shown
- [ ] Upload a PDF as CV → shows uploaded filename
- [ ] Fill all required fields → Next button enabled

**Test data:**
```
First name: Test
Last name: Browser
Email: test-browser-TIMESTAMP@example.com
Phone: 0612345678
CV: Upload any PDF
```

**Step 2: WHO Profile**
- [ ] 6 radio group questions display
- [ ] All questions required before Next works
- [ ] Select one option per question
- [ ] Progress bar shows Step 2

**Step 3: Project Status**
- [ ] Multi-select checkboxes for project maturity
- [ ] At least one must be selected

**Step 4: WHEN Criteria**
- [ ] 5 questions with multi-select options
- [ ] Geographic zones, sectors, deal size, etc.
- [ ] All required

**Step 5: Needs Assessment**
- [ ] Current needs multi-select (required)
- [ ] Investment thesis upload (optional)
- [ ] Marketing consent checkbox (required)

**Step 6: Review**
- [ ] All answers displayed in summary
- [ ] Edit buttons jump to correct step
- [ ] Click Edit on Step 2 → goes to Step 2
- [ ] Make a change → return to Review
- [ ] Submit button enabled
- [ ] Click Submit → redirects to success page

**Success Page:**
- [ ] Shows confirmation message
- [ ] Both French and English text
- [ ] Link to re-new.team website works

---

## Automated Test Commands (When MCP Connected)

Once `claude-in-chrome` MCP is connected, run these in Claude Code:

```
# Get tab context
mcp__claude-in-chrome__tabs_context_mcp

# Create new tab
mcp__claude-in-chrome__tabs_create_mcp

# Navigate to Re-New
mcp__claude-in-chrome__navigate url="https://v0-re-new-2-0.vercel.app" tabId=TAB_ID

# Take screenshot
mcp__claude-in-chrome__computer action="screenshot" tabId=TAB_ID

# Click element
mcp__claude-in-chrome__computer action="left_click" coordinate=[X,Y] tabId=TAB_ID

# Find elements
mcp__claude-in-chrome__find query="login button" tabId=TAB_ID

# Read page structure
mcp__claude-in-chrome__read_page tabId=TAB_ID filter="interactive"
```

---

## Quick Smoke Test (2 min)

If you only have 2 minutes, verify these critical paths:

1. **Login works** - Can access dashboard
2. **List loads** - `/repreneurs` shows data
3. **Profile opens** - Click any repreneur, page loads
4. **Intake form** - `/intake-v2` loads Step 1
5. **No console errors** - F12 → Console → No red errors

---

## Reporting Issues

If you find bugs during testing:

1. Screenshot the issue
2. Copy console errors (if any)
3. Note the URL and steps to reproduce
4. Create GitHub issue or tell Claude

Test completed: ____/____/2026
Tester: ________________
Result: [ ] PASS  [ ] FAIL
Notes: ________________
