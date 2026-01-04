# Tools & Systems

**Purpose:** Define the technology stack and collaboration tools for Re-New 2.0 team
**Status:** Canonical
**Last Updated:** 2024-11-01
**Owner:** Ivan (tool champion)

---

## CRITICAL UPDATE (November 1, 2024): ATS → CRM Transition

**Decision:** "ATS is dead, CRM is the future" ([See DEC-20241101](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md))

Re-New is transitioning from Applicant Tracking System (ATS) to Customer Relationship Management (CRM) to reflect fundamental business model shift from selection platform to relationship management ecosystem.

**What's changing:**
- Flatchr (ATS) being phased out
- Airtable CRM being implemented
- Focus: Track relationships, service delivery, monetization (not candidate scoring/selection)

---

## Primary Collaboration Platform

### Notion (Primary Knowledge Management)

**Status:**  Adopted (October 20, 2024)

**Purpose:**
- Single source of truth for team knowledge
- Documentation repository (strategy, branding, meeting notes)
- ICP deliverable compilation
- Collaborative workspace for cross-functional work

**Workspace:**
- **Re-New 2.0** (Ivan's paid Notion account)
- All team members have edit access as of Oct 20, 2024
- Bertrand has separate workspace (free account) - may consolidate if he upgrades

**Key Content:**
- Branding & positioning documentation
- Strategy documents
- Website content and copy
- Individual contribution pages (team member strengths/focus areas)
- Meeting notes and decision logs
- ICP research and deliverables

**Training:**
- 5-minute basics training scheduled for October 27, 2024 weekly sync
- Covers: Navigation, creating pages, uploading files, comments, basic formatting
- Advanced features (databases, AI integration) to be learned as needed

**Pragmatic Approach:**
Team members may work in familiar tools (Google Docs, Excel) and import final work to Notion. Not required to create everything natively in Notion, but final deliverables should live there.

**AI Integration Capabilities:**
- Notion can connect to ChatGPT, Claude, and other AI agents
- Use case: "Claude, learn everything in Re-New Notion, then research competitor X and compare"
- Particularly valuable for competitive research (expansion workstream)

**Links:**
- Re-New 2.0 Workspace: [To be added]
- [DEC-20241020: Notion Adoption](../../03_DECISION_LOG/2024-Q4/DEC-20241020-notion-adoption.md) - Full decision rationale

---

## Repreneur & Partner Management

### Airtable CRM (Relationship Management)

**Status:** Adopted (November 2024) - Replacing Flatchr ATS

**Purpose:**
- Repreneur relationship management (70+ active relationships)
- Service delivery tracking (coaching, intros, deal flow)
- Offer/monetization management (who pays, for what, how much)
- Partner relationship tracking (M&A firms, deal flow sources)
- Lead de Cadrage structured data storage

**Key Entities:**
1. **Repreneurs** - Profile, journey stage, services delivered, monetization status
2. **Partners** - M&A firms, brokers, lenders (deal flow sources + clients)
3. **Offers/Services** - Coaching tiers, deal access, operating partner support
4. **Deal Flow** - Acquisition opportunities from partners
5. **Interactions** - Activity log (calls, meetings, intros made)

**Workflows:**
- Repreneur onboarding: Application → Lead de Cadrage → Interview → Segmentation → Offer assignment
- Service delivery: Track coaching sessions, partner intros, deal matches
- Monetization: Subscription tracking, commission pipeline, payment status

**Why CRM (not ATS)?**
- Re-New manages ongoing relationships (not one-time selection)
- Need to track value delivered over months/years
- Bertrand managing 70+ repreneurs manually unsustainable
- Dual monetization requires revenue tracking

**Implementation:**
- Phase 1 (Nov 2024): Basic Airtable setup with 7 core tables
- Phase 2 (Q1 2025): AI layer for PDF parsing (Lead de Cadrage automation)
- Phase 3 (Q2 2025+): Evaluate custom build if Airtable insufficient

**Owner:** Amelie (CRM admin), Bertrand (primary user)

**Links:**
- [DEC-20241101: ATS → CRM Decision](../../03_DECISION_LOG/2024-Q4/DEC-20241101-ats-to-crm-operational-pivot.md)
- [CRM Technical Specification](../../01_WORKSTREAMS/crm-transition/crm-technical-spec.md) (if created)

---

### Flatchr (BEING PHASED OUT)

**Previous Purpose:** Applicant tracking for Campaign #1 and #2

**Status:** ⚠️ Being phased out (November 2024)

**Why phasing out:**
- Designed for recruitment/selection (wrong mental model)
- Cannot track ongoing relationships and service delivery
- Amelie: "We cannot keep on working like this... this is not okay"
- Replaced by Airtable CRM

**Transition plan:**
- Complete Campaign #2 analytics in Flatchr
- Migrate active repreneurs to Airtable CRM
- Retain access only if future campaigns require basic ATS features
- Timeline: Transition complete by end Q4 2024

---

## Communication Tools

### Slack (Daily Communication)

**Purpose:**
- Real-time team communication
- Quick questions and updates
- File sharing and links
- Integration notifications (if configured)

**Channels:**
- #general: Team-wide announcements
- #icp: Academic deliverable coordination
- #campaign: Active campaign updates (Scale & Refine)
- (Others to be defined as needed)

**Norms:**
- Default to async (don't expect immediate responses)
- Use threads for discussions (keep channels organized)
- Important decisions � document in Notion (Slack is ephemeral)

### Email (External Communication)

**Purpose:**
- Communication with Bertrand (founder)
- Academic advisors (Francesco, Martin Kuh)
- External partners (when formal communication needed)
- Official university correspondence

**Not for:** Internal team coordination (use Slack or Notion instead)

---

## Productivity & Project Management

### Notion (Task Management)

**Purpose:**
- Action item tracking (from weekly syncs)
- ICP milestone tracking
- Workstream status updates

**Structure:**
- Each workstream has dedicated Notion pages
- Action items captured in meeting notes, tracked in workstream pages
- ICP deliverables tracked with deadlines and owners

### Google Calendar (Scheduling)

**Purpose:**
- Weekly sync meetings (recurring Monday 7-8 PM)
- Founder check-ins (monthly)
- Academic advisor meetings (ad-hoc)
- Personal time management

**Shared calendars:** To be set up if needed for availability visibility

---

## Research & Competitive Intelligence

### AI Tools (ChatGPT, Claude, others)

**Purpose:**
- Competitive research (e.g., analyzing Cairn, other ETA competitors)
- Market analysis and insights
- Document synthesis and summarization
- Connected to Notion for context-aware research

**Expansion workstream use case:**
- Research family business succession market
- Analyze German competitor Cairn's business model
- Synthesize findings for strategic recommendations

### Web Search & Databases

**Purpose:**
- Market research
- Academic sources (for ICP deliverable)
- Industry reports and analysis

---

## Development & Technical (Scale & Refine Workstream)

### React (AI Platform Development)

**Purpose:** Ivan's HR automation platform for candidate screening and management
**Status:** In development, will run parallel to Campaign #2
**Tech Stack:** React (details to be documented by Ivan)

### Website Hosting

**Purpose:** Re-New public website
**Status:** Live
**Maintenance:** Ivan (technical), content updates via Notion � website

---

## Document Creation & Collaboration

### Google Workspace (Optional/Supplementary)

**Usage:**
- Team members may use Google Docs/Sheets for individual work
- Must import to Notion for final deliverables and team visibility
- Not the primary collaboration platform (Notion is)

**Why both?**
- Pragmatic: some team members more comfortable with Google tools
- Flexibility: use what works for your task, consolidate in Notion
- ICP context: demonstrates ability to work across platforms

---

## File Storage & Sharing

### Notion (Primary)

**Purpose:**
- Store documents, PDFs, images within relevant pages
- Version control through page history
- Contextual file organization (files live with related content)

### Google Drive (Secondary/Backup)

**Purpose:**
- Large file sharing if needed
- Backup of critical documents
- Compatibility with external stakeholders who use Google ecosystem

---

## Academic & ICP Tools

### TBD

**Potential needs:**
- Citation management (Zotero, Mendeley) for ICP references
- Data analysis tools (if quantitative research required)
- Presentation tools (for final ICP defense)

**To be determined:** Based on ICP requirements from Francesco and Martin Kuh

---

## Tool Decision Principles

**Single Source of Truth:**
If it's not in Notion (or linked from Notion), it doesn't exist for the team. Avoid scattered knowledge.

**Async by Default:**
Choose tools that support asynchronous collaboration (not everyone online at same time).

**Minimize Tool Sprawl:**
Don't add new tools without team discussion. Stick to agreed stack unless there's clear need.

**Learn, But Don't Over-Invest:**
ICP benefits from learning new tools (Notion), but don't spend days on tools training. Basics are enough; advanced features as needed.

**Import Over Recreate:**
If you worked in Google Docs, import to Notion. Don't force recreation in Notion format.

---

## Tool Ownership & Support

**Notion Champion:** Ivan
- Provides training and support
- Manages workspace structure
- Helps with advanced features (databases, integrations)

**Slack Admin:** TBD

**Calendar Coordinator:** Alex (sets up meeting invites)

**Questions?** Ask in Slack #general or bring to weekly sync

---

## Change History

*(No previous tools stack documented - this is the first canonical version)*

**Established:** October 20, 2024 (Notion adoption decision)
**Source:** [Weekly Sync - Oct 20, 2024](../../04_MEETINGS/weekly-sync/2024-10-20-inaugural-weekly-sync.md)

---

## Related Documents

- [Meeting Cadence](meeting-cadence.md) - When and how we meet (using these tools)
- [Team Structure](team-structure.md) - Who uses what (workstream-specific tools)
- [Decision Framework](decision-framework.md) - How we decide to add/change tools
- [DEC-20241020: Notion Adoption](../../03_DECISION_LOG/2024-Q4/DEC-20241020-notion-adoption.md) - Why Notion was chosen
