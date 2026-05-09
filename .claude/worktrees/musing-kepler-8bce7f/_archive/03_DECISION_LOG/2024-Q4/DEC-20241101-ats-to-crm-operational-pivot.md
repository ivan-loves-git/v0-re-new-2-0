# DEC-20241101: "ATS is Dead, CRM is the Future" - Operational Paradigm Shift

**Date:** Early November 2024 (estimated Nov 1-5)
**Deciders:** Amelie, Bertrand (operational leads), with Ivan input
**Status:** ✅ Decided & Implementing

---

## 🎯 Decision

Re-New will **discontinue ATS (Applicant Tracking System) approach** to managing participants and will **implement CRM (Customer Relationship Management) system** instead. This reflects strategic pivot: Re-New is not recruiting employees (candidates) but rather managing entrepreneurs (repreneurs) who are simultaneously customers (buying services) and products (being sold to partners).

**Operational change:** From campaign-focused selection process → relationship-driven service delivery model

---

## 🤔 Context

### Problem Statement

Current Airtable setup is structured like an ATS (applicant tracking for hiring), which focuses on:
- Resume screening
- Scoring and ranking applicants
- Pass/fail selection decisions
- Campaign cohort management

But Re-New's actual business is:
- Long-term relationship management with repreneurs (months/years)
- Service delivery tracking (coaching, intros, deal flow)
- Multi-sided monetization (partner commissions + repreneur fees)
- Managing 35+ active relationships with growing pipeline

**The mismatch is creating operational chaos.**

### Background

**Campaign #2 Learnings:**

Amelie: *"The major outcome of the campaign is... we are not dealing with candidates actually, because we do not provide any kind of job opportunities. We are dealing with repreneurs."*

Key insights:
- Campaign is **marketing tool** (1-2x/year for buzz), not core business
- Real value: Ongoing relationships, not one-time selection
- Interviews shifted from "HR screening" to "consultative conversations"
- Repreneurs challenge Re-New, ask what services they provide
- Campaign #2 revealed: Scoring/matching resumes "we don't give a shit" (Amelie)
- What matters: Lead de Cadrage (project profile) + relationship tracking

**Bertrand's Scalability Crisis:**

Managing 35+ active repreneurs manually:
- 8 Campaign #2 follow-ups
- 4 Campaign #2 finalists
- 10 from previous campaign
- 6 very promising (meeting next week)
- 10+ from recent meetings
- Plus 35+ in pipeline to meet

**Current tools (Airtable ATS-style):**
- Multiple tabs: List A, List B, List C, Bronze, Silver, Out of Campaign, Follow-up
- **Amelie:** "We cannot keep on working like this. This is not okay. The follow-up is a mess."

### Constraints

- **Time:** Bertrand can't scale with current manual process
- **Revenue:** Need to monetize soon; CRM enables service delivery tracking
- **Data:** ATS doesn't track what matters (services delivered, relationship history, monetization status)
- **Tool familiarity:** Airtable experience (current tool), considering Airtable CRM module

---

## 🔍 Options Considered

### Option A: Keep ATS, Improve Process

**Description:** Stick with applicant tracking mindset but optimize Airtable structure, better tagging, clearer workflows

**Pros:**
- Familiar (team knows current system)
- Low switching cost
- Could work if Re-New returns to pure campaign model

**Cons:**
- Doesn't solve fundamental mismatch (tracking applicants vs. managing customers)
- Won't scale to 50-100+ repreneurs
- Doesn't track service delivery, monetization, partner relationships
- Perpetuates wrong mental model ("selecting candidates" not "serving customers")

**Estimated Effort:** Low (incremental improvement)
**Risk Level:** High (doesn't solve core problem)

### Option B (CHOSEN): Migrate to CRM System

**Description:** Adopt CRM (Customer Relationship Management) platform to manage repreneurs as customers/products, partners as clients, and offers as services

**CRM Structure:**
- **Repreneurs:** Profiles, relationship history, services delivered, monetization status
- **Partners:** M&A firms, brokers, lenders, operating partners (clients who pay commissions)
- **Offers/Services:** Coaching tiers, deal flow access, operating partner support, investment vehicle
- **Activities:** Track actions (intros made, meetings held, deals shared)

**Pros:**
- Aligns with actual business model (relationship management, service delivery)
- Scales to hundreds of repreneurs
- Enables monetization tracking (who pays, how much, for what)
- Standard CRM features: Activity tracking, pipeline management, reporting
- Mental model shift: From "applicant funnel" to "customer journey"

**Cons:**
- Migration effort (data transfer from Airtable ATS to Airtable CRM or new tool)
- Learning curve for team (different workflows)
- Need to define repreneur lifecycle, service catalog, tracking fields
- May require customization for Re-New's unique dual-sided model

**Estimated Effort:** Medium (Airtable CRM = days; custom build = weeks)
**Risk Level:** Low (CRM is proven approach for relationship businesses)

### Option C: Build Custom Platform

**Description:** Ivan builds bespoke system combining CRM + matching automation + marketplace dashboard

**Pros:**
- Perfect fit for Re-New's unique model
- Could include advanced features (AI matching, automated workflows)
- Scalable architecture for long-term growth

**Cons:**
- High effort (weeks to months of development)
- Delays monetization validation (waiting for tools before testing offers)
- May be over-engineered for current needs (35 repreneurs, not 1000)
- Maintenance burden (custom code requires ongoing support)

**Estimated Effort:** High (6-12 weeks minimum)
**Risk Level:** Medium (build before validate)

---

## 💡 Rationale

### Why We Chose CRM (Option B)

**Primary reason:** Re-New's business is relationship management and service delivery, which CRM systems are designed for. ATS is wrong tool for the job.

### Key Factors

1. **Business Model Clarity:** Campaign #2 proved Re-New is not in recruitment business. Repreneurs are:
   - **Customers:** Pay for coaching, deal access, operating partner support
   - **Products:** Sold to partners (M&A firms pay commissions for vetted repreneurs)
   - CRM manages both roles; ATS only handles applicants

2. **Scalability:** Bertrand managing 35+ relationships manually, growing to 50-100+
   - Can't track in spreadsheet: Who needs follow-up? What services delivered? What's monetization status?
   - CRM provides: Activity history, next actions, pipeline views, reporting

3. **Service Delivery:** Re-New's value is ongoing support, not one-time selection
   - Need to track: Coaching sessions held, intros made (lawyers, accountants, M&A firms), deal flow shared
   - ATS doesn't have fields for this; CRM does (activities, notes, custom objects)

4. **Monetization Enablement:** Testing dual revenue model (partner fees + repreneur fees)
   - Need to track: Who's paying, how much, for what services, success fees pending
   - CRM has built-in deal/opportunity tracking; ATS doesn't

5. **Mental Model Shift:** Team still thinking "campaign selection" when reality is "customer onboarding"
   - Tool shapes thinking; CRM reinforces correct mindset
   - Amelie/Bertrand recognize this: "We need to design offers... this is a CRM challenge"

6. **Pragmatic Path:** Test Airtable CRM first (Bertrand has account, familiar interface)
   - Low switching cost (already on Airtable)
   - Can migrate data relatively easily
   - If insufficient, upgrade to HubSpot/Salesforce or build custom later

### Ivan's Challenge & Resolution

**Ivan pushed back:**
> "I understand this tool is crap for what you need. My question is: Is having the technology platform connected to making money? Take 5-10 guys, package an offer, sell it to them. If someone buys, THEN build the dashboard."

**Valid point:** Don't over-invest in technology before validating business model

**Resolution - Parallel Tracks:**
1. **Quick validation:** Bertrand tests pricing with 5-10 repreneurs manually (no tech needed)
2. **CRM implementation:** Set up Airtable CRM to manage delivery at scale
3. **Both happen simultaneously:** Validate willingness to pay while building scalable back-office

**Bertrand's framing (which won the argument):**
> "The most important is business-wise: Where do we land in terms of value proposition? We need to segment and say 'we sell you this, we monetize you like this.' Frame it, sign people up, and then our back-office is our back-office. What matters is that I can deliver and track. If I need to speak every two weeks to this repreneur, I do it and I don't fuck up. I need to do it at scale."

**CRM is enabler for delivery, not solution to business model problem.**

### Assumptions

- Airtable CRM has sufficient features for Re-New's needs (to be validated)
- Team can migrate data from current Airtable ATS structure
- CRM will help Bertrand manage 35+ relationships without dropping balls
- Service offer design will be informed by CRM structure (forces clarity on what's being sold)

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Airtable CRM insufficient for complex dual-sided model | Medium | Medium | Test for 2-4 weeks; if inadequate, upgrade to HubSpot or build custom |
| Team struggles with CRM workflows (learning curve) | Low | Low | Bertrand already familiar with Airtable; CRM simpler than ATS in some ways |
| Migration loses data or creates mess | Low | Medium | Careful data mapping; test with subset before full migration |
| CRM doesn't solve monetization problem (tech won't make people pay) | Medium | High | Parallel validation track; CRM is for delivery, not for creating demand |
| Over-customization (trying to build perfect system) | Medium | Medium | Start simple; iterate based on actual usage; resist feature creep |

---

## 📊 Impact Analysis

### Affected Areas

**Workstreams:**
- [x] Scale & Refine (Nacho, Ivan) - Campaign process changes, data structure for repreneurs
- [x] Monetization (Alex) - CRM tracks revenue, commissions, payment status
- [ ] Expansion - Less direct impact

**CANONICAL Updates Required:**
- [x] `business-model.md` - Update to reflect CRM-enabled service delivery model
- [x] `tools-stack.md` - Add CRM as core operational tool
- [ ] `validation-assumptions.md` - CRM enables testing monetization hypotheses

**Timeline Impact:**
- No delay to monetization testing (parallel tracks)
- CRM setup: 1-2 weeks
- Team training: Days (Airtable familiarity helps)

**Resource Impact:**
- Airtable CRM: Likely $20-50/month (existing Bertrand account may cover)
- Migration time: Amelie + Bertrand 1-2 days
- Potential custom development later: Ivan ICP work if Airtable insufficient

**Dependencies:**
- Service offer design (need to define what's being tracked in CRM)
- Lead de Cadrage form (structured data input for repreneur profiles)
- Partner onboarding process (how M&A firms enter system)

---

## 👥 Stakeholders

### Informed

- [x] Amelie (operations lead, CRM primary user)
- [x] Bertrand (founder, CRM primary user, relationship owner)
- [x] Ivan (technical advisor, may build integrations or custom features)
- [ ] Nacho (analytics, may pull data from CRM)

### Approval Status

- [x] Operational decision: Amelie & Bertrand consensus (Nov 2024)
- [x] Technical advisor input: Ivan provided challenge & pragmatic framing
- [ ] Implementation approved: Test Airtable CRM first (in progress)

---

## ✅ Implementation Plan

### Immediate Actions (This Week)

- [x] Decision documented - @Ivan - Due: Nov 2024 - **Done**
- [ ] Bertrand tests Airtable CRM features/capabilities - @Bertrand - Due: 1 week
- [ ] Define CRM data structure (repreneurs, partners, offers, activities) - @Amelie, @Bertrand - Due: 1 week
- [ ] Design repreneur lifecycle stages (early, quite early, advanced, super advanced) - @Amelie - Due: 1 week

### Short-term Actions (Next 2-4 Weeks)

- [ ] Migrate existing repreneur data from ATS to CRM structure - @Amelie - Due: 2 weeks
- [ ] Create service offer catalog in CRM (coaching, deal flow, operating partners, investment vehicle) - @Bertrand - Due: 3 weeks
- [ ] Set up activity tracking workflows (intro made, meeting held, deal shared) - @Amelie - Due: 3 weeks
- [ ] Train team on CRM usage (if needed beyond Bertrand/Amelie) - @Bertrand - Due: 4 weeks
- [ ] Test with 5-10 active repreneurs (real usage, identify gaps) - @Bertrand - Due: 4 weeks

### Long-term Actions (1-3 Months)

- [ ] Evaluate Airtable CRM effectiveness (sufficient or need upgrade?) - @Amelie, @Bertrand - Due: 6 weeks
- [ ] If insufficient: Evaluate HubSpot, Salesforce, or custom build - @Bertrand, @Ivan - Due: 8 weeks
- [ ] Integrate CRM with other tools (email, calendar, potentially matching system) - @Ivan - Due: 10 weeks
- [ ] Build reporting dashboards (repreneurs by stage, revenue by service, partner activity) - @Nacho, @Ivan - Due: 12 weeks

---

## 📏 Success Criteria

**How will we know this decision was correct?**

**Operational (Must-Have):**
- [ ] Bertrand can manage 50+ repreneurs without dropping follow-ups
- [ ] Any team member can see repreneur history and know "what's next"
- [ ] Service delivery is tracked (coaching sessions, intros made, deal flow shared)
- [ ] Clear visibility: Who's paying, who's not, revenue pipeline

**Strategic (Should-Have):**
- [ ] CRM structure informs offer design (forces clarity on services)
- [ ] Monetization experiments easier to run (track who pays, conversion rates)
- [ ] Partner relationships managed systematically (M&A firms, brokers, operating partners)
- [ ] Data enables analytics (Nacho can report on funnel, engagement, revenue)

**Advanced (Nice-to-Have):**
- [ ] Automated workflows (email sequences, follow-up reminders)
- [ ] Integration with matching system (if built later)
- [ ] Multi-user collaboration (as team grows)

**Review Date:** December 2024 (4-6 weeks after implementation)

**Failure Signal:** If after 6 weeks Bertrand still drowning in manual tracking → CRM not working, need different solution

---

## 🔗 Related Documents

**Source:**
- [Campaign #2 Debrief Meeting - Early Nov 2024](../../04_MEETINGS/weekly-sync/2024-11-early-campaign2-debrief-crm-strategy.md)

**Related Decisions:**
- [DEC-20241101: Dual Monetization Approach](DEC-20241101-dual-monetization-approach.md)
- (To be created: Terminology shift Candidates → Repreneurs)

**CANONICAL Updates:**
- [Business Model](../../00_CANONICAL/strategy/business-model.md) (to be updated)
- [Tools Stack](../../00_CANONICAL/operations/tools-stack.md) (to be updated)

---

## 📝 Notes & Updates

### The "ATS is Dead" Quote

**Amelie's declaration:**
> "ATS is dead, CRM is the future."

Short, memorable, captured paradigm shift. Team immediately understood implication.

### What Gets Measured Gets Managed

**Old ATS metrics:**
- Applicants received
- Scoring distribution
- Selection rate
- Campaign cohort performance

**New CRM metrics:**
- Repreneurs by lifecycle stage
- Services delivered per repreneur
- Revenue per repreneur (actual + pipeline)
- Partner commission deals
- Time invested vs. monetization (ROI per repreneur)

Shifting metrics shifts focus from "how many selected" to "how much value created and captured."

### The 70-Repreneur Challenge

**Bertrand's current pipeline:**
- 35 active (require regular engagement)
- 35 to meet (pipeline conversion)
= 70 total relationships to manage

**Without CRM:** Impossible for one person
**With CRM:** Feasible if processes are systematized, activities tracked, automation for routine tasks

This is the real test of whether CRM decision succeeds.

---

**Decision Owner:** Amelie (CRM implementation lead)
**Last Updated:** November 2024
