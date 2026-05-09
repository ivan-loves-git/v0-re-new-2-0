# Page Specification: Saved Deals

**Route:** `/deal-flow/saved`
**Section:** Deal Flow
**Authentication Required:** Yes (Professional/Enterprise only)

---

## Purpose

Central collection of user's bookmarked deals for easy comparison, tracking, and decision-making, allowing users to organize their shortlist of interesting opportunities before moving them to the active pipeline.

---

## Layout Structure

**Layout Type:** List/Grid hybrid with sorting and filtering

```
┌─────────────────────────────────────┐
│  Saved Deals (12)                   │
│  ─────────────────────────────────  │
│                                     │
│  Your shortlisted opportunities      │
│                                     │
│  Sort: [Recently Saved ▼]           │
│  View: [◫ Grid] [☰ List] [⊞ Compare]│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ┌──────┐ ┌──────┐ ┌──────┐    ││
│  │ │Deal 1│ │Deal 2│ │Deal 3│     ││
│  │ │Health│ │Tech  │ │Retail│     ││
│  │ │€2.5M │ │€1.8M │ │€3.2M │     ││
│  │ │      │ │      │ │      │     ││
│  │ │[View]│ │[View]│ │[View]│     ││
│  │ └──────┘ └──────┘ └──────┘     ││
│  │                                 ││
│  │ ┌──────┐ ┌──────┐ ┌──────┐    ││
│  │ │Deal 4│ │Deal 5│ │Deal 6│     ││
│  │ │...   │ │...   │ │...   │     ││
│  │ └──────┘ └──────┘ └──────┘     ││
│  └─────────────────────────────────┘│
│                                     │
│  [Browse More Deals]                │
└─────────────────────────────────────┘
```

---

## Key Components

### Page Header
- **Title:** "Saved Deals"
- **Count Badge:** "(12)" - Total saved deals
- **Description:** "Your shortlisted opportunities"
- **Quick Stats:**
  - Total saved: 12
  - Added this week: 3
  - Price range: €1M - €5M

### Controls Bar
**Sort Options:**
- Recently Saved (default)
- Price: Low to High
- Price: High to Low
- Revenue: High to Low
- Date Listed: Newest
- Best Match (per criteria)

**View Switcher:**
- Grid View (default) - 3 columns
- List View - Detailed rows
- Compare View - Side-by-side table

**Filter Options (Simplified):**
- Industry (from saved deals)
- Price Range (quick ranges)
- Location (from saved deals)
- "Clear Filters" link

### Deal Cards (Grid View)
**Card Contents:**
- Anonymized business name
- Industry badge
- Location (City, Country)
- Key metrics:
  - Asking Price
  - Annual Revenue
  - EBITDA Margin
  - Employees
- Save date: "Saved 3 days ago"
- Status badges:
  - "New Info" (updated since saved)
  - "Price Reduced"
  - "High Interest" (many saves)
- Actions:
  - "View Details" - Primary CTA
  - "Add to Pipeline" - Secondary
  - "Remove" - Icon button (trash)
  - "Compare" - Checkbox

### List View
**Row Contents:**
- All grid view info in horizontal layout
- Additional fields:
  - Years Operating
  - Revenue Growth %
  - Brief description (2 lines)
- Inline actions
- Expand arrow for quick preview

### Compare View
**Table Layout:**
- Fixed left column with metrics
- Scrollable columns for deals (max 5)
- Metrics rows:
  - Business Name
  - Industry
  - Location
  - Asking Price
  - Revenue
  - EBITDA
  - Margin %
  - Employees
  - Years Operating
  - Growth Rate
  - Seller Type
  - Timeline
- Highlight differences
- "Remove from comparison" button per column
- "Export Comparison" (PDF/Excel)

### Actions Section
**Bulk Actions (when items selected):**
- "Add to Pipeline" (batch)
- "Remove from Saved" (batch)
- "Export List" (CSV)
- "Share Collection" (generate link)

**Individual Actions:**
- View Details
- Add to Pipeline
- Remove from Saved
- Add Note (quick note on card)

### Empty State
- Illustration of empty bookmarks
- Message: "No saved deals yet"
- Description: "Save interesting opportunities while browsing to build your shortlist"
- CTA: "Browse Deals →"

### Bottom Actions
- "Browse More Deals" button
- "Set Up Deal Alert" link
- Pagination or infinite scroll

---

## Interactive Elements

### Card Interactions
1. **Card Hover:**
   - Elevation change
   - Show quick stats
   - Preview actions

2. **View Details:**
   - Click card → Deal detail page
   - Opens in same tab (back preserves state)
   - Cmd/Ctrl+Click for new tab

3. **Add to Pipeline:**
   - Opens modal
   - Select pipeline stage
   - Add initial notes
   - Success toast

4. **Remove from Saved:**
   - Confirmation: "Remove from saved deals?"
   - Animated removal
   - Toast: "Deal removed from saved"
   - Undo option (5 seconds)

5. **Compare Checkbox:**
   - Select up to 5 deals
   - Show comparison bar when 2+ selected
   - "Compare Selected" button appears

### View Switching
1. **Grid/List/Compare Toggle:**
   - Instant switch (no reload)
   - Maintains selection
   - Saves preference

2. **Sort Change:**
   - Animated reorder
   - Maintains view type

### Bulk Operations
1. **Select All/None:**
   - Checkbox in header
   - Shows selection count

2. **Batch Actions:**
   - Appears when 1+ selected
   - Process with progress bar
   - Success/error summary

### Notes Feature
1. **Add Note:**
   - Inline text field
   - Auto-save
   - Timestamp
   - Private to user

---

## Navigation

### FROM
- Deal Flow Landing (`/deal-flow`)
- Browse Deals (`/deal-flow/browse`) - After saving
- Deal Detail (`/deal-flow/deal/{id}`) - After saving
- Dashboard (`/dashboard`) - Saved deals widget
- Email notifications - "Deal updated" alerts

### TO
- Deal Detail (`/deal-flow/deal/{id}`)
- Pipeline (`/deal-flow/pipeline`) - After adding
- Browse Deals (`/deal-flow/browse`)
- Compare View (same page, different view)
- Export/Download (file download)

---

## Content

### Page Copy

**Headers:**
- "Saved Deals"
- "Your shortlisted opportunities"

**View Labels:**
- "Grid View"
- "List View"
- "Compare"

**Sort Options:**
- "Recently Saved"
- "Price: Low to High"
- "Price: High to Low"
- "Revenue: High to Low"
- "Date Listed"
- "Best Match"

**Card Labels:**
- "Saved X days ago"
- "View Details"
- "Add to Pipeline"
- "Remove"

**Status Messages:**
- "New Info Available"
- "Price Reduced"
- "High Interest"
- "Closing Soon"

**Empty State:**
- Heading: "No saved deals yet"
- Body: "Save interesting opportunities while browsing to build your shortlist for comparison and tracking."
- CTA: "Browse Deals"

**Bulk Actions:**
- "X deals selected"
- "Add All to Pipeline"
- "Remove All"
- "Export Selection"

**Confirmations:**
- Remove: "Remove this deal from saved? You can save it again later."
- Bulk Remove: "Remove X deals from saved?"
- Pipeline: "Add X deals to pipeline?"

**Success Messages:**
- "Deal removed from saved"
- "X deals added to pipeline"
- "Comparison exported"
- "Note saved"

---

## States

### 1. Default (Has Saved Deals)
- Shows all saved deals
- Sort/filter enabled
- Actions available

### 2. Empty State
- No deals saved
- Shows helpful message
- CTA to browse

### 3. Loading
- Skeleton cards
- "Loading saved deals..."
- Quick (< 1 second)

### 4. Compare Mode
- 2-5 deals selected
- Comparison table visible
- Other deals grayed out

### 5. Bulk Selection Mode
- Checkboxes visible
- Bulk action bar appears
- Individual actions hidden

### 6. Filtered View
- Active filters shown
- "X of Y deals shown"
- Clear filters option

### 7. Error State
- "Unable to load saved deals"
- Retry button
- Support link

---

## Edge Cases

### Deal No Longer Available
- Deal was removed/sold
- Show with strikethrough
- Badge: "No Longer Available"
- Auto-remove option

### Maximum Saved Limit
- If limit exists (e.g., 50 for Professional)
- Warning at 80% full
- At limit: "Maximum saved deals reached (50/50)"
- Suggest removing old saves

### Duplicate Save Attempt
- User tries to save already saved deal
- Message: "Already in your saved deals"
- Link: "View in Saved"

### Lost Connection During Bulk Action
- Queue actions locally
- Retry when reconnected
- Show pending state

### Comparison Limit
- Max 5 deals for comparison
- Disable additional checkboxes
- Message: "Maximum 5 deals for comparison"

### Updated Deal Information
- Show "Updated" badge
- Optional notification
- Highlight what changed

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through cards and controls
  - Space to select for compare
  - Enter to view details
  - Delete key to remove (with confirmation)

- **Screen Reader:**
  - Announce deal count
  - Read card contents
  - Describe sort/filter state
  - Alert on changes

- **Visual:**
  - Focus indicators
  - High contrast support
  - Status badges use icons + color

- **ARIA:**
  - `role="list"` on deal container
  - `role="listitem"` on cards
  - `aria-label` on all buttons
  - `aria-live` for updates
  - `aria-selected` for compare mode

---

## Analytics

**Events:**
1. "saved_deals_viewed" (count, user_tier)
2. "saved_deals_sorted" (sort_type)
3. "saved_deals_view_changed" (view_type)
4. "saved_deal_viewed" (deal_id, position)
5. "saved_deal_removed" (deal_id, age_days)
6. "saved_deal_pipeline_added" (deal_id, stage)
7. "saved_deals_compared" (deal_ids[], count)
8. "saved_deals_exported" (format, count)
9. "saved_deal_note_added" (deal_id)
10. "saved_deals_bulk_action" (action, count)

**Metrics:**
- Average saved deals per user
- Save to pipeline conversion rate
- Time from save to pipeline
- Comparison usage rate
- View type preference
- Remove rate and reasons

---

## Technical Notes

### API Endpoints

**Get Saved Deals:** `GET /api/deals/saved`

**Response:**
```json
{
  "savedDeals": [
    {
      "deal": {
        "id": "deal-123",
        "anonymizedName": "Established Healthcare Practice",
        "location": "Lyon, France",
        "industry": "Healthcare",
        "metrics": {
          "askingPrice": 2500000,
          "annualRevenue": 3200000,
          "ebitdaMargin": 0.22,
          "employees": 35
        },
        "status": {
          "isActive": true,
          "hasUpdates": true,
          "priceReduced": false,
          "interestLevel": "high"
        }
      },
      "savedAt": "2024-11-09T10:00:00Z",
      "notes": "Good location, strong financials",
      "tags": ["priority", "matches-criteria"]
    }
  ],
  "stats": {
    "total": 12,
    "addedThisWeek": 3,
    "priceRange": {
      "min": 1000000,
      "max": 5000000
    }
  },
  "filters": {
    "industries": ["Healthcare", "Technology", "Retail"],
    "locations": ["France", "Belgium"],
    "priceRanges": ["€1-3M", "€3-5M"]
  }
}
```

**Remove from Saved:** `DELETE /api/deals/{id}/save`

**Add Note:** `PATCH /api/deals/{id}/note`
```json
{
  "note": "Interesting opportunity, need to review financials"
}
```

**Bulk Add to Pipeline:** `POST /api/deals/pipeline/bulk`
```json
{
  "dealIds": ["deal-123", "deal-456"],
  "stage": "initial_review",
  "notes": "Batch added from saved deals"
}
```

### Performance
- Paginate after 20 deals
- Lazy load images
- Cache saved deals (1 min)
- Optimistic UI for remove/add actions
- Virtual scroll for large lists

### Storage
- Save view preference to localStorage
- Cache sort preference
- Remember compare selections
- Store collapsed/expanded states

---

## Design System References

**Components:** Card, Button, Badge, Table, Checkbox, Dropdown, Toast, Modal
**Colors:** Primary `#2D65F8`, Success `#10B981`, Danger `#EF4444`, Neutral `#6B7280`
**Typography:** H1 32px Bold, H3 18px Semibold, Body 14px Regular
**Spacing:** Card gap 20px, Section padding 32px
**Icons:** Star (saved), Pipeline, Trash, Compare, Export, Note

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*