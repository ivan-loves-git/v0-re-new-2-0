# Page Specification: Browse Deals

**Route:** `/deal-flow/browse`
**Section:** Deal Flow
**Authentication Required:** Yes (Professional/Enterprise only)

---

## Purpose

Main deal browsing interface where users can explore all available acquisition opportunities, apply filters to find matches, and save interesting deals to their shortlist or pipeline.

---

## Layout Structure

**Layout Type:** Two-column with filters sidebar

```
┌─────────────────────────────────────┐
│  Browse Deals                       │
│  ─────────────────────────────────  │
│                                     │
│ ┌──────────┬────────────────────┐  │
│ │ Filters  │ 48 deals found     │  │
│ │          │                    │  │
│ │Geography │ Sort: [Newest ▼]   │  │
│ │ ☑ France │                    │  │
│ │ ☐ Belgium│ ┌────────────────┐ │  │
│ │          │ │ Deal Card 1     │ │  │
│ │Industry  │ │ Healthcare      │ │  │
│ │ ☑ Health │ │ €2.5M • Lyon    │ │  │
│ │ ☐ Tech   │ │ ⭐ Save         │ │  │
│ │          │ └────────────────┘ │  │
│ │Price     │                    │  │
│ │ €1M-€3M  │ ┌────────────────┐ │  │
│ │ [====]   │ │ Deal Card 2     │ │  │
│ │          │ │ Professional    │ │  │
│ │Size      │ │ €1.8M • Paris   │ │  │
│ │Revenue   │ │ ⭐ Save         │ │  │
│ │ €500K+   │ └────────────────┘ │  │
│ │          │                    │  │
│ │[Clear]   │ [Load More]        │  │
│ └──────────┴────────────────────┘  │
└─────────────────────────────────────┘
```

**Responsive:**
- Desktop: Two-column layout (filters 280px, content flex)
- Tablet: Collapsible filters (toggle button)
- Mobile: Filters as bottom sheet or modal

---

## Key Components

### Page Header
- **Title:** "Browse Deals"
- **Result Count:** "48 deals found" (updates with filters)
- **Sort Dropdown:**
  - Newest First (default)
  - Price: Low to High
  - Price: High to Low
  - Revenue: High to Low
  - Best Match (based on criteria)
- **View Toggle:** Grid view (default) | List view

### Filters Sidebar (Left Column)

**Filter Groups:**

1. **Geography**
   - Checkboxes for countries/regions
   - Based on user's criteria + "Show All"
   - Count next to each option (e.g., "France (12)")

2. **Industry**
   - Checkboxes for industries
   - Grouped by category if many
   - Count badges
   - Search within industries (if 10+)

3. **Price Range**
   - Dual-handle slider
   - Min: €100K, Max: €50M
   - Input fields for exact values
   - Preset ranges (quick select):
     - €100K - €500K
     - €500K - €1M
     - €1M - €3M
     - €3M - €10M
     - €10M+

4. **Business Size**
   - Revenue Range (slider)
   - Employee Count (slider)
   - EBITDA Range (slider)
   - Years Operating (min)

5. **Business Model**
   - B2B / B2C / Both
   - Recurring Revenue (Yes/No/Any)
   - Asset Type (Asset-light/Asset-heavy/Any)

6. **Deal Type**
   - Full Acquisition
   - Majority Stake
   - Partnership
   - Management Buyout

7. **Seller Motivation**
   - Retirement
   - Strategic Exit
   - Distressed Sale
   - Partnership Seeking

**Filter Controls:**
- "Clear All" link at bottom
- "Save Filter Set" (for frequent searches)
- Applied filters count badge at top
- Each active filter shows (X) to remove

### Deal Grid (Main Content)

**Deal Cards (Grid View):**
- Card dimensions: 350px wide, auto height
- 3 columns on desktop, 2 on tablet, 1 on mobile
- Card contents:
  - **Header:**
    - Anonymized business name (e.g., "Established Healthcare Practice")
    - Industry badge
    - "New" badge if < 7 days
    - Save button (star icon)
  - **Key Metrics:**
    - Asking Price: €X.XM
    - Annual Revenue: €X.XM
    - Location: City, Country
    - EBITDA Margin: XX%
  - **Description:** 2-3 line preview
  - **Highlights:** 2-3 bullet points
  - **Tags:** 2-3 relevant tags (e.g., "Recurring Revenue", "20+ Years")
  - **CTA:** "View Details →"

**List View Alternative:**
- Horizontal cards with more detail
- Additional fields: Employees, Year Founded
- Inline preview of financials
- Quick expand for more info

**Load More:**
- Initial load: 12 deals
- "Load More" button at bottom
- Loads 12 more each time
- Progress indicator while loading
- Alternative: Infinite scroll option

### Empty States

**No Results:**
- Icon: 🔍
- Message: "No deals match your current filters"
- Suggestions:
  - "Try adjusting your filters"
  - "Save this search to get alerts for new matches"
- CTAs: "Clear Filters" / "Set Alert"

**All Deals Filtered Out:**
- Message: "Your filters are too restrictive"
- Show: "48 deals available before filtering"
- CTA: "Reset to Recommended" (user's criteria)

---

## Interactive Elements

### Filtering
1. **Checkbox Filters:**
   - Click to toggle
   - Updates results immediately
   - Loading state while fetching

2. **Slider Filters:**
   - Drag handles to adjust
   - Shows values while dragging
   - Debounced update (500ms after release)

3. **Clear Filters:**
   - Resets all to default
   - Shows confirmation if many active

4. **Save Filter Set:**
   - Opens modal to name and save
   - Appears in dropdown for quick access

### Deal Cards
1. **Card Hover:**
   - Elevation shadow
   - Show additional details
   - Preview financial charts (mini)

2. **Save Button:**
   - Toggle star (empty/filled)
   - Toast notification: "Deal saved"
   - Updates saved count in header

3. **View Details:**
   - Click card → deal detail page
   - Opens in new tab (Cmd/Ctrl + click)

4. **Quick Actions Menu (...):**
   - Save to Pipeline
   - Share Deal
   - Report Issue
   - Not Interested (hide from results)

### Sorting & View
1. **Sort Dropdown:**
   - Updates order immediately
   - Remembers preference

2. **View Toggle:**
   - Switch between grid/list
   - Smooth transition animation
   - Persists preference

---

## Navigation

### FROM
- Deal Flow Landing (`/deal-flow`)
- Dashboard (`/dashboard`) - "Browse Deals" widget
- Saved Deals (`/deal-flow/saved`) - "Browse More" link
- Email notifications - "New deals matching your criteria"

### TO
- Deal Detail (`/deal-flow/deal-detail/{id}`)
- Saved Deals (`/deal-flow/saved`) - Via save action
- Pipeline (`/deal-flow/pipeline`) - Via "Add to Pipeline"
- Lead de Cadrage (`/discovery/lead-de-cadrage`) - "Edit Criteria"

---

## Content

**Page Copy:**
- **Title:** "Browse Deals"
- **Subtitle:** "Explore acquisition opportunities"
- **Result Count:** "X deals found" / "Showing X of Y deals"

**Filter Labels:**
- Geography: "Location"
- Industry: "Sector"
- Price Range: "Asking Price"
- Business Size: "Company Size"
- Business Model: "Type"
- Deal Type: "Acquisition Type"
- Seller Motivation: "Seller Type"

**Deal Card Copy:**
- Price: "Asking: €X.XM"
- Revenue: "Revenue: €X.XM/year"
- Location: "📍 City, Country"
- EBITDA: "EBITDA: XX%"
- Save: "Save" / "Saved"
- View: "View Details →"

**Empty States:**
- No Results: "No deals match your filters. Try broadening your search."
- Loading: "Loading deals..."
- Error: "Unable to load deals. Please refresh."
- End of Results: "You've viewed all available deals."

**Tooltips:**
- Save: "Save this deal to your shortlist"
- EBITDA: "Earnings Before Interest, Taxes, Depreciation, and Amortization"
- New: "Listed in the last 7 days"
- Best Match: "Sorted by relevance to your acquisition criteria"

---

## States

### 1. Default State (Results Found)
- Shows filtered/sorted deals
- Active filters highlighted
- Save buttons visible
- Pagination/load more active

### 2. Loading State
- Skeleton cards (3-6 visible)
- Filters disabled temporarily
- "Loading deals..." message
- Progress bar if > 2 seconds

### 3. No Results State
- Empty state illustration
- Clear message about filters
- Suggestions to broaden search
- CTA to adjust filters or set alert

### 4. Error State
- Error message with context
- Retry button
- Contact support link
- Preserve filter state for retry

### 5. Partial Results
- Show available deals
- Warning: "Some deals couldn't be loaded"
- Option to retry failed loads

---

## Edge Cases

### Too Many Filters Applied
- Warning when >10 filters active
- Suggest saving as filter set
- Performance optimization: Progressive filtering

### Conflicting Filters
- Detect impossible combinations
- Warning: "No deals can match these filters"
- Highlight conflicting filters

### Saved Deal Limit (Future)
- If limit exists (e.g., 50 saved)
- Warning near limit: "45/50 saved"
- At limit: "Remove saved deals to add more"

### Rapid Filter Changes
- Debounce requests (500ms)
- Cancel pending requests
- Show loading state appropriately

### Network Issues
- Cache previous results
- Show stale data with warning
- Background refresh when connection returns

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through filters and cards
  - Space to toggle checkboxes
  - Arrow keys for sliders
  - Enter to view deal details

- **Screen Reader:**
  - Announce filter changes
  - Read result count updates
  - Describe deal card contents
  - Announce save state changes

- **Focus Management:**
  - Focus trap in filter modal (mobile)
  - Return focus after actions
  - Skip to content link

- **ARIA:**
  - `role="search"` on filter section
  - `aria-label` on all controls
  - `aria-live="polite"` for result count
  - `aria-busy` during loading

---

## Analytics

**Events:**
1. "deal_browse_viewed" (initial_count)
2. "deal_browse_filter_applied" (filter_type, filter_value)
3. "deal_browse_filter_cleared" (all | specific)
4. "deal_browse_sorted" (sort_type)
5. "deal_browse_view_changed" (grid | list)
6. "deal_browse_card_clicked" (deal_id, position)
7. "deal_browse_saved" (deal_id)
8. "deal_browse_load_more" (page_number)
9. "deal_browse_filter_saved" (filter_name)

**Metrics:**
- Average filters applied per session
- Most used filter combinations
- Click-through rate to deal details
- Save rate per session
- Scroll depth / pages loaded
- Time to first interaction
- Filter → result conversion rate

---

## Technical Notes

### API Endpoints

**Get Deals:** `GET /api/deals`

**Query Parameters:**
```
?geography[]=FR&geography[]=BE
&industry[]=healthcare&industry[]=tech
&price_min=1000000&price_max=3000000
&revenue_min=500000
&sort=newest
&page=1
&limit=12
```

**Response:**
```json
{
  "deals": [
    {
      "id": "deal-123",
      "anonymizedName": "Established Healthcare Practice",
      "industry": "Healthcare",
      "location": {
        "city": "Lyon",
        "country": "France"
      },
      "metrics": {
        "askingPrice": 2500000,
        "annualRevenue": 3200000,
        "ebitdaMargin": 0.22,
        "employees": 35,
        "yearFounded": 2003
      },
      "description": "Well-established healthcare practice with strong local presence...",
      "highlights": [
        "20+ years of operation",
        "Loyal customer base",
        "Strong cash flow"
      ],
      "tags": ["Recurring Revenue", "Growth Potential"],
      "isNew": true,
      "isSaved": false,
      "createdAt": "2024-11-10T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 48,
    "page": 1,
    "limit": 12,
    "hasMore": true
  },
  "filters": {
    "available": {
      "geography": [
        {"value": "FR", "label": "France", "count": 12},
        {"value": "BE", "label": "Belgium", "count": 8}
      ],
      "industry": [
        {"value": "healthcare", "label": "Healthcare", "count": 15},
        {"value": "tech", "label": "Technology", "count": 10}
      ]
    }
  }
}
```

**Save Deal:** `POST /api/deals/{id}/save`
**Unsave Deal:** `DELETE /api/deals/{id}/save`

### Performance
- Implement virtual scrolling for large lists
- Lazy load images
- Cache filter results (5 min TTL)
- Debounce filter requests (500ms)
- Preload next page on scroll

### Security
- Validate all filter inputs
- Sanitize search queries
- Rate limit API requests (100/min)
- Only show deals user has access to

---

## Design System References

**Components:** Card, Checkbox, Slider, Dropdown, Button, Badge, Empty State
**Colors:** Primary `#2D65F8`, Success `#10B981` (saved), Neutral `#6B7280`
**Typography:** H1 32px Bold, H3 18px Semibold (card titles), Body 14px
**Spacing:** Card gap 20px, Filter groups 32px apart
**Card Shadow:** 0 1px 3px rgba(0,0,0,0.1), hover: 0 4px 6px rgba(0,0,0,0.1)

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*