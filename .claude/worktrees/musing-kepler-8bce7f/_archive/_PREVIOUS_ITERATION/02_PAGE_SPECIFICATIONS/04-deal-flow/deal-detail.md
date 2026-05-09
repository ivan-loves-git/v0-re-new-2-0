# Page Specification: Deal Detail

**Route:** `/deal-flow/deal/{id}`
**Section:** Deal Flow
**Authentication Required:** Yes (Professional/Enterprise only)

---

## Purpose

Comprehensive view of an individual acquisition opportunity, presenting all available information about the business, financials, operations, and seller to help users evaluate the opportunity and decide whether to pursue it.

---

## Layout Structure

**Layout Type:** Single column with sticky action bar

```
┌─────────────────────────────────────┐
│ ← Back to Browse                    │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Established Healthcare Practice  ││
│ │ Lyon, France • Healthcare        ││
│ │                                  ││
│ │ ⭐ Save   📊 Add to Pipeline     ││
│ │ 📄 Request Info  📅 Book Call    ││
│ └─────────────────────────────────┘│
│                                     │
│ [Overview][Financials][Operations]  │
│ [Market][Seller][Documents]         │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Overview                         ││
│ │                                  ││
│ │ Key Metrics                      ││
│ │ • Asking Price: €2.5M            ││
│ │ • Revenue: €3.2M                 ││
│ │ • EBITDA: €704K (22%)            ││
│ │ • Employees: 35                  ││
│ │                                  ││
│ │ Business Description              ││
│ │ [Full description text...]        ││
│ │                                  ││
│ │ Investment Highlights             ││
│ │ ✓ 20+ years of operation         ││
│ │ ✓ Strong local reputation        ││
│ │ ✓ Recurring revenue model        ││
│ └─────────────────────────────────┘│
│                                     │
│ [Similar Deals] [Recently Viewed]   │
└─────────────────────────────────────┘
```

---

## Key Components

### Header Section
- **Back Navigation:** "← Back to Browse" (preserves filters)
- **Business Title:** Anonymized name
- **Location Badge:** City, Country with flag
- **Industry Badge:** Primary industry/sector
- **Status Indicators:**
  - "New" badge if < 7 days
  - "Updated" if info changed < 3 days
  - View count (e.g., "23 views this week")

### Action Bar (Sticky)
**Primary Actions:**
1. **Save/Unsave:** Star icon toggle
2. **Add to Pipeline:** Opens modal to select stage
3. **Request Information:** Opens NDA/info request modal
4. **Book Consultation:** Schedule advisory call

**Secondary Actions (dropdown):**
- Share Deal (generate link)
- Download Summary (PDF)
- Report Issue
- Not Interested (hide from browse)

### Tab Navigation
Horizontal tabs for content sections:
1. **Overview** (default)
2. **Financials**
3. **Operations**
4. **Market & Competition**
5. **Seller Information**
6. **Documents** (locked until NDA signed)

### Content Sections

#### 1. Overview Tab
**Key Metrics Grid:**
- Asking Price
- Annual Revenue
- EBITDA & Margin
- Employee Count
- Years Operating
- Customer Count
- Transaction Type
- Ideal Buyer Profile

**Business Description:**
- 3-5 paragraph detailed description
- What the business does
- Products/services offered
- Unique value proposition
- Competitive advantages

**Investment Highlights:**
- 5-8 bullet points
- Key selling points
- Growth opportunities
- Competitive moat
- Strategic value

**Deal Structure:**
- Asset vs. Share sale
- Included in sale (assets, IP, inventory)
- Not included (real estate, vehicles)
- Transition support offered
- Financing available

#### 2. Financials Tab
**Revenue Chart:**
- 3-5 year trend line/bar chart
- YoY growth percentages
- Revenue breakdown by segment

**Profitability Metrics:**
- Gross Margin trend
- EBITDA trend
- Net Income trend
- Cash Flow summary

**Financial Highlights:**
- Revenue concentration
- Recurring vs. one-time revenue
- Customer retention rate
- Average transaction value
- Payment terms

**Financial Tables:**
- P&L Summary (3 years)
- Balance Sheet highlights
- Key ratios comparison

**Projections:**
- Next year forecast
- Growth assumptions
- Investment requirements

#### 3. Operations Tab
**Business Model:**
- B2B/B2C/Both
- Revenue model (subscription, project, etc.)
- Sales cycle length
- Customer acquisition cost

**Operations Overview:**
- Location(s) and facilities
- Equipment and assets
- Technology stack
- Supplier relationships
- Key partnerships

**Team & Organization:**
- Organization chart
- Key personnel (anonymized)
- Management staying/leaving
- Training requirements
- Culture description

**Processes:**
- Key business processes
- Automation level
- Quality certifications
- Operational challenges

#### 4. Market & Competition Tab
**Market Analysis:**
- Market size and growth
- Target customer segments
- Geographic coverage
- Market trends

**Competitive Landscape:**
- Main competitors (anonymized)
- Market position
- Competitive advantages
- Differentiation factors
- Barriers to entry

**Growth Opportunities:**
- Expansion possibilities
- New product/service potential
- Market penetration strategies
- Cost optimization areas

#### 5. Seller Information Tab
**Seller Profile:**
- Type (Individual, Company, Fund)
- Reason for selling
- Timeline expectations
- Involvement post-sale

**Transaction Preferences:**
- Preferred buyer type
- Deal structure flexibility
- Financing options
- Due diligence requirements
- Non-negotiables

**Transition Support:**
- Training period offered
- Consulting availability
- Knowledge transfer plan
- Customer introduction support

#### 6. Documents Tab (Requires NDA)
**Available Documents:**
- Financial statements (3 years)
- Tax returns
- Customer lists (anonymized)
- Contracts samples
- Asset listings
- Legal documents

**NDA Required Banner:**
- "Sign NDA to access confidential documents"
- CTA: "Request Access"
- Expected response time

**Document List (post-NDA):**
- Document name
- Type (PDF, Excel, etc.)
- Size
- Last updated
- Download button

### Bottom Section
**Similar Deals:**
- 3-4 deal cards
- Same industry/size/geography
- "View All Similar" link

**Recently Viewed:**
- Last 3 deals viewed
- Quick comparison link

---

## Interactive Elements

### Actions
1. **Save/Unsave:**
   - Toggle star filled/empty
   - Toast: "Deal saved to shortlist"
   - Updates saved count

2. **Add to Pipeline:**
   - Opens modal
   - Select pipeline stage
   - Add notes
   - Confirm addition

3. **Request Information:**
   - Opens modal
   - Choose info type needed
   - Sign NDA if required
   - Submit request

4. **Book Consultation:**
   - Opens calendar modal
   - Select time slot
   - Add discussion topics
   - Confirm booking

### Navigation
1. **Tabs:**
   - Click to switch sections
   - URL updates (hash)
   - Smooth scroll on mobile
   - Active tab highlighted

2. **Back Button:**
   - Returns to browse
   - Preserves filters and position
   - Alternative: Breadcrumb navigation

### Content Interactions
1. **Expand/Collapse:**
   - Long descriptions truncated
   - "Read more" link
   - Smooth expansion

2. **Charts:**
   - Hover for details
   - Toggle data series
   - Zoom capability

3. **Download:**
   - Summary PDF
   - Financial exports (CSV)
   - Requires tier access

---

## Navigation

### FROM
- Browse Deals (`/deal-flow/browse`)
- Saved Deals (`/deal-flow/saved`)
- Pipeline (`/deal-flow/pipeline`)
- Email notification links
- Similar deals on other detail pages

### TO
- Browse Deals (`/deal-flow/browse`) - Back button
- Pipeline (`/deal-flow/pipeline`) - After adding
- NDA Signing (`/deal-flow/nda-signing`) - Modal
- Consultation Booking (`/discovery/consultation`)
- Similar deal detail pages

---

## Content

### Key Messages

**Header:**
- Title: [Anonymized Business Name]
- Subtitle: "Investment Opportunity in [Industry]"

**CTAs:**
- "Save Deal"
- "Add to Pipeline"
- "Request Information"
- "Book Advisory Call"
- "Sign NDA for Full Access"

**Section Headers:**
- "Overview"
- "Financial Performance"
- "Operations & Management"
- "Market & Competition"
- "Seller Information"
- "Confidential Documents"

**Key Metrics Labels:**
- "Asking Price: €X.XM"
- "Annual Revenue: €X.XM"
- "EBITDA Margin: XX%"
- "Employees: XX"
- "Founded: XXXX"
- "Customers: X,XXX"

**Investment Highlights:**
Example bullets:
- "Established 20+ year track record"
- "40% recurring revenue base"
- "Strong local market position"
- "Experienced management team willing to stay"
- "Multiple growth opportunities identified"

**Empty States:**
- No financials: "Detailed financials available after NDA"
- No documents: "Documents will be available after signing NDA"
- No similar deals: "No similar opportunities currently available"

**Access Messages:**
- Locked content: "Sign NDA to view confidential information"
- Tier restriction: "Upgrade to Professional to access this deal"

---

## States

### 1. Default (Full Access)
- All tabs visible and accessible
- Actions enabled
- Documents require NDA

### 2. Loading
- Skeleton layout
- Tabs disabled
- "Loading deal information..."

### 3. NDA Pending
- Overview visible
- Other tabs show preview only
- Banner: "NDA signature required for full access"
- CTA: "Sign NDA"

### 4. NDA Signed
- All content unlocked
- Documents downloadable
- Contact information visible

### 5. Deal Unavailable
- Deal sold/removed
- Message: "This opportunity is no longer available"
- Suggest similar deals
- Return to browse option

### 6. Already in Pipeline
- "Added to Pipeline" indicator
- Show current stage
- "Manage in Pipeline" link

### 7. Error State
- "Unable to load deal details"
- Retry button
- Contact support

---

## Edge Cases

### Incomplete Information
- Some fields may be empty
- Show: "Information not provided"
- Don't hide sections, show what's available

### Multiple NDAs
- Different levels of access
- Basic NDA vs. Full NDA
- Progressive information reveal

### Conflicting User Interest
- User marks "Not Interested"
- Confirmation: "Are you sure?"
- Hide from browse results
- Can be undone in settings

### Deal Updates
- Show "Updated" badge
- Notification if saved
- Highlight what changed

### Seller Withdraws Deal
- Notification to saved users
- Mark as "No Longer Available"
- Suggest alternatives

### High Interest Deal
- Show view count/interest level
- "High Interest" badge
- Urgency messaging

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through all actions
  - Arrow keys between tabs
  - Escape closes modals
  - Enter activates buttons

- **Screen Reader:**
  - Announce tab changes
  - Read all metrics
  - Describe charts/graphs
  - Alert for locked content

- **Visual:**
  - High contrast mode support
  - Focus indicators
  - Colorblind-safe charts

- **ARIA:**
  - `role="tablist"` and `role="tab"`
  - `aria-selected` on active tab
  - `aria-label` on icons
  - `aria-describedby` for complex elements

---

## Analytics

**Events:**
1. "deal_detail_viewed" (deal_id, source)
2. "deal_detail_tab_clicked" (tab_name)
3. "deal_detail_saved" (deal_id)
4. "deal_detail_pipeline_added" (deal_id, stage)
5. "deal_detail_info_requested" (deal_id, info_type)
6. "deal_detail_consultation_booked" (deal_id)
7. "deal_detail_nda_initiated" (deal_id)
8. "deal_detail_document_downloaded" (deal_id, document_type)
9. "deal_detail_similar_clicked" (from_deal_id, to_deal_id)
10. "deal_detail_share" (deal_id, method)

**Metrics:**
- Time spent on page
- Tab engagement rates
- Save to view ratio
- Pipeline add rate
- NDA conversion rate
- Document download rate
- Bounce rate
- Similar deal click-through

---

## Technical Notes

### API Endpoints

**Get Deal Details:** `GET /api/deals/{id}`

**Response:**
```json
{
  "deal": {
    "id": "deal-123",
    "status": "active",
    "anonymizedName": "Established Healthcare Practice",
    "location": {
      "city": "Lyon",
      "country": "France",
      "region": "Auvergne-Rhône-Alpes"
    },
    "industry": {
      "primary": "Healthcare",
      "secondary": ["Medical Services", "Specialty Care"]
    },
    "metrics": {
      "askingPrice": 2500000,
      "annualRevenue": 3200000,
      "ebitda": 704000,
      "ebitdaMargin": 0.22,
      "employees": 35,
      "yearFounded": 2003,
      "customers": 2500
    },
    "description": {
      "business": "Full business description...",
      "products": "Products and services...",
      "advantages": "Competitive advantages..."
    },
    "highlights": [
      "20+ years of successful operation",
      "Strong recurring revenue base",
      "Experienced team willing to stay"
    ],
    "financials": {
      "revenueHistory": [
        {"year": 2021, "amount": 2800000},
        {"year": 2022, "amount": 3000000},
        {"year": 2023, "amount": 3200000}
      ],
      "profitability": {
        "grossMargin": 0.65,
        "netMargin": 0.15
      }
    },
    "seller": {
      "type": "individual",
      "motivation": "retirement",
      "timeline": "6-12 months",
      "transition": "3-6 months support"
    },
    "documents": {
      "available": 12,
      "requiresNda": true,
      "ndaSigned": false
    },
    "metadata": {
      "views": 234,
      "viewsThisWeek": 23,
      "savedCount": 18,
      "isNew": false,
      "lastUpdated": "2024-11-10T10:00:00Z",
      "createdAt": "2024-11-01T10:00:00Z"
    }
  },
  "userAccess": {
    "hasAccess": true,
    "ndaSigned": false,
    "isSaved": false,
    "inPipeline": false,
    "pipelineStage": null
  },
  "similarDeals": [
    {
      "id": "deal-456",
      "anonymizedName": "Regional Medical Center",
      "location": "Marseille, France",
      "askingPrice": 2800000
    }
  ]
}
```

**Request Information:** `POST /api/deals/{id}/request-info`
```json
{
  "infoType": "detailed_financials",
  "message": "Interested in reviewing detailed financials"
}
```

**Add to Pipeline:** `POST /api/deals/{id}/pipeline`
```json
{
  "stage": "initial_review",
  "notes": "Interesting opportunity, matches criteria well"
}
```

### Performance
- Lazy load heavy content (charts, documents)
- Cache deal data (5 min)
- Prefetch similar deals
- Progressive image loading
- Virtualize document lists

### Security
- Validate deal access permissions
- Enforce NDA requirements
- Audit document downloads
- Rate limit API calls
- Sanitize seller information based on NDA status

---

## Design System References

**Components:** Tabs, Card, Button, Badge, Chart, Modal, Toast
**Colors:** Primary `#2D65F8`, Success `#10B981`, Warning `#F59E0B`
**Typography:** H1 32px Bold, H2 24px Semibold, Body 16px Regular
**Spacing:** Section padding 32px, Component gap 24px
**Sticky Bar:** Background white, shadow 0 2px 4px rgba(0,0,0,0.1)

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*