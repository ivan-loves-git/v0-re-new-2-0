# Renew Dashboard - Information Architecture

> Complete navigation structure and hierarchy for the Renew subscription platform.

---

## Table of Contents
- [Primary Navigation Structure](#primary-navigation-structure)
- [Section Breakdown](#section-breakdown)
- [Information Hierarchy](#information-hierarchy)
- [Primary User Journeys](#primary-user-journeys)
- [Navigation Patterns](#navigation-patterns)

---

## Primary Navigation Structure

### Left Sidebar (Always Visible)

```
┌─────────────────────────────────────┐
│  RENEW LOGO                         │
├─────────────────────────────────────┤
│  🏠 Dashboard Home                  │
│                                     │
│  🔍 Discovery                       │
│  📊 Deal Flow                       │
│  🤝 Acquisition Support             │
│  📈 Post-Acquisition                │
│  🎯 Exit Planning                   │
│  👥 Network                         │
│  📚 Resources                       │
│  ⚙️ Settings                        │
├─────────────────────────────────────┤
│  [Hotline Widget - bottom right]   │
└─────────────────────────────────────┘
```

---

## Section Breakdown

### 🏠 Dashboard Home
**Purpose:** Overview and journey progress

**Sub-pages:**
- `/dashboard` - Main overview
  - Journey status widget (which phase you're in)
  - Quick stats
  - Recent activity
  - Recommended next actions
  - Upcoming events/sessions

---

### 🔍 Discovery
**Purpose:** Assess readiness and define acquisition criteria

**Sub-pages:**
- `/discovery` - Hub page
- `/discovery/readiness-quiz` - Self-assessment
- `/discovery/results` - Quiz results & gaps
- `/discovery/lead-de-cadrage` - Acquisition criteria builder
- `/discovery/learning-path` - Personalized training recommendations
- `/discovery/consultation` - Book readiness consultation (premium)

**Key User Flows:**
1. New user → Readiness quiz → Results → Lead de Cadrage → Learning path
2. Returning user → View/edit Lead de Cadrage → Update preferences

---

### 📊 Deal Flow
**Purpose:** Browse, filter, track acquisition opportunities

**Sub-pages:**
- `/deals` - Landing page
- `/deals/browse` - Main deal listing (card grid view)
- `/deals/saved` - Bookmarked deals
- `/deals/pipeline` - Personal pipeline tracker
- `/deals/compare` - Side-by-side comparison
- `/deals/alerts` - Manage deal alerts
- `/deals/[id]` - Individual deal detail page
  - `/deals/[id]/overview`
  - `/deals/[id]/financials`
  - `/deals/[id]/documents` (post-NDA)
  - `/deals/[id]/activity` - Notes & history

**Key User Flows:**
1. Browse deals → Filter → View detail → Save/Pass
2. Browse deals → View detail → Sign NDA → Access full info → Add to pipeline
3. Pipeline → Manage stages → Add notes → Track progress

---

### 🤝 Acquisition Support
**Purpose:** Help through the buying process

**Sub-pages:**
- `/acquisition` - Hub page
- `/acquisition/roadmap` - Process checklist
- `/acquisition/coaching` - Book advisory sessions
- `/acquisition/experts` - Connect with specialists
- `/acquisition/financing` - Financing options & lender matching
- `/acquisition/due-diligence` - DD checklist & tools
- `/acquisition/valuation` - Valuation tools & calculators
- `/acquisition/templates` - Legal/financial templates

**Key User Flows:**
1. User has deal → Book coaching session → Review strategy
2. User needs financing → Explore options → Connect with lenders
3. User in DD phase → Access checklist → Book expert support

---

### 📈 Post-Acquisition
**Purpose:** Monitor performance and get operational support

**Sub-pages:**
- `/post-acquisition` - Hub page
- `/post-acquisition/milestones` - 30/60/90/180 day tracker
- `/post-acquisition/kpi-dashboard` - Performance metrics
- `/post-acquisition/coaching` - Operating partner sessions
- `/post-acquisition/experts` - On-demand specialist access
- `/post-acquisition/peer-groups` - Advisory circles
- `/post-acquisition/initiatives` - Growth projects tracker

**Key User Flows:**
1. New owner → Set up KPI tracking → Monitor performance → Flag issues
2. Facing challenge → Book coaching session → Get expert help
3. Monthly → Review KPIs → Peer advisory meeting → Strategic planning

---

### 🎯 Exit Planning
**Purpose:** Prepare for and manage business sale

**Sub-pages:**
- `/exit` - Hub page
- `/exit/readiness` - Exit readiness assessment
- `/exit/valuation` - Business valuation tools
- `/exit/roadmap` - Value optimization plan
- `/exit/buyers` - Buyer identification & outreach
- `/exit/process` - Sale process management

**Key User Flows:**
1. Planning exit → Readiness assessment → Optimization roadmap
2. Ready to sell → Prepare materials → Identify buyers → Manage process

---

### 👥 Network
**Purpose:** Connect with ecosystem

**Sub-pages:**
- `/network` - Hub page
- `/network/directory` - Member directory
- `/network/mentors` - Mentor matching
- `/network/peers` - Peer advisory circles
- `/network/experts` - Specialist network
- `/network/events` - Upcoming events & workshops
- `/network/messages` - Direct messaging (premium)

**Key User Flows:**
1. Browse members → Connect → Message
2. Find mentor → Book session
3. Browse events → Register → Attend

---

### 📚 Resources
**Purpose:** Educational content and tools

**Sub-pages:**
- `/resources` - Hub page
- `/resources/library` - Articles & guides
- `/resources/courses` - Online courses
- `/resources/videos` - Video library
- `/resources/templates` - Document templates
- `/resources/reports` - Industry reports
- `/resources/tools` - Calculators & tools

**Key User Flows:**
1. Browse by topic → Read/watch content
2. Search for specific need → Access resource
3. Take course → Complete certification

---

### ⚙️ Settings
**Purpose:** Account management

**Sub-pages:**
- `/settings/profile` - Personal info
- `/settings/subscription` - Plan & billing
- `/settings/preferences` - Notifications & privacy
- `/settings/documents` - Document vault

---

## Information Hierarchy

### Level Structure

**Level 1:** Main sections (left nav)
- 8 primary sections accessible from sidebar
- Always visible navigation
- Clear iconography + labels

**Level 2:** Sub-pages within sections
- Hub pages (section landing pages)
- Specific feature pages
- Accessed via section navigation or direct links

**Level 3:** Detailed views/modals
- Individual item details (deal detail page)
- Forms and wizards
- Modals and overlays

**Level 4:** Forms, documents, data
- File downloads
- Embedded documents
- Data entry forms

**Example - Deal Flow Hierarchy:**
```
Level 1: Deal Flow (nav item)
  Level 2: Browse Deals (sub-page)
    Level 3: Deal Detail (individual page)
      Level 4: Financial Documents (downloadable PDFs)
```

---

## Primary User Journeys

### Journey 1: New User Onboarding
```
Sign up → Discovery (Readiness Quiz) → Lead de Cadrage →
Dashboard Home → Deal Flow (Browse) → Upgrade prompt
```

**Duration:** 30-60 minutes
**Completion Rate Target:** >70%

---

### Journey 2: Active Deal Search
```
Deal Flow (Browse) → Filter → Deal Detail → Sign NDA →
Access Documents → Add to Pipeline → Book Coaching →
Acquisition Support (Due Diligence)
```

**Duration:** 6-18 months
**Success Metric:** LOI submission

---

### Journey 3: Post-Acquisition Owner
```
Post-Acquisition → Set up KPIs → Monitor Dashboard →
Flag Issue → Book Coaching → Access Expert →
Peer Advisory Meeting → Network
```

**Duration:** 12-24 months (Operating Partner program)
**Success Metric:** Business performance targets met

---

### Journey 4: Exit Planning
```
Post-Acquisition → Value Creation Initiatives →
Exit Planning (Readiness) → Optimization Roadmap →
Buyer Identification → Process Management
```

**Duration:** 12-24 months
**Success Metric:** Successful exit at target valuation

---

## Navigation Patterns

### Global Navigation

**Top Bar (Always Visible):**
- Global search (⌘K keyboard shortcut)
- Notification bell (with unread badge)
- Subscription status badge ("Free" or "Premium" pill)
- User avatar with dropdown menu
  - Profile
  - Settings
  - Subscription
  - Help & Support
  - Logout

**Left Sidebar:**
- Collapsible/expandable (desktop)
- Drawer overlay (mobile)
- Active section highlighted
- Badge indicators for notifications per section
- "Collapse" toggle at bottom

**Hotline Widget (Bottom-Right, Persistent):**
- Floating circular button
- Expands to quick actions:
  - Send a message
  - Schedule a call
  - Emergency support (premium)
- Available on all pages

---

### Section Navigation

**Hub Pages:**
- Each section has a hub/landing page
- Hub provides overview and quick access to sub-pages
- Progress indicators where applicable
- Featured content or recommended next actions

**Breadcrumbs:**
- Always visible below top bar
- Shows current location in hierarchy
- Clickable for quick navigation back
- Format: Section > Sub-page > Detail

**Tabs (Where Applicable):**
- Deal detail page (Overview, Financials, Documents, Activity)
- Tools with multiple views
- Settings sections

---

### Responsive Behavior

**Desktop (>1024px):**
- Persistent left sidebar (240px width)
- Full navigation visible
- Multi-column layouts

**Tablet (768-1023px):**
- Collapsible sidebar or top navigation
- 2-column layouts
- Touch-optimized controls

**Mobile (<768px):**
- Hamburger menu → drawer
- Bottom navigation bar (key sections)
- Single-column layouts
- Swipe gestures for navigation

---

### Premium Feature Gating

**Free Users:**
- See "🔒 Premium" badges on locked features
- Clicking locked feature → Upgrade modal
- Limited access (e.g., 5-10 deals visible, rest blurred)
- Prominent "Upgrade" CTA in top bar

**Premium Users:**
- "✓ Premium" status badge in top bar
- Full access to all features
- No upgrade prompts
- Priority support access

---

## Cross-Cutting Features

### Search
- **Global Search (⌘K):**
  - Searches deals, resources, members, help docs
  - Recent searches saved
  - Quick jump navigation

### Notifications
- **Notification Center:**
  - New matching deals
  - Coaching session reminders
  - Community activity
  - Platform updates
- **Preferences:** Email, SMS (premium), In-app toggles

### Help & Support
- **Help Icon (?):** Context-sensitive help on each page
- **Help Center:** Searchable knowledge base
- **Hotline Widget:** Always accessible for support
- **Onboarding Tours:** First-time user guidance

---

## IA Principles

1. **Progressive Disclosure:** Show basics first, details on demand
2. **Consistency:** Same patterns across sections (hub pages, breadcrumbs)
3. **Clarity:** Clear labels, no jargon in navigation
4. **Efficiency:** Maximum 3 clicks to any feature
5. **Context:** Always know where you are (breadcrumbs, active states)
6. **Flexibility:** Multiple paths to common actions

---

*This IA supports a user base growing from 20 beta users to 500+ members over 2 years. Structure is scalable and can accommodate new sections/features without requiring rearchitecture.*

---

*Document Version: 1.0*
*Last Updated: 2025-11-11*
*Owner: Product Team*
