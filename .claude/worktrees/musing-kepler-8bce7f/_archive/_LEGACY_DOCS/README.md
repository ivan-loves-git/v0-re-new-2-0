# Re-New - Knowledge Repository

> **The comprehensive SaaS platform empowering entrepreneurs to successfully acquire and operate SMEs in France.**

---

## 📘 New Here? Start Here!

**📘 Read [START-HERE.md](START-HERE.md) first** - Your essential 5-minute onboarding guide

**📖 Then read [KNOWLEDGE-SYSTEM.md](KNOWLEDGE-SYSTEM.md)** - The complete operating manual

---

## 🚨 IMPORTANT: Editing Rules

### When Updating CANONICAL Files (`00_CANONICAL/`)

**DO NOT delete old content.** Follow the change history protocol:

1.  Add new content at the top
2.  Move old content to `## Change History` section at bottom
3.  Strike through old content using `~~text~~`
4.  Add timestamp and reason for change

**Example:**
```markdown
## Our Strategy (Updated 2024-11-12)
We now focus on X because Y...

---
## Change History
### Our Strategy (Previous - 2024-10-15)
~~We previously focused on Z...~~
**Reason:** Market validation showed X works better
```

**Why?** We preserve the evolution of our strategic thinking, enabling anyone to understand not just WHAT we decided, but WHY and WHEN we changed course.

### Files in Other Folders
Can be updated normally without change history tracking.

---

## 📁 Repository Structure

```
Re-New/
   START-HERE.md              📘 Read this first!
   KNOWLEDGE-SYSTEM.md        📖 Complete operating manual
   README.md                  📄 You are here

   00_CANONICAL/              🔒 Single source of truth (with change history)
      strategy/              🎯 Business model, value prop, problem/solution
      brand/                 🎨 Audience, voice, landing page
      operations/            ⚙️ Team, processes, tools
      knowledge/             🧠 Lessons learned, stakeholder maps

   01_PRODUCT_DOCUMENTATION/  📱 Dashboard product specs & strategy
      ├─ product-overview.md      High-level product description
      ├─ user-personas.md         Entrepreneur profiles
      ├─ user-journeys.md         Discovery → Deal closing flows
      ├─ information-architecture.md  IA structure
      └─ monetization-model.md    Pricing tiers

   02_PAGE_SPECIFICATIONS/    📄 Detailed page architectures (52 pages)
      ├─ 01-authentication/       Signup, Login, Onboarding
      ├─ 02-dashboard/            Home dashboard
      ├─ 03-discovery/            Readiness & criteria
      ├─ 04-deal-flow/            Browse, detail, pipeline
      ├─ 05-acquisition-support/  Coaching, DD, financing
      ├─ 06-post-acquisition/     KPIs, milestones, support
      ├─ 07-exit-planning/        Readiness, valuation, sale
      ├─ 08-network/              Community, mentors, events
      ├─ 09-resources/            Courses, templates, library
      └─ 10-settings/             Profile, subscription, preferences

   03_DESIGN_SYSTEM/          🎨 UI/UX design system (Asana-inspired)
      ├─ design-system.md         Complete design system
      ├─ colors.md                Color palette
      ├─ typography.md            Font system
      ├─ components.md            Button, card, input styles
      └─ patterns.md              Common UI patterns

   04_TECHNICAL/              💻 Technical architecture & specs
      ├─ tech-stack.md            Technologies
      ├─ data-model.md            Database structures
      └─ api-endpoints.md         API design

   01_WORKSTREAMS/            🚧 Active projects and focus areas
   02_ARTIFACTS/              📦 Deliverables (briefs, decks, emails, SOPs)
   03_DECISION_LOG/           📜 Immutable record of key decisions
   04_MEETINGS/               👥 Session captures and notes
   05_INBOX/                  📥 External inputs (process within 7 days)
   06_SCRATCHPAD/             ✏️ Drafts and work-in-progress
   07_ARCHIVE/                📚 Historical reference (read-only)
   08_SYSTEM/                 🔧 Templates and workflows
```

---

## 🎯 Core Principles

1. **Repo-first truth** - If it's not here, it doesn't exist
2. **Evolutionary memory** - CANONICAL preserves change history
3. **Human review gates** - Strategic changes require approval
4. **Provenance tracking** - Every claim has a source
5. **Task-scoped context** - Load only what you need
6. **Artifacts over chat** - Produce files you can ship

---

## 📚 Quick Links

| Need | Location |
|------|----------|
| **Current strategy** | [00_CANONICAL/strategy/](00_CANONICAL/strategy/) |
| **Dashboard product** | [01_PRODUCT_DOCUMENTATION/](01_PRODUCT_DOCUMENTATION/) |
| **Page specifications** | [02_PAGE_SPECIFICATIONS/](02_PAGE_SPECIFICATIONS/) |
| **Design system** | [03_DESIGN_SYSTEM/](03_DESIGN_SYSTEM/) |
| **Target audience** | [00_CANONICAL/brand/audience.md](00_CANONICAL/brand/audience.md) |
| **Team structure** | [00_CANONICAL/operations/team-structure.md](00_CANONICAL/operations/team-structure.md) |
| **What we learned** | [00_CANONICAL/knowledge/lessons-learned.md](00_CANONICAL/knowledge/lessons-learned.md) |
| **This week's work** | [01_WORKSTREAMS/](01_WORKSTREAMS/) |
| **Recent decisions** | [03_DECISION_LOG/](03_DECISION_LOG/) |

---

## 📱 About Re-New

Re-New is a **comprehensive SaaS platform** that empowers entrepreneurs to successfully acquire and operate SMEs in the €1M-10M range in France.

### The Problem We Solve

Entrepreneurs seeking to acquire SMEs face a broken journey:
- **No structured path**: 2-3 years of wandering vs 12-18 months with guidance
- **Hidden opportunities**: Best deals never reach public marketplaces
- **Expensive advisors**: Traditional M&A services start at €50K+
- **Complete isolation**: No mentors, peers, or expert network
- **High failure rate**: 80% give up before finding the right business

### Our Solution: The Re-New Platform

We provide a technology platform combined with on-demand advisory services that covers the entire acquisition journey:

**🔍 Discovery Module**: Assess your readiness and build your acquisition thesis
**📊 Deal Flow Engine**: Access curated opportunities matched to your criteria
**📈 Evaluation Toolkit**: Professional-grade analysis and valuation tools
**🤝 Expert Network**: On-demand advisors, vetted lawyers, and lenders
**✅ Process Manager**: Step-by-step guidance through closing

**What Makes Us Different:**
- ✅ **Technology-First**: Scalable platform available 24/7
- ✅ **Full Journey Support**: Only solution covering discovery to deal closing
- ✅ **Flexible Engagement**: Self-serve tools or full advisory support
- ✅ **French Market Expertise**: Deep understanding of local dynamics
- ✅ **Accessible Pricing**: Start at €30-50/month vs €50K+ retainers

**Market Context:**
- 🔴 France: ~700,000 SME successions needed by 2032
- 🔴 €90 billion of enterprise value at risk
- 🔴 60% of SMEs close due to lack of prepared successors
- 🟢 Perfect timing: Demographic wave + technology enablement

### Business Model

**Tiered SaaS + Premium Services:**

1. **Platform Subscriptions** (€30-750/month)
   - Explorer: €30-50/month - Discovery and education
   - Searcher: €150-250/month - Active deal search
   - Acquirer: €500-750/month - Transaction execution

2. **Premium Advisory Services** (À la carte)
   - Consultations: €200-500/hour
   - Deal evaluation: €2,000-5,000
   - Negotiation support: €5,000-10,000
   - Partner introductions: €500-1,000

3. **Future: Success Fees** (0.5-1% of transaction value)

**Unit Economics:**
- CAC: €150-200
- LTV: €3,700+
- LTV/CAC: 18-25x
- Target: €20K MRR by Month 12

**Stage:** Strategic pivot from marketplace to platform model (November 2024)

---

## 🎯 Current Focus (Q4 2024 - Q1 2025)

1. **Launch MVP Platform** (Core discovery and deal flow features)
2. **Acquire First 25 Customers** (Validate pricing and value prop)
3. **Build Advisory Network** (5-10 expert advisors)
4. **Develop Partnerships** (3-5 business brokers)
5. **Achieve €5K MRR** (Prove business model viability)

See [00_CANONICAL/strategy/](00_CANONICAL/strategy/) for detailed strategic documents.

---

## 👥 For Team Members

### Your First Week
1. Read [START-HERE.md](START-HERE.md)
2. Read [KNOWLEDGE-SYSTEM.md](KNOWLEDGE-SYSTEM.md)
3. Review all [00_CANONICAL/](00_CANONICAL/) files
4. Review [01_PRODUCT_DOCUMENTATION/](01_PRODUCT_DOCUMENTATION/) for product context
5. Check last 2 [weekly sync meetings](04_MEETINGS/weekly-sync/)

### Your Daily Routine
- **Monday:** Check INBOX, review weekly brief
- **After meetings:** Capture notes in 04_MEETINGS/
- **Before decisions:** Check 03_DECISION_LOG/ for precedent
- **When drafting:** Work in 06_SCRATCHPAD/ first
- **Product work:** Reference page specs in 02_PAGE_SPECIFICATIONS/

### When You Update CANONICAL
**Remember the change history rule!** Move old content to bottom with strikethrough.

---

## 🤖 For AI Agents

This repository is designed as an **AI CoFounder operating system**.

**Essential reading order:**
1. [START-HERE.md](START-HERE.md)
2. [KNOWLEDGE-SYSTEM.md](KNOWLEDGE-SYSTEM.md)
3. [08_SYSTEM/.ai-instructions/](08_SYSTEM/.ai-instructions/) (if exists)

**For product/dashboard work:**
1. [01_PRODUCT_DOCUMENTATION/README.md](01_PRODUCT_DOCUMENTATION/README.md) - Product overview
2. [02_PAGE_SPECIFICATIONS/README.md](02_PAGE_SPECIFICATIONS/README.md) - Page architectures
3. [03_DESIGN_SYSTEM/design-system.md](03_DESIGN_SYSTEM/design-system.md) - Design specs

**Key rules:**
- 📖 Load task-relevant context only (token budget discipline)
- ✏️ Work in SCRATCHPAD for drafts
- 🔒 Propose CANONICAL changes, never edit directly
- 📝 Use change history format for CANONICAL updates
- 📚 Cite sources for every claim
- 👤 Request human review at appropriate gates

**Context assembly guide:** See [KNOWLEDGE-SYSTEM.md 🧠 Context Assembly Strategy](KNOWLEDGE-SYSTEM.md#-context-assembly-strategy)

---

## 📊 Document Lifecycle

```
External input → INBOX → Process → Route to:
                                    → CANONICAL (via review, with history)
                                    → DECISION_LOG (if decision)
                                    → ARTIFACTS (if deliverable)
                                    → WORKSTREAMS (if active work)
                                    → PRODUCT_DOCUMENTATION (if product spec)
                                    → PAGE_SPECIFICATIONS (if page design)
                                    → ARCHIVE (if reference only)

All drafts start in SCRATCHPAD
All CANONICAL changes preserve history
All decisions are logged
All artifacts cite sources
All product specs are documented in dedicated folders
```

---

## ❌ What Doesn't Belong Here

- 🚫 Passwords, API keys, credentials
- 🚫 Sensitive personal data
- 🚫 Unredacted confidential financials
- 🚫 Private board discussions (without permission)

Use secure vault for sensitive info, reference by identifier only.

---

## 📊 Repository Health Metrics

We maintain quality through:

| Metric | Target | Check |
|--------|--------|-------|
| CANONICAL staleness | <90 days | Weekly sweep |
| INBOX age | <7 days | Weekly cleanup |
| SCRATCHPAD age | <30 days | Monthly review |
| Broken links | 0 | On-demand |
| Meeting notes processed | <48h | After each meeting |
| Product docs up-to-date | <14 days | Bi-weekly review |

---

## 🤝 Contributing

**Before making changes:**
1. Understand the folder structure ([KNOWLEDGE-SYSTEM.md 🧭 Decision Tree](KNOWLEDGE-SYSTEM.md#-folder-decision-tree))
2. Check if this updates CANONICAL (requires change history format)
3. Draft in SCRATCHPAD if unsure
4. Request review before finalizing

**For significant strategic changes:**
1. Create proposal in `06_SCRATCHPAD/proposed-changes/`
2. Document: what's changing, why, sources
3. Request founder review
4. Upon approval: merge with change history
5. Log in `03_DECISION_LOG/` if major pivot

**For product/dashboard changes:**
1. Update relevant file in `01_PRODUCT_DOCUMENTATION/` or `02_PAGE_SPECIFICATIONS/`
2. Ensure design system alignment (`03_DESIGN_SYSTEM/`)
3. No change history needed (these are living product docs)

---

## 💡 Philosophy

This repository implements the **AI CoFounder manifesto:**

> Treat your company like a living codebase where **context management—not raw intelligence—is the constraint**.

By maintaining a well-structured, properly versioned, provenance-tracked knowledge base:
- Tomorrow's AI can answer questions better than today's
- New team members onboard in hours, not weeks
- Strategic contradictions become impossible
- Institutional memory is preserved
- Decision-making is traceable and auditable
- Product development is systematic and documented

**This isn't just files and folders. It's a business operating system.**

---

## ❓ Questions?

- **System/process questions** → [KNOWLEDGE-SYSTEM.md](KNOWLEDGE-SYSTEM.md) or [08_SYSTEM/workflows/](08_SYSTEM/workflows/)
- **Strategic questions** → [00_CANONICAL/strategy/](00_CANONICAL/strategy/) or founding team
- **Product questions** → [01_PRODUCT_DOCUMENTATION/](01_PRODUCT_DOCUMENTATION/) or product team
- **Design questions** → [03_DESIGN_SYSTEM/](03_DESIGN_SYSTEM/) or design team
- **Tactical questions** → Relevant [01_WORKSTREAMS/](01_WORKSTREAMS/) or workstream owner

---

## 📈 Change History

### November 12, 2024 - Strategic Pivot to Platform Model
**What Changed:**
- Updated tagline from succession-focused to entrepreneur empowerment
- Completely rewrote "About Re-New" section to reflect new B2C model
- Changed business model from dual monetization to tiered SaaS + services
- Updated current focus to reflect platform launch priorities
- Added problem/solution framing for entrepreneur audience

**Previous Version (Pre-November 2024):**
The repository previously described Re-New as a "subscription-based platform solving the European SME succession crisis by transforming the business model from 'candidates as products' to 'candidates as customers.'" This reflected an intermediate model that still focused on candidates as a pool for partners rather than direct customers.

---

**Welcome to Re-New. Let's empower entrepreneurs to acquire their future.** 🚀

---

*Last updated: 2024-11-12*
*Maintained by: Re-New Team*
*System version: 3.0 (Platform-focused)*