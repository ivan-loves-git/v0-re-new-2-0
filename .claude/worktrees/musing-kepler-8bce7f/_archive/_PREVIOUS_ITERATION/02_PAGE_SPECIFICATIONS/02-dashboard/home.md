# Page Specification: Dashboard Home

**Route:** `/dashboard`
**Section:** Dashboard
**Authentication Required:** Yes

---

## Purpose

Provide overview of user's acquisition journey, quick stats, recent activity, and recommended next actions.

---

## Layout Structure

Standard app layout with widget grid

```
┌────────────────────────────────────────────┐
│ [Top Bar: Search, Notifications, Avatar]  │
├──────┬─────────────────────────────────────┤
│ Left │  Main Content Area                  │
│ Nav  │  ┌──────────────────────────────┐   │
│ Bar  │  │ Journey Progress Widget      │   │
│      │  └──────────────────────────────┘   │
│      │  ┌────┬────┬────┐                   │
│      │  │Stat│Stat│Stat│ (Quick Stats)     │
│      │  └────┴────┴────┘                   │
│      │  ┌────────┬────────┐                │
│      │  │Actions │Activity│                │
│      │  └────────┴────────┘                │
│      │  [More widgets...]                  │
└──────┴─────────────────────────────────────┘
```

---

## Key Components

### Top Bar
- Global search bar
- Notification bell (with unread badge)
- Subscription status badge ("Free" / "Premium")
- User avatar → dropdown menu

### Left Sidebar
- Renew logo
- Dashboard (active/highlighted)
- Discovery, Deal Flow, Acquisition, Post-Acq, Exit, Network, Resources, Settings
- Collapse/expand toggle

### Main Content - Widget Grid

**1. Journey Progress Widget** (full width):
- Visual timeline: Discovery → Acquisition → Post-Acq → Exit
- Current phase highlighted
- Progress % within phase
- Completion badges for finished phases

**2. Quick Stats Cards** (3 cards in row):
- Deals Saved (number + icon)
- Deals in Pipeline (number + icon)
- Network Connections (number + icon)

**3. Recommended Actions Card**:
- "What to do next" headline
- 3-5 action items with checkboxes:
  - "Complete readiness assessment"
  - "Browse new deals (X matching)"
  - "Book your first coaching session"
- Each action links to relevant page

**4. Recent Activity Feed**:
- Chronological list:
  - "You saved [Deal Name]" (timestamp)
  - "New deal matching: [Deal Name]"
  - "Session scheduled: [Date]"
- "View all activity" link

**5. Upcoming Events/Sessions**:
- Calendar icon
- Next 3 upcoming items:
  - Coaching sessions
  - Webinars
  - Peer meetings
- "View calendar" link

**6. Deal Flow Snapshot** (premium):
- "New deals this week" headline
- 2-3 mini deal cards with match score
- "View all deals" button

**7. Learning Progress** (if active):
- Progress bar: course completion
- "Continue learning" button

### Hotline Widget (bottom-right, persistent):
- Floating button with chat icon
- Expands: "Send message", "Schedule call", "Emergency support"

---

## Interactive Elements

1. **Widget Navigation:** Click any widget to go to relevant section
2. **Action Items:** Check off completed tasks (saves progress)
3. **Deal Cards:** Hover shows quick actions (View, Save)
4. **Notifications:** Click bell to see all notifications
5. **User Menu:** Click avatar for Profile, Settings, Logout
6. **Sidebar:** Collapse/expand, navigate to sections
7. **Hotline:** Expand/collapse chat widget

---

## Navigation

### FROM
- Login (automatic redirect)
- Any other page (clicking "Dashboard" in sidebar)
- Browser bookmark/direct URL

### TO
- Any section via sidebar nav
- Specific pages via widget links (deal detail, coaching booking, etc.)
- Settings via user menu

---

## Content

### Page Title
"Welcome back, [FirstName]!"

### Context Subheadline (varies by phase):
- Discovery: "Let's find your perfect acquisition opportunity"
- Acquisition: "You have [X] active deals in your pipeline"
- Post-Acquisition: "Your business is performing [well/needs attention]"
- Exit: "Planning your next chapter"

### Quick Stats Labels
- "Deals Saved"
- "Active Pipeline"
- "Network Connections"

### Recommended Actions (examples)
- "Complete your readiness assessment" (if not done)
- "X new deals match your criteria - browse now"
- "Book your first coaching session"
- "Join the community forum"
- "Complete your profile"

### Empty States
- No saved deals: "Start browsing deals to see your favorites here"
- No upcoming events: "Check out upcoming webinars and workshops"
- No activity: "Your activity will appear here as you use Renew"

---

## States

### 1. Loading
- Skeleton screens for each widget
- Shimmer effect while data loads

### 2. Default (Populated)
- All widgets showing user data
- Real numbers and content

### 3. Empty State (New User)
- Widgets show empty states with CTAs
- Prominent "Get Started" guidance
- Tour/onboarding prompt (if not completed)

### 4. Premium Gate (Free User)
- Deal Flow Snapshot blurred/locked
- "Upgrade to Premium" overlay
- Click opens upgrade modal

### 5. Error State
- If widget fails to load: "Unable to load [Widget Name]"
- "Retry" button
- Rest of dashboard still functional

---

## Edge Cases

- **No onboarding completed:** Prominent banner "Complete setup to get personalized recommendations"
- **No Lead de Cadrage:** Can't show deal matches, prompt to complete
- **Subscription expired:** Banner at top "Your subscription has expired. Renew now to continue."
- **Slow network:** Progressive loading (stats first, then activity feed, then recommendations)

---

## Accessibility

- Keyboard navigation: Tab through widgets
- Skip links to main content sections
- Screen reader announces widget types
- High contrast for stats and numbers
- Focus indicators on interactive elements

**ARIA:**
- `role="main"` on content area
- `role="navigation"` on sidebar
- `role="complementary"` on widgets
- `aria-label` for icon-only buttons

---

## Analytics

**Events:**
1. "dashboard_viewed"
2. "dashboard_widget_clicked" (widget_name)
3. "dashboard_action_completed" (action_name)
4. "dashboard_deal_clicked" (deal_id)
5. "dashboard_upgrade_clicked"
6. "dashboard_hotline_opened"
7. "sidebar_nav_clicked" (destination)

**Key Metrics:**
- Time on dashboard
- Widget engagement rate
- Action completion rate
- Navigation patterns

---

## Technical Notes

**API Endpoints:**

`GET /api/dashboard/overview`
```json
{
  "user": {...},
  "journey_phase": "discovery",
  "stats": {
    "deals_saved": 5,
    "pipeline_count": 2,
    "connections": 12
  },
  "recommended_actions": [...],
  "recent_activity": [...],
  "upcoming_events": [...]
}
```

**Caching:**
- Cache dashboard data for 5 minutes
- Refresh on user action (save deal, complete task)
- Background refresh every 15 minutes

**Performance:**
- Load critical widgets first (journey, stats)
- Lazy load activity feed and recommendations
- Optimize images (deal thumbnails <50KB)

---

## Design System References

**Components:** Widget Cards, Progress Bar, Icon Badges, Button (Primary/Secondary)
**Colors:** Primary `#2D65F8`, Success `#10B981`, Gray backgrounds `#F9FAFB`
**Typography:** H1 36px Bold, H4 20px Semibold, Body 14px
**Spacing:** Widget gaps 20px, internal padding 20-24px
**Layout:** 3-4 column responsive grid

---

*Version: 1.0 | Updated: 2025-11-11 | Status: Ready for Development*
