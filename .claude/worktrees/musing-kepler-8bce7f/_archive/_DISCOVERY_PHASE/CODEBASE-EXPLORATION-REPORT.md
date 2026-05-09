# Re-New Codebase Exploration Report
## Comprehensive Overview for Documentation & Re-New 3.0 Preparation

**Date:** November 15, 2025  
**Project:** Re-New - Acquisition Entrepreneur Platform  
**Status:** Documentation-Complete, Code-Pending  
**Scope:** Knowledge repository analysis, product architecture, design system, and strategic documentation

---

## EXECUTIVE SUMMARY

**Re-New is a well-architected, comprehensively documented acquisition entrepreneur platform that exists primarily as specifications and strategic documentation, NOT as working code.** The project represents a complete pivot from a recruiter/intermediary model to a direct-to-consumer subscription SaaS platform serving acquisition entrepreneurs (repreneurs) across their complete journey from discovery through exit.

### Key Findings

- **Status:** Documentation-driven architecture, specification-complete, code-pending
- **Type:** Subscription SaaS platform for SME acquisition entrepreneurs
- **Market:** €700K+ SME succession opportunity in France (and expanding to Italy)
- **Product:** 8-section platform covering discovery → acquisition → post-acquisition → exit
- **Documentation:** 52 detailed page specifications, complete design system, user journeys, personas
- **Implementation:** Zero working prototype code (no React/Vue components, no backend APIs)
- **Architecture:** Well-structured knowledge repository with strategic decision tracking
- **Business Model:** Subscription tiers (€99-349/month) + operating partner retainer (€1,500-3,000/month)

---

## PART 1: PROJECT STRUCTURE & ORGANIZATION

### Directory Architecture

```
Re-New/
├── 00_CANONICAL/                    🔒 Single source of truth
│   ├── strategy/                    📊 Business model, problem, solution, value prop
│   ├── brand/                       🎨 Audience, foundations, voice, identity
│   ├── operations/                  ⚙️ Team structure, tools, decision frameworks
│   └── knowledge/                   🧠 Lessons learned, stakeholder maps, academic context
│
├── 01_PRODUCT_DOCUMENTATION/        📱 Product specs & requirements
│   ├── product-overview.md          ✅ Complete platform vision
│   ├── information-architecture.md  ✅ 8-section navigation structure
│   ├── feature-requirements.md      ✅ Detailed feature matrix
│   ├── user-journeys.md             ✅ End-to-end journey flows
│   ├── user-personas.md             ✅ 4 customer segments
│   └── monetization-model.md        ✅ Pricing tiers & unit economics
│
├── 02_PAGE_SPECIFICATIONS/          📄 52 pages (11 detailed, 41 batch format)
│   ├── 01-authentication/           ✅ Login, signup, onboarding (3 pages)
│   ├── 02-dashboard/                ✅ Home dashboard (1 page)
│   ├── 03-discovery/                ✅ Readiness, criteria, learning (6 pages)
│   ├── 04-deal-flow/                ✅ Browse, pipeline, comparison (8 pages)
│   ├── 05-acquisition-support/      ⚠️ Batch format (8 pages)
│   ├── 06-post-acquisition/         ⚠️ Batch format (7 pages)
│   ├── 07-exit-planning/            ⚠️ Batch format (7 pages)
│   ├── 08-network/                  ⚠️ Batch format (6 pages)
│   ├── 09-resources/                ⚠️ Batch format (6 pages)
│   └── 10-settings/                 ⚠️ Batch format (2 pages)
│
├── 03_DESIGN_SYSTEM/                🎨 Design tokens & components
│   └── design-system.md             ✅ Complete system (colors, typography, components)
│
├── 02_ARTIFACTS/                    📦 Deliverables (decks, briefs, SOPs)
├── 03_DECISION_LOG/                 📜 Strategic decisions with timestamps
├── 04_MEETINGS/                     👥 Session notes and transcripts
├── 05_INBOX/                        📥 Items awaiting processing
├── 06_SCRATCHPAD/                   ✏️ Work-in-progress drafts
├── 07_ARCHIVE/                      📚 Historical reference
└── 08_SYSTEM/                       🔧 Workflows and templates
```

### Knowledge Management System

**Approach:** "AI CoFounder Operating System"

This repository uses a human-AI collaboration model where:
- **CANONICAL files** preserve strategic evolution with change history (not deletion)
- **DECISION_LOG** tracks all major pivots with dates and reasoning
- **PRODUCT_DOCUMENTATION** evolves as living specifications
- **PAGE_SPECIFICATIONS** guide development systematically
- **SCRATCHPAD** is for drafts before promotion to permanent locations

**Key Principle:** Context management, not raw information storage

---

## PART 2: THE PRODUCT

### Product Vision

**Re-New Dashboard** is a subscription-based SaaS platform that empowers acquisition entrepreneurs to **systematically and successfully acquire and operate SMEs in the €1M-10M range in France** (expanding to Italy).

#### The Business Model Shift (November 2024 Pivot)

| Aspect | Previous Model | Current Model |
|--------|---|---|
| **Customer** | Candidates (supply) for brokers/partners | Entrepreneurs (direct customers) |
| **Revenue** | Commission from partners (1% of deal) | Subscription (€99-349/month) |
| **Value** | Job placement/opportunities | Complete platform + advisory |
| **Timeframe** | Short-term transaction | Long-term journey (3-5 years) |
| **Relationship** | Marketplace intermediary | Direct SaaS provider |

---

### Platform Architecture: 8 Sections, 52 Pages

#### 1. Dashboard Home (1 page)
- **Route:** `/dashboard`
- **Purpose:** Journey overview and quick access
- **Key Elements:**
  - Journey progress timeline (Discovery → Acquisition → Post-Acq → Exit)
  - Quick stats (deals saved, pipeline, connections)
  - Recommended actions checklist
  - Recent activity feed
  - Upcoming events/sessions
  - Deal flow snapshot (premium-gated)
  - Learning progress indicator
  - Persistent hotline widget (chat/call)

#### 2. Discovery Phase (6 pages)
- **Route:** `/discovery`
- **Purpose:** Assess readiness and define acquisition criteria
- **Sub-pages:**
  - `/discovery/hub` - Overview and tool selection
  - `/discovery/readiness-quiz` - 20-question self-assessment
  - `/discovery/results` - Personalized gap analysis
  - `/discovery/lead-de-cadrage` - Mandatory criteria builder (7-section form)
  - `/discovery/learning-path` - Personalized course recommendations
  - `/discovery/consultation` - Book strategy consultation (premium)

**Key Feature: Lead de Cadrage (Acquisition Criteria Builder)**
- Mandatory before deal flow access
- 7 sections: Geography, Industry, Size, Business Model, Financial Profile, Role, Deal Structure
- 40+ fields capturing detailed acquisition thesis
- Results in matching algorithm for deal flow

#### 3. Deal Flow Module (8 pages)
- **Route:** `/deals`
- **Purpose:** Browse, evaluate, and track opportunities
- **Sub-pages:**
  - `/deals/landing` - Entry point
  - `/deals/browse` - Main interface (filters + card grid)
  - `/deals/[id]/overview` - Deal details
  - `/deals/[id]/financials` - Financial analysis
  - `/deals/[id]/documents` - Post-NDA access
  - `/deals/[id]/activity` - Notes and history
  - `/deals/saved` - Bookmarked deals
  - `/deals/pipeline` - Personal tracker (Kanban-style)
  - `/deals/compare` - Side-by-side comparison
  - `/deals/alerts` - Custom notifications

**Key Feature: Browse Interface**
- Two-column layout (filters sidebar + deal grid)
- Comprehensive filters:
  - Geography (by country, region)
  - Industry (searchable, categorized)
  - Price range (dual slider, presets)
  - Business size (revenue, employees, EBITDA)
  - Business model (B2B/B2C, recurring revenue)
  - Deal type (acquisition, stake, partnership)
- 3-column grid (responsive to tablet/mobile)
- Deal cards with key metrics and quick actions
- Load more pagination or infinite scroll
- Sort options (newest, price, revenue, match score)

#### 4. Acquisition Support (8 pages)
- **Route:** `/acquisition`
- **Purpose:** Tools and expert access during deal search
- **Typical Pages:** Roadmap, coaching booking, expert network, financing options, due diligence tools, valuation calculator, templates, guides

#### 5. Post-Acquisition Phase (7 pages)
- **Route:** `/post-acquisition`
- **Purpose:** Transition support and operational excellence
- **Typical Pages:** 30/60/90 day milestones, KPI dashboard, coaching sessions, peer advisory groups, expert access, growth initiatives, business health monitoring

#### 6. Exit Planning (7 pages)
- **Route:** `/exit`
- **Purpose:** Value optimization and sale process
- **Typical Pages:** Readiness assessment, valuation tools, value creation roadmap, buyer identification, sale process management

#### 7. Network & Community (6 pages)
- **Route:** `/network`
- **Purpose:** Peer connections and expert access
- **Typical Pages:** Member directory, mentor matching, peer advisory circles, expert specialists, events, direct messaging (premium)

#### 8. Resources & Settings (8 pages)
- **Route:** `/resources`, `/settings`
- **Purpose:** Education and account management
- **Typical Pages:**
  - Resources: Library, courses, videos, templates, reports, calculators
  - Settings: Profile, subscription, preferences, document vault

---

### Customer Segments & Subscription Tiers

#### Tier 1: Starter (€99/month) - "Explorers"
- **Target:** Early-stage discovery entrepreneurs
- **Duration:** 6 months average
- **LTV:** €594
- **Features:**
  - Discovery tools (readiness quiz, lead de cadrage)
  - Learning paths and resource library
  - 1 consultation session/month
  - Community access (view-only)
  - Basic support
- **Conversion Goal:** 40% upgrade to Professional in 6 months

#### Tier 2: Professional (€249/month) - "Active Searchers"
- **Target:** Mid-stage entrepreneurs actively seeking deals
- **Duration:** 15 months average
- **LTV:** €3,735
- **Features:**
  - All Starter features
  - Full deal flow access (unlimited browsing)
  - Pipeline tracker and deal alerts
  - Due diligence checklists, valuation tools
  - Expert network (per-session fees: €150+)
  - 3 coaching sessions/month included
  - Direct messaging and mentor matching
- **Conversion Goal:** 30% close deals → Enterprise tier

#### Tier 3: Enterprise (€349/month) - "First-Time Owners"
- **Target:** Recent acquirers in post-deal operations
- **Duration:** 24 months average
- **LTV:** €8,376 (plus OP retainer)
- **Features:**
  - All Professional features
  - Post-acquisition tools (milestones, KPI dashboard)
  - Exit planning module
  - Peer advisory circles (monthly masterminds)
  - VIP support (dedicated CSM, quarterly reviews)
  - 5 coaching sessions/month included
- **Retention Goal:** 90% annual (LTV driver)

#### Operating Partner Add-On (€1,500-3,000/month)
- **Target:** First-time owners needing intensive support
- **Total Monthly Cost:** €1,849-3,349/month
- **Features:**
  - Unlimited weekly coaching with dedicated operating partner
  - Strategic advisory and problem-solving
  - Network introductions
  - Accountability checks
- **LTV:** €44,376-80,376 (24 months)
- **Key Insight:** 80% of customer lifetime value comes from this phase

---

## PART 3: CURRENT CUSTOMER SEGMENTS & USER JOURNEYS

### Customer Personas

#### Segment 1: Experienced Operators (60% of market)
- **Age:** 35-50 years old
- **Experience:** 10+ years in management/operations
- **Background:** Corporate executives, consultants, industry leaders
- **Capital:** €100K-500K available
- **Motivation:** Ownership over corporate employment
- **Pricing Sensitivity:** Low
- **Support Level:** Self-serve to medium

#### Segment 2: First-Time Entrepreneurs (40% of market)
- **Age:** 30-40 years old
- **Experience:** 5-10 years professional
- **Background:** High achievers from corporate/consulting
- **Capital:** €50K-200K available
- **Motivation:** Escape corporate, build meaningful impact
- **Pricing Sensitivity:** Medium
- **Support Level:** Medium to high

### Complete User Journey

```
SIGNUP → DISCOVERY → ACQUISITION → POST-ACQUISITION → EXIT
   ↓         ↓            ↓              ↓              ↓
Auth    Readiness    Deal Flow     Operations      Planning
        Assessment   Pipeline      Support         & Sale
        Criteria     Expert        Operating       Optimization
        Learning     Network       Partner
```

#### Journey Timeline
- **Discovery:** 3-6 months (60% → Acquisition)
- **Acquisition:** 12-18 months (30% → Close deal)
- **Post-Acquisition:** 24-36 months (80% → Stabilize)
- **Exit Planning:** 12-24 months (70% → Successful exit)

#### Key User Flows

**Flow 1: New User Onboarding (30-60 minutes)**
```
Signup → Onboarding Questions → Discovery Hub → 
Readiness Quiz → Results → Lead de Cadrage → 
Learning Path → Dashboard Home
```

**Flow 2: Active Deal Search (6-18 months)**
```
Browse Deals → Filter → Deal Detail → Sign NDA → 
Access Documents → Add to Pipeline → Book Coaching → 
Due Diligence Support → Closing
```

**Flow 3: Post-Acquisition Owner (24 months)**
```
Post-Acquisition Hub → Set KPIs → Monitor Dashboard → 
Flag Issue → Book Coaching → Expert Access → 
Peer Advisory Meeting → Network
```

**Flow 4: Exit Planning (12-24 months)**
```
Post-Acquisition → Value Creation → Exit Readiness → 
Optimization Roadmap → Buyer Identification → 
Sale Process Management
```

---

## PART 4: TECHNOLOGY STACK (RECOMMENDED)

### Frontend
- **Framework:** Next.js (React) with TypeScript (recommended for component-based architecture)
- **Alternative:** Vue 3 or Svelte
- **UI Components:** Design system-first approach (see below)
- **State Management:** React Context, Redux, or similar
- **Forms:** React Hook Form or Formik
- **HTTP Client:** Fetch API, Axios, or SWR
- **Styling:** Tailwind CSS (recommended for design system implementation)

### Backend
- **Option A:** Next.js API routes (monolithic)
- **Option B:** Separate Node.js API (Express, Fastify, NestJS)
- **Database:** PostgreSQL (recommended for relational user/deal data)
- **ORM:** Prisma or TypeORM (for database abstraction)
- **Authentication:** Auth0, Supabase Auth, or custom JWT
- **File Storage:** AWS S3 or similar (for NDA documents, resources)
- **Email:** SendGrid, Postmark (for notifications, communications)
- **Payment:** Stripe (subscription management, invoicing)

### DevOps & Deployment
- **Hosting:** Vercel (Next.js optimal), AWS, or DigitalOcean
- **CI/CD:** GitHub Actions, GitLab CI, or similar
- **Monitoring:** Sentry (error tracking), LogRocket (session replay)
- **Analytics:** Mixpanel, Amplitude, or Segment

### Development Tools
- **Version Control:** Git/GitHub
- **Package Manager:** npm or yarn
- **Build Tools:** Webpack (via Next.js), Vite (alternative)
- **Testing:** Jest (unit), Cypress (E2E), React Testing Library
- **Documentation:** Storybook (component library documentation)
- **Design Tokens:** CSS-in-JS or token export tools

---

## PART 5: DESIGN SYSTEM

### Design Philosophy
**Inspired by Asana's design principles:** Clarity, consistency, delight

### Color Palette

#### Brand Colors
- **Primary Blue:** `#2D65F8` (primary actions, headers)
- **Secondary Teal:** `#14B8A6` (secondary actions, accents)
- **Accent Orange:** `#F97316` (highlights, CTAs)

#### Semantic Colors
- **Success Green:** `#10B981` (positive states, confirmations)
- **Error Red:** `#EF4444` (errors, warnings)
- **Warning Amber:** `#F59E0B` (alerts, cautions)
- **Info Blue:** `#3B82F6` (informational messages)

#### Neutral Colors
- **Background:** `#F9FAFB` (page background)
- **Surface:** `#FFFFFF` (cards, containers)
- **Text Primary:** `#1F2937` (main text, high contrast)
- **Text Secondary:** `#6B7280` (secondary text, medium contrast)
- **Border:** `#E5E7EB` (dividers, subtle borders)

### Typography

**Font Family:** Inter (system fallback: -apple-system, BlinkMacSystemFont, sans-serif)

**Typography Scale:**
```
12px - Small (12px, weight 500, line-height 1.5)
14px - Base (14px, weight 400, line-height 1.6)
16px - Body (16px, weight 400, line-height 1.6)
18px - 18px (18px, weight 500, line-height 1.6)
20px - 20px (20px, weight 600, line-height 1.5)
24px - Subheading (24px, weight 600, line-height 1.4)
30px - Heading (30px, weight 700, line-height 1.3)
36px - Large (36px, weight 700, line-height 1.2)
48px - XL (48px, weight 700, line-height 1.1)
```

**Font Weights:**
- 400 = Regular (body text)
- 500 = Medium (labels, buttons)
- 600 = Semibold (subheadings)
- 700 = Bold (headings, emphasis)

### Spacing System

**Base Unit:** 4px

**Spacing Scale:** 8px, 12px, 16px, 24px, 32px, 48px, 64px

**Common Usage:**
- Component padding: 16px, 20px, 24px
- Widget gaps: 20px
- Section padding: 32px
- Page margins: 24px-48px

### Component Standards

**Buttons:**
- Padding: 10px × 20px (height 40px)
- Border radius: 6px
- Font: 14px semibold
- States: Default, Hover, Active, Disabled, Loading

**Input Fields:**
- Padding: 10px × 12px (height 40px)
- Border radius: 6px
- Border: 1px solid `#E5E7EB`
- Focus border: `#2D65F8`
- States: Default, Focus, Error, Disabled, Loading

**Cards:**
- Padding: 20px
- Border radius: 8px
- Shadow: Elevation 1 (subtle)
- Border: Optional 1px `#E5E7EB`

**Modals:**
- Border radius: 12px
- Padding: 32px
- Overlay: `rgba(0, 0, 0, 0.5)`
- Max width: 560px

**Badges:**
- Padding: 6px × 12px
- Border radius: 6px
- Font: 12px medium
- Variants: Primary, Success, Error, Warning, Info

### Shadows & Elevation

Five-level elevation system:

```
Elevation 0: No shadow (flat)
Elevation 1: 0 1px 3px rgba(0, 0, 0, 0.05) (subtle)
Elevation 2: 0 2px 8px rgba(0, 0, 0, 0.08) (cards)
Elevation 3: 0 4px 12px rgba(0, 0, 0, 0.08) (medium)
Elevation 4: 0 8px 24px rgba(0, 0, 0, 0.12) (raised)
```

### Layout Grid

- **System:** 12-column responsive grid
- **Gutters:** 24px (desktop), 16px (tablet), 8px (mobile)
- **Max width:** 1440px

### Responsive Breakpoints

```
Mobile:  < 640px
Tablet:  640px - 1023px
Desktop: 1024px - 1439px
XL:      >= 1440px
```

**Approach:** Mobile-first (design mobile, then enhance)

### Icons

**System:** Heroicons (open source)
**Sizes:** 16px (small), 20px (default), 24px (large), 32px (XL)
**Color:** Inherit from text color or explicitly set
**Usage:** Always with aria-label or adjacent text label

### Animations & Transitions

**Timing Functions:**
- Ease: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Ease-in: `cubic-bezier(0.42, 0, 1, 1)`
- Ease-out: `cubic-bezier(0, 0, 0.58, 1)`

**Duration Standards:**
- Quick: 150ms (hovers, toggles)
- Standard: 250ms (transitions)
- Slow: 350ms (complex animations)

### Accessibility (WCAG AA)

**Color Contrast:**
- Text on background: 4.5:1 minimum
- Large text: 3:1 minimum

**Keyboard Navigation:**
- All interactive elements focusable
- Tab order logical
- Focus indicator visible

**Screen Readers:**
- Semantic HTML (`<button>`, `<form>`, etc.)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic updates
- Form labels associated with inputs

**Focus Management:**
- Visible focus ring (at least 2px)
- Focus order matches visual order

---

## PART 6: STRATEGIC CONTEXT

### The Problem Re-New Solves

**Macro Problem: SME Succession Crisis in France**
- 700,000 SMEs need succession by 2032
- €90 billion of enterprise value at risk
- 60% of SMEs close due to lack of successors
- 2.5 million jobs potentially affected

**Entrepreneur's Problem: Broken Acquisition Journey**

1. **Discovery Blindness** - Don't know if they're ready or what to buy
2. **Deal Flow Darkness** - Can't find quality opportunities
3. **Evaluation Paralysis** - Don't know how to assess deals properly
4. **Network Isolation** - Lack access to specialized advisors
5. **Process Complexity** - Don't know how to structure and execute

**Why Traditional Solutions Fail:**
- M&A Advisors: Too expensive (€50K+ minimum), transaction-only
- Online Marketplaces: No support or guidance, just listings
- Business Brokers: Represent sellers not buyers
- DIY Approach: Learning curve too steep, mistakes too costly

### Core Value Proposition

**For Discovery Phase:**
> "Gain clarity on whether acquisition is right for you and what to buy—without wasting years exploring blindly."

**For Acquisition Phase:**
> "Access the best deals, expert guidance, and financing connections—reducing search time from 23 months to 12-18 months."

**For Post-Acquisition:**
> "Transform from buyer to successful operator with ongoing coaching, peer support, and proven frameworks—reducing failure risk from 40% to <20%."

**For Exit Planning:**
> "Maximize your exit value and find the right buyer—capturing 20-30% more value than reactive sellers."

### Competitive Positioning

**Unique Value:**
1. Systematically prepares buyers before they search (not just listings)
2. Supports full journey from discovery → exit
3. Provides post-acquisition operating partner support
4. Builds curated community of vetted repreneurs
5. Focuses on European SME succession specifically
6. Uses subscription model (aligned incentives, not transactional)

**vs Competitors:**
- **Axial:** Deal marketplace, no buyer prep, no post-close support
- **BizBuySell:** Listings site, no vetting, transactional
- **Searchfunder:** Community + marketplace, self-serve, US-centric
- **Traditional M&A:** Expensive, transaction-only
- **Search Funds:** Elite/exclusive, equity dilution

### Market Size

**France TAM:** ~10,000 potential repreneurs annually  
**France SAM:** ~2,000 active searchers  
**France SOM (Year 3):** 200-500 active subscribers  

**Italy (Future):**  
TAM: 8,000 | SAM: 1,500 | SOM (Year 4-5): 150-300

---

## PART 7: WHAT EXISTS vs. WHAT'S MISSING

### What's Complete (100%)

✅ **Strategic Documentation**
- Problem statement and business case
- Value proposition framework
- Audience and customer personas
- Complete user journeys (4 major flows)
- Competitive positioning
- Business model and unit economics
- Expansion thesis

✅ **Product Documentation**
- Product overview (18 pages)
- Information architecture (complete 8-section structure)
- Feature requirements matrix
- Monetization model with pricing tiers
- User persona definitions
- Complete journey mapping

✅ **Page Specifications**
- 11 detailed page specs (fully specified with components, states, interactions)
  - 3 authentication pages
  - 1 dashboard page
  - 7 discovery phase pages
- 41 batch format page specs (complete but less detailed)
  - 8 acquisition support pages
  - 7 post-acquisition pages
  - 7 exit planning pages
  - 6 network pages
  - 6 resource pages
  - 2 settings pages

✅ **Design System**
- Complete design tokens (colors, typography, spacing)
- Component specifications (buttons, inputs, cards, etc.)
- Layout grid system
- Responsive breakpoints
- Accessibility standards (WCAG AA)
- Icon system documentation
- Animation principles
- Elevation system

✅ **Repository Management**
- Clear folder structure with change history
- Decision log with timestamps
- Strategic documentation with evolution tracking
- Meeting notes and archives

### What's Missing (0% - Not Started)

❌ **Frontend Implementation**
- No React/Vue/Svelte components
- No working prototype
- No component library
- No Storybook setup
- No design token exports

❌ **Backend Infrastructure**
- No API endpoints
- No database schema
- No data models
- No business logic implementation

❌ **Authentication System**
- No auth implementation
- No user management
- No session handling
- No role-based access control

❌ **Core Features**
- No quiz engine (readiness assessment)
- No form engine (lead de cadrage)
- No deal browsing/filtering
- No deal matching algorithm
- No deal pipeline tracker
- No coaching booking system
- No KPI dashboards

❌ **Infrastructure & DevOps**
- No deployment setup
- No testing framework
- No CI/CD pipeline
- No monitoring/analytics

❌ **Design Assets**
- No Figma design files
- No Sketch files
- No design component library

---

## PART 8: RECOMMENDED IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-4)
1. Set up Next.js project with TypeScript
2. Configure development environment and CI/CD
3. Create design system components (buttons, inputs, cards)
4. Set up authentication (Auth0 or Supabase)
5. Create basic layout (top bar, sidebar, hotline widget)

### Phase 2: MVP Authentication & Onboarding (Weeks 5-8)
1. Build authentication pages (login, signup, forgot password)
2. Create onboarding flow
3. Implement basic dashboard
4. Set up user profile management

### Phase 3: Discovery Phase (Weeks 9-16)
1. Build discovery hub
2. Implement readiness quiz (20-question form with validation)
3. Create results page with gap analysis
4. Build lead de cadrage (7-section multi-step form)
5. Create learning path interface

### Phase 4: Deal Flow (Weeks 17-24)
1. Design and implement deal data model
2. Build deal browsing interface with filters
3. Create deal detail pages
4. Implement deal saving/pipeline
5. Build deal comparison interface
6. Set up deal alerts system

### Phase 5: Acquisition Support & Post-Acq (Weeks 25-32)
1. Build coaching booking system
2. Create expert network interface
3. Implement post-acquisition modules
4. Build KPI dashboard

### Phase 6: Polish, Testing & Launch (Weeks 33+)
1. Complete responsive design
2. Write comprehensive tests (unit, E2E)
3. Performance optimization
4. Security hardening
5. Beta launch with Cohort 2.0

---

## PART 9: KEY METRICS & SUCCESS CRITERIA

### North Star Metric
**Successful acquisitions completed by Renew members**
- Year 1 Target: 5-10 acquisitions
- Year 2 Target: 15-25 acquisitions
- Year 3 Target: 30-50 acquisitions

### Acquisition Metrics
- Monthly Active Users (MAU)
- Free → Paid conversion (Target: 15-25%)
- Paid subscriber count by tier
- Churn rate (Target: <10% annual)
- Net Revenue Retention (Target: >100%)

### Engagement Metrics
- Deals viewed per user per month (Target: 20+)
- Coaching sessions booked (Target: 80% utilization)
- Community forum activity
- Course completion rate (Target: >50%)

### Outcome Metrics
- LOIs submitted by members
- Deals closed by members
- Member NPS (Target: >50)
- Post-acquisition survival rate (Target: >80% at 2 years)

### Financial Metrics
- CAC: €1,000/customer
- LTV: €5,000-8,000 blended
- LTV:CAC: 5-8x (target: >3x)
- Gross Margin: 85-90%
- Payback Period: 3-6 months

---

## PART 10: STRATEGIC DECISIONS & PIVOTS

### Key Strategic Pivot (November 2024)

**Decision:** Shift from candidate-as-products (B2B to partners) to candidates-as-customers (B2C subscription)

**What Changed:**
- Business model: Commission-based → Subscription SaaS
- Customer relationship: Intermediary → Direct provider
- Value delivery: Transactional → Ongoing platform + advisory
- Revenue stability: Unpredictable commissions → Recurring subscriptions

**Rationale:**
- Commission model lacked scale (20 deals/year max)
- Subscription model aligns incentives with customer success
- Platform approach enables 24/7 support vs. bespoke advisory
- Operating partner retainer adds high-margin revenue layer
- Market validation showed strong direct demand

**Impact:** Complete rewrite of product, business model, and go-to-market strategy

---

## PART 11: CRITICAL SUCCESS FACTORS

### Product Must-Haves
1. **Readiness Quiz** - Validates customer fit and identifies gaps
2. **Lead de Cadrage** - Mandatory gate before deal flow (creates matching signal)
3. **Deal Flow Engine** - Curated opportunities (differentiation)
4. **Multi-Step Forms** - Must handle complex user input without losing data
5. **Coach Booking** - Monetization for advisory services
6. **KPI Dashboards** - Post-acq retention (high LTV driver)
7. **Community Features** - Peer support reduces churn

### Technical Must-Haves
1. **Robust Auth System** - Enterprise-grade security
2. **Scalable Data Model** - Support deal catalog, user profiles, coaching sessions
3. **Performance** - Fast page loads (critical for deal browsing)
4. **Mobile Responsiveness** - Users access on-the-go
5. **Payment Integration** - Stripe for subscriptions
6. **Email System** - Notifications, marketing campaigns
7. **File Management** - NDA document handling

### Business Must-Haves
1. **Free-to-Paid Funnel** - Free tier converts to paid (15-25% target)
2. **Cohort Acquisition** - Batch onboarding of friends/cohorts
3. **Content Marketing** - SEO for "acquisition SME France" keywords
4. **Partner Network** - Brokers and lenders as distribution
5. **Operating Partner Program** - High-margin recurring revenue

---

## PART 12: NEXT IMMEDIATE STEPS

### For Documentation Completion (Before Development Starts)
1. Expand 41 batch-format page specs to full detailed specs (€2K effort)
2. Create Figma design file from specification (€3K effort)
3. Build high-fidelity prototype for user testing (€2K effort)
4. Conduct usability testing with real repreneurs (€1K effort)

### For Development Preparation
1. Finalize tech stack decision (Next.js recommended)
2. Set up repository structure and CI/CD pipeline
3. Create component library scaffolding in Storybook
4. Design database schema for users, deals, coaching, KPIs
5. Plan API endpoint structure

### For Go-To-Market
1. Identify and recruit Cohort 2.0 beta users (50-100 people)
2. Set up Stripe payment processing and subscription management
3. Create customer onboarding email sequences
4. Build landing page and waitlist signup
5. Develop launch plan for Q1 2026

---

## CONCLUSION

**Re-New represents an exceptionally well-documented product and business strategy, with complete specifications ready for implementation.** The transition from specification to code is straightforward—each page specification provides detailed component requirements, states, and interactions that can be implemented directly.

**The main gaps are:**
1. Working code (obviously)
2. Figma design file (for design handoff)
3. High-fidelity prototype (for user validation)

**The main strengths are:**
1. Clear product vision with no strategic ambiguity
2. Detailed page specifications guide development
3. Complete design system ensures consistency
4. User journey mapping enables systematic development
5. Business model validated with clear unit economics

**Timeline to MVP:** 8-12 weeks of focused development with clear specifications

**Key Success Factor:** The discovery phase (readiness quiz + lead de cadrage) is the foundation—get this right first as it enables all downstream features and deal matching.

---

*Document Version: 1.0*  
*Generated: November 15, 2025*  
*Status: Ready for Re-New 3.0 Development Handoff*
