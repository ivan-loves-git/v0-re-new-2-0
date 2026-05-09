# Page Specification: Deal Pipeline

**Route:** `/deal-flow/pipeline`
**Section:** Deal Flow
**Authentication Required:** Yes (Professional/Enterprise only)

---

## Purpose

Visual Kanban board for tracking and managing active deals through the acquisition process, from initial review to closing, helping users organize their deal flow and monitor progress across multiple opportunities.

---

## Layout Structure

**Layout Type:** Horizontal scrollable Kanban board

```
┌─────────────────────────────────────────────────┐
│  Your Pipeline (5 active deals)                  │
│  ─────────────────────────────────────────────  │
│  Track your acquisition opportunities            │
│                                                  │
│  [+ Add Deal] [Filter ▼] [Analytics]            │
│                                                  │
│ ┌──────────┬──────────┬──────────┬──────────┐  │
│ │Initial   │Due       │Negotiation│Closing   │  │
│ │Review (1)│Diligence │(2)        │(0)       │  │
│ │          │(2)       │           │          │  │
│ │┌────────┐│┌────────┐│┌────────┐│          │  │
│ ││Deal A  │││Deal B  │││Deal D  ││          │  │
│ ││Healthcare││Tech    ││Retail   ││          │  │
│ ││€2.5M   │││€1.8M   │││€3.2M   ││          │  │
│ ││3 days  │││5 days  │││12 days  ││          │  │
│ │└────────┘│└────────┘│└────────┘│          │  │
│ │          │┌────────┐│┌────────┐│          │  │
│ │          ││Deal C  │││Deal E   ││          │  │
│ │          ││Services│││Manufact.││          │  │
│ │          ││€4.1M   │││€2.8M   ││          │  │
│ │          ││8 days  │││2 days   ││          │  │
│ │          │└────────┘│└────────┘│          │  │
│ │          │          │           │          │  │
│ │[+ Add]   │[+ Add]   │[+ Add]    │[+ Add]   │  │
│ └──────────┴──────────┴──────────┴──────────┘  │
│                                                  │
│ Archived (12) | Lost (8) | Completed (2)        │
└─────────────────────────────────────────────────┘
```

---

## Key Components

### Page Header
- **Title:** "Your Pipeline"
- **Subtitle:** "Track your acquisition opportunities"
- **Stats Bar:**
  - Active deals: 5
  - Total value: €14.4M
  - Avg. time in pipeline: 7 days
  - Success rate: 20%

### Action Bar
**Primary Actions:**
- **Add Deal:** Opens modal to add from saved or search
- **Filter:** Dropdown with quick filters
  - All Deals
  - My Priority
  - This Week
  - Overdue
  - By Industry
  - By Price Range
- **Analytics:** Opens pipeline analytics view

**Secondary Actions:**
- **Export:** Download pipeline data (CSV/PDF)
- **Settings:** Configure stages, notifications
- **Archive View:** See archived/lost/won deals

### Pipeline Columns (Stages)

**Default Stages:**
1. **Initial Review** - First evaluation
2. **Due Diligence** - Detailed investigation
3. **Negotiation** - Terms discussion
4. **Closing** - Final steps

**Column Header:**
- Stage name
- Deal count in parentheses
- Total value in stage
- Average time in stage
- Column actions menu (⋮)

**Column Features:**
- Droppable zone for cards
- Auto-scroll when dragging
- Visual feedback on hover
- "Add Deal" button at bottom

### Deal Cards

**Card Contents:**
- **Header:**
  - Anonymized business name
  - Priority flag (if set)
  - Days in current stage
- **Body:**
  - Industry badge
  - Location
  - Asking price
  - Key metric (Revenue or EBITDA)
  - Progress bar (optional)
- **Footer:**
  - Last activity
  - Next action/task
  - Owner avatar (if team)
- **Quick Actions (hover):**
  - View details
  - Add note
  - Set reminder
  - Archive/Remove

**Card States:**
- Normal
- Priority (highlighted border)
- Overdue (red indicator)
- Updated (blue dot)
- Stale (>30 days, grayed)

### Deal Modal (Add/Edit)

**Add Deal to Pipeline:**
- Search saved deals
- Or browse all deals
- Select initial stage
- Add notes/reason
- Set priority level
- Assign team member (Enterprise)

**Quick Add from Saved:**
- List of saved deals
- Checkbox selection
- Bulk add capability
- Default to Initial Review

### Analytics View (Modal/Page)

**Metrics Dashboard:**
- **Funnel Chart:** Conversion by stage
- **Time Analysis:** Average days per stage
- **Success Metrics:**
  - Win rate
  - Lost reasons
  - Average deal size
- **Velocity:** Deals moved this week/month
- **Trends:** Pipeline value over time

### Archive Section (Collapsed)

**Categories:**
- **Won Deals:** Successfully closed (2)
- **Lost Deals:** Did not proceed (8)
- **On Hold:** Paused opportunities (3)
- **Archived:** Removed from active (12)

**Archive Card (Simplified):**
- Business name
- Final price/reason
- Date archived
- Restore option

### Activity Feed (Optional Sidebar)

**Recent Activities:**
- "Deal A moved to Due Diligence"
- "Note added to Deal B"
- "Deal C price updated"
- "Reminder: Follow up on Deal D"

**Filters:**
- All activity
- My deals only
- Last 7 days
- Mentions

---

## Interactive Elements

### Drag and Drop
1. **Drag Deal Cards:**
   - Click and hold to drag
   - Visual ghost while dragging
   - Drop zones highlight
   - Auto-scroll at edges

2. **Drop Validation:**
   - Can't skip stages (optional)
   - Confirmation for backward moves
   - Update timestamp on move

3. **Multi-Select Drag:**
   - Ctrl/Cmd click to select multiple
   - Drag all selected together
   - Bulk stage update

### Card Interactions
1. **Click Card:**
   - Opens deal detail in modal/new tab
   - Configurable behavior

2. **Quick Actions:**
   - Hover to reveal actions
   - Click for quick note
   - Right-click for context menu

3. **Priority Toggle:**
   - Star icon to set priority
   - Moves to top of column
   - Highlighted appearance

### Column Actions
1. **Add Deal:**
   - Opens add modal
   - Pre-selects stage
   - Quick add from saved

2. **Column Menu (⋮):**
   - Rename stage (custom)
   - Set WIP limit
   - Clear column
   - Archive all cards

### Filtering
1. **Quick Filters:**
   - Instant apply
   - Show count in parentheses
   - Clear filter button

2. **Advanced Filter:**
   - Multiple criteria
   - Save filter sets
   - Share with team (Enterprise)

---

## Navigation

### FROM
- Deal Flow Landing (`/deal-flow`)
- Browse Deals (`/deal-flow/browse`) - "Add to Pipeline"
- Saved Deals (`/deal-flow/saved`) - "Add to Pipeline"
- Deal Detail (`/deal-flow/deal/{id}`) - "Add to Pipeline"
- Dashboard (`/dashboard`) - Pipeline widget

### TO
- Deal Detail (`/deal-flow/deal/{id}`) - Click card
- Browse Deals (`/deal-flow/browse`) - "Add Deal"
- Saved Deals (`/deal-flow/saved`) - "Add from Saved"
- Analytics View (modal or `/deal-flow/pipeline/analytics`)
- Archive View (`/deal-flow/pipeline/archive`)

---

## Content

### Headers & Labels

**Page:**
- "Your Pipeline"
- "Track deals through your acquisition process"

**Stages:**
- "Initial Review" - Evaluating opportunity
- "Due Diligence" - Investigating details
- "Negotiation" - Discussing terms
- "Closing" - Finalizing deal

**Card Elements:**
- "X days in stage"
- "Last updated X days ago"
- "Next: [Action needed]"
- "Priority"

**Actions:**
- "Add Deal"
- "Move to [Stage]"
- "Archive Deal"
- "Mark as Won/Lost"

**Empty States:**
- Column: "No deals in this stage. Drag deals here or add new ones."
- Pipeline: "Your pipeline is empty. Start by adding deals from your saved list or browse for new opportunities."

**Confirmations:**
- Move backward: "Move deal back to [stage]? Add a note explaining why."
- Archive: "Archive this deal? You can restore it later."
- Remove: "Remove from pipeline? This cannot be undone."

**Success Messages:**
- "Deal moved to [stage]"
- "Deal added to pipeline"
- "Note saved"
- "Deal archived"

---

## States

### 1. Default (Active Deals)
- Shows all columns with deals
- Drag and drop enabled
- Actions available

### 2. Empty Pipeline
- Empty columns visible
- Welcome message
- CTA to add first deal
- Quick tour option

### 3. Loading
- Skeleton columns and cards
- "Loading pipeline..."
- Maintain layout structure

### 4. Filtered View
- Active filter badge
- Subset of deals shown
- "Showing X of Y deals"
- Clear filter option

### 5. Read-Only (Viewing Others)
- For Enterprise teams
- Can view but not edit
- "Viewing [Name]'s pipeline"

### 6. Limit Reached
- If pipeline limit exists
- Warning: "Pipeline full (20/20)"
- Suggest archiving old deals

### 7. Error State
- "Unable to load pipeline"
- Retry button
- Offline mode (if cached)

---

## Edge Cases

### Concurrent Edits (Team)
- Real-time updates
- "Deal updated by [user]"
- Conflict resolution
- Activity feed shows changes

### Deal No Longer Available
- Deal removed from marketplace
- Show with strikethrough
- "No longer available" badge
- Auto-archive option

### Stage Limits (WIP)
- Optional WIP limits per stage
- Warning when approaching
- Block moves if at limit
- "Stage full (5/5)"

### Bulk Operations
- Select multiple cards
- Move all to stage
- Archive selected
- Add notes to multiple

### Offline Mode
- Cache pipeline locally
- Queue changes
- Sync when online
- Show offline indicator

### Custom Stages
- Add/remove/rename stages
- Reorder stages
- Set stage rules
- Maximum 8 stages

---

## Accessibility

- **Keyboard Navigation:**
  - Tab between columns
  - Arrow keys to select cards
  - Space to pick up card
  - Arrow keys to move between columns
  - Space to drop card
  - Escape to cancel drag

- **Screen Reader:**
  - Announce stage names and counts
  - Read card position
  - Announce drag/drop actions
  - Describe card movements

- **Visual:**
  - High contrast borders
  - Focus indicators
  - Drag preview for clarity
  - Status icons + text

- **ARIA:**
  - `role="list"` on columns
  - `aria-label` with stage info
  - `aria-grabbed` for drag state
  - `aria-dropeffect` for drop zones
  - Live regions for updates

---

## Analytics & Tracking

**Events:**
1. "pipeline_viewed" (deal_count, total_value)
2. "pipeline_deal_added" (deal_id, stage, source)
3. "pipeline_deal_moved" (deal_id, from_stage, to_stage, days_in_stage)
4. "pipeline_deal_archived" (deal_id, reason, days_in_pipeline)
5. "pipeline_deal_won" (deal_id, final_price, days_to_close)
6. "pipeline_deal_lost" (deal_id, reason, stage_lost)
7. "pipeline_filter_applied" (filter_type)
8. "pipeline_analytics_viewed"
9. "pipeline_note_added" (deal_id, stage)
10. "pipeline_priority_set" (deal_id)

**Metrics:**
- Average deals in pipeline
- Stage conversion rates
- Time in each stage
- Win/loss ratio
- Pipeline velocity
- Deal value distribution
- Most common loss reasons
- Stage bottlenecks

---

## Technical Notes

### API Endpoints

**Get Pipeline:** `GET /api/pipeline`

**Response:**
```json
{
  "stages": [
    {
      "id": "initial_review",
      "name": "Initial Review",
      "position": 1,
      "deals": [
        {
          "id": "deal-123",
          "anonymizedName": "Healthcare Practice",
          "industry": "Healthcare",
          "location": "Lyon, France",
          "askingPrice": 2500000,
          "annualRevenue": 3200000,
          "daysInStage": 3,
          "lastActivity": "2024-11-09T10:00:00Z",
          "priority": false,
          "nextAction": "Review financials",
          "notes": "Promising opportunity"
        }
      ],
      "stats": {
        "count": 1,
        "totalValue": 2500000,
        "avgDays": 3
      }
    }
  ],
  "summary": {
    "totalDeals": 5,
    "totalValue": 14400000,
    "avgTimeInPipeline": 7,
    "winRate": 0.20
  },
  "archived": {
    "won": 2,
    "lost": 8,
    "onHold": 3,
    "archived": 12
  }
}
```

**Move Deal:** `PATCH /api/pipeline/deals/{id}`
```json
{
  "stage": "due_diligence",
  "notes": "Moving to due diligence after positive initial review"
}
```

**Add to Pipeline:** `POST /api/pipeline/deals`
```json
{
  "dealId": "deal-123",
  "stage": "initial_review",
  "priority": false,
  "notes": "Adding from saved deals"
}
```

### Real-time Updates (Enterprise)
- WebSocket for team pipelines
- Optimistic UI updates
- Conflict resolution
- Activity stream

### Performance
- Virtual scrolling for many deals
- Lazy load archived deals
- Cache pipeline state
- Throttle drag events
- Debounce auto-save

### Storage
- Save column widths
- Remember filters
- Cache last view
- Store custom stages

---

## Design System References

**Components:** Kanban Board, Card, Badge, Button, Modal, Dropdown
**Colors:**
- Stages: Different subtle backgrounds
- Priority: Warning `#F59E0B`
- Overdue: Danger `#EF4444`
- Success: `#10B981`
**Typography:** H2 24px Bold (stages), H4 16px Semibold (cards)
**Spacing:** Column width 300px min, Card gap 12px
**Drag Ghost:** Opacity 0.5, slight rotation

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*