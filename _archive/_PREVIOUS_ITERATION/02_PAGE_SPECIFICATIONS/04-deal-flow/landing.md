# Page Specification: Deal Flow Landing

**Route:** `/deal-flow`
**Section:** Deal Flow
**Authentication Required:** Yes

---

## Purpose

Gateway page to the deal flow section that introduces the deal marketplace, displays user's matching criteria, and provides quick access to deals, saved opportunities, and pipeline management.

---

## Layout Structure

Hero section with criteria summary and three main action cards

```
┌─────────────────────────────────────┐
│  Deal Flow                          │
│  ─────────────────────────────────  │
│                                     │
│  Find Your Next Acquisition         │
│  Based on your criteria:            │
│  🗺️ France • 🏭 Healthcare •       │
│  💰 €1-3M                           │
│                                     │
│  ┌────────┬────────┬────────┐      │
│  │Browse  │ Saved  │Pipeline│      │
│  │Deals   │ (12)   │ (5)    │      │
│  │        │        │        │      │
│  │[View→] │[View→] │[View→] │      │
│  └────────┴────────┴────────┘      │
│                                     │
│  Recent Matches (3 new deals)       │
│  ┌──────────────────────────┐      │
│  │ Deal Card 1              │      │
│  │ Healthcare • €2.5M       │      │
│  └──────────────────────────┘      │
│                                     │
│  [Edit Your Criteria]               │
└─────────────────────────────────────┘
```

---

## Key Components

### Hero Section
- **Headline:** "Find Your Next Acquisition"
- **Criteria Summary Badge:** Visual display of user's acquisition criteria
  - Geography icon + primary location
  - Industry icon + preferred industries (max 3 shown)
  - Price range icon + budget
- **Edit Criteria Link:** Navigate to Lead de Cadrage to modify

### Quick Access Cards (3 Cards)

**1. Browse Deals Card**
- Icon: 🔍
- Title: "Browse Deals"
- Description: "Explore all available opportunities"
- Stat: Total available deals count (e.g., "48 deals")
- CTA: "View All Deals →"
- Badge: "3 new" (if new matches since last visit)

**2. Saved Deals Card**
- Icon: ⭐
- Title: "Saved Deals"
- Description: "Your bookmarked opportunities"
- Stat: Count of saved deals (e.g., "12 saved")
- CTA: "View Saved →"
- Empty state: "No saved deals yet"

**3. Pipeline Card**
- Icon: 📊
- Title: "Your Pipeline"
- Description: "Track active deal processes"
- Stat: Count of deals in pipeline (e.g., "5 active")
- Stage breakdown: "2 Due Diligence, 3 Negotiation"
- CTA: "Manage Pipeline →"
- Empty state: "No deals in pipeline"

### Recent Matches Section
**"Recent Matches" (Max 3 Deal Cards)**
- Show newest deals matching user's criteria
- Deal cards (compact version):
  - Deal title (business name anonymized: "Established Healthcare Practice")
  - Location (city/region)
  - Industry badge
  - Price: €X.XM
  - Revenue: €X.XM
  - Key highlights (1-2 bullets)
  - "New" badge (if < 7 days old)
  - CTA: "View Details →"
- If no matches: Empty state with message

### Access Control Banner
**Professional/Enterprise Feature:**
- If user is on Starter tier (no deal flow access):
  - Show banner: "Upgrade to Professional to browse deals"
  - CTA: "View Plans →"
  - Lock icon on Browse/Saved/Pipeline cards
  - Recent Matches section hidden

### Empty States

**No Criteria Built Yet:**
- Banner: "Build your acquisition criteria to see matching deals"
- CTA: "Build Criteria →"
- All cards show locked/disabled state

**No Matches Found:**
- Banner: "No deals currently match your criteria"
- Suggestions:
  - "Broaden your search criteria"
  - "Set up deal alerts for new matches"
- CTA: "Edit Criteria" / "Set Alert"

---

## Interactive Elements

1. **Criteria Summary Badge:**
   - Hover → tooltip with full criteria details
   - Click → navigate to Lead de Cadrage (edit mode)

2. **Quick Access Cards:**
   - Hover → subtle elevation
   - Click anywhere on card → navigate to destination
   - Stats update in real-time

3. **Recent Match Cards:**
   - Hover → highlight
   - Click card → navigate to deal detail page
   - Bookmark icon (toggle saved status)

4. **Edit Criteria Link:**
   - Opens Lead de Cadrage in edit mode
   - Returns to deal flow after save

5. **Upgrade Banner (Starter Tier):**
   - Click "View Plans" → navigate to subscription page
   - Dismiss button (X) → hides for session

---

## Navigation

### FROM
- Main navigation sidebar - "Deal Flow" item
- Dashboard home (`/dashboard`) - "Explore Deals" widget
- Discovery Hub (`/discovery`) - After completing Lead de Cadrage
- Readiness Results (`/discovery/results`) - "View Deals" CTA (with upgrade prompt)

### TO
- Browse Deals (`/deal-flow/browse`) - "Browse Deals" card
- Saved Deals (`/deal-flow/saved`) - "Saved Deals" card
- Pipeline (`/deal-flow/pipeline`) - "Your Pipeline" card
- Deal Detail (`/deal-flow/deal-detail/{id}`) - Click any deal card
- Lead de Cadrage (`/discovery/lead-de-cadrage`) - "Edit Criteria" link
- Subscription (`/settings/subscription`) - "Upgrade" CTA

---

## Content

**Page Header:**
- **Headline:** "Find Your Next Acquisition"
- **Subheadline:** "Based on your criteria: [criteria summary]"

**Quick Access Card Copy:**

**Browse Deals:**
- Title: "Browse Deals"
- Description: "Explore all available opportunities matching your criteria"

**Saved Deals:**
- Title: "Saved Deals"
- Description: "Review and compare your bookmarked opportunities"
- Empty: "Save deals while browsing to build your shortlist"

**Pipeline:**
- Title: "Your Pipeline"
- Description: "Track deals through your acquisition process"
- Empty: "Add deals to your pipeline to organize your search"

**Recent Matches Section:**
- **Headline:** "Recent Matches"
- **Subheadline:** "New deals matching your criteria"
- **Empty State:** "No new matches yet. We'll notify you when deals matching your criteria become available."
- **Set Alert CTA:** "Create Deal Alert"

**Access Control Messages:**

**Starter Tier (No Access):**
- Banner: "Upgrade to Professional for full deal flow access"
- Message: "Professional plan includes unlimited deal browsing, saved deals, and pipeline management."
- CTA: "View Plans →" or "Upgrade Now"

**No Criteria:**
- Banner: "Complete your acquisition criteria to see matching deals"
- Message: "Building your criteria helps us match you with the right opportunities."
- CTA: "Build Criteria →"

**No Matches:**
- Message: "No deals currently match your exact criteria."
- Suggestions:
  - "Try broadening your geographic or industry preferences"
  - "Adjust your price range or business size parameters"
  - "Set up an alert to be notified of new matches"
- CTAs: "Edit Criteria" / "Set Alert"

---

## States

### 1. Initial Load (Criteria Complete, Professional Tier)
- Show hero with criteria summary
- Display 3 quick access cards with real counts
- Show up to 3 recent matching deals
- All interactive elements enabled

### 2. Starter Tier (No Deal Flow Access)
- Show upgrade banner at top
- Quick access cards visible but locked (overlay with lock icon)
- CTA on cards redirects to subscription page
- Recent Matches section hidden or blurred with upgrade prompt
- "Upgrade to view deals" message

### 3. No Criteria Built Yet
- Banner: "Build your acquisition criteria first"
- Quick access cards disabled/grayed
- Recent Matches section hidden
- Prominent CTA: "Build Criteria Now →"

### 4. Criteria Complete, No Matches
- Show criteria summary
- Quick access cards: Browse (empty), Saved (empty), Pipeline (empty)
- Recent Matches: Empty state message
- Suggestions to broaden criteria or set alert
- CTA: "Edit Criteria" / "Set Deal Alert"

### 5. Loading
- Skeleton loaders for cards
- "Loading your deals..." message
- Brief (1-2 seconds)

### 6. Error State
- Error message: "Unable to load deal flow. Please try again."
- Retry button
- Support link if persists

---

## Edge Cases

### Criteria Incomplete
- User completed some sections of Lead de Cadrage but not all
- Show: "Complete your criteria to see matches (5/7 sections done)"
- CTA: "Finish Building Criteria →"

### New User First Visit
- Highlight flow: "Start here → Build criteria → Browse deals"
- Optional: Brief tooltip tour of 3 cards
- Welcome message: "Welcome to Deal Flow! Let's find your acquisition."

### No New Matches Since Last Visit
- Recent Matches shows previously viewed deals
- Label: "Recently Viewed" instead of "Recent Matches"
- Encourage: "Check back regularly or set up alerts"

### High Volume of Matches
- Recent Matches shows 3 most recent
- Badge: "+12 more matching deals" → click to browse
- Sort by: Newest first

### Pipeline Full (Future Limit)
- If pipeline has limit (e.g., 10 deals), show warning near full
- Message: "Pipeline nearly full (9/10). Archive deals to add more."

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through cards and CTAs
  - Enter to navigate
  - Arrow keys to navigate between cards

- **Screen Reader:**
  - Announce criteria summary
  - Read card titles, descriptions, stats
  - Announce "locked" state for Starter tier
  - Describe deal card contents

- **Color Contrast:** 4.5:1 minimum

- **ARIA:**
  - `role="region"` on quick access section with `aria-label="Quick access to deal flow sections"`
  - `role="list"` on recent matches
  - `role="listitem"` on each deal card
  - `aria-label` on icon-only buttons
  - `aria-disabled="true"` on locked cards

---

## Analytics

**Events:**
1. "deal_flow_landing_viewed" (tier, has_criteria)
2. "deal_flow_quick_access_clicked" (destination: browse | saved | pipeline)
3. "deal_flow_recent_match_clicked" (deal_id)
4. "deal_flow_edit_criteria_clicked"
5. "deal_flow_upgrade_prompt_viewed" (tier: starter)
6. "deal_flow_upgrade_clicked" (source: banner | card)
7. "deal_flow_set_alert_clicked"

**Metrics to Track:**
- % of users with criteria complete
- % of users with tier access
- Click-through rate: landing → browse/saved/pipeline
- Click-through rate: recent match → deal detail
- Upgrade conversion from landing page
- Time spent on landing page

---

## Technical Notes

**API Endpoint:** `GET /api/deal-flow/landing`

**Response (200):**
```json
{
  "user": {
    "tier": "professional",
    "hasAccess": true,
    "criteriaComplete": true,
    "criteriaSummary": {
      "geography": "France",
      "industries": ["Healthcare", "Professional Services"],
      "priceRange": "€1-3M"
    }
  },
  "stats": {
    "totalAvailable": 48,
    "newMatches": 3,
    "saved": 12,
    "pipeline": 5,
    "pipelineBreakdown": {
      "initial_review": 0,
      "due_diligence": 2,
      "negotiation": 3,
      "closing": 0
    }
  },
  "recentMatches": [
    {
      "id": "deal-123",
      "anonymizedName": "Established Healthcare Practice",
      "location": "Lyon, France",
      "industry": "Healthcare",
      "price": 2500000,
      "revenue": 3200000,
      "highlights": ["20+ years operating", "Strong client base"],
      "isNew": true,
      "daysOld": 2,
      "isSaved": false
    }
  ]
}
```

**Access Control Logic:**
- Starter tier: Block access, show upgrade prompt
- Professional/Enterprise: Full access
- Criteria incomplete: Redirect to Lead de Cadrage with return URL

---

## Design System References

**Components:** Card, Badge, Button, Empty State, Banner
**Colors:** Primary `#2D65F8`, Warning `#F59E0B` (new badge), Neutral `#6B7280` (empty states)
**Typography:** H1 36px Bold (headline), H3 20px Bold (card titles), Body 16px Regular
**Spacing:** Card grid gap 24px, section padding 48px
**Card:** Border-radius 12px, shadow on hover, padding 24px

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
