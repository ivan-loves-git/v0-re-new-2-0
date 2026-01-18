# Re-New Platform V1.0 Launch Recap & Roadmap

**Purpose:** Synthesized summary for Bertrand & Amelie based on the Jan 18 meeting and current project status.
**Date:** January 18, 2026
**Author:** Ivan (Platform Lead)

---

## RE-NEW CONTEXT

**Main Website:** https://re-new.team
**Platform (In Development):** app.re-new.team (to be configured)
**GitHub Repo:** ivan-loves-git/v0-re-new-2-0
**Current Vercel URL:** v0-re-new-2-0.vercel.app

**What Re-New Does:**
- Europe's premier SME acquisition acceleration programme
- Helps executives transition into business ownership
- 4-stage process: Profile Assessment -> Deal Sourcing -> Acquisition Support -> Post-Acquisition Mentoring
- Network of 9 strategic partners, 1,500+ acquisition opportunities

---

## EXECUTIVE SUMMARY

**Target: January 23rd Go-Live for Public Intake Form**

The platform is technically ~95% ready. What's blocking go-live is NOT code, it's content and decisions from the founders.

### Current Status At a Glance

| Area | Status | Blocker |
|------|--------|---------|
| Platform Infrastructure | DONE | - |
| Authentication System | DONE | Better Auth migration completed |
| Intake Form (Questionnaire) | READY (tech) | Waiting for final question list |
| Email Sending | READY (tech) | Waiting for email templates |
| Scoring System | DONE | - |
| Dashboard & CRM | DONE | - |
| Branding (Logo, URL) | PENDING | Collaborative work needed |

---

## THREE WORKSTREAMS FOR V1.0

### Stream 1: Questionnaire Finalization

**Owner:** Bertrand + Amelie
**Deadline:** Wednesday, Jan 22nd
**Status:** Founders to finalize

**What's needed:**
1. Final list of questions organized in 3 buckets:
   - **Bucket 1:** Basic data (name, email, phone)
   - **Bucket 2:** Profile quality (experience, leadership, M&A knowledge)
   - **Bucket 3:** Readiness indicators (training, funding, letter de cadrage status)

2. Decision on **Letter de Cadrage** handling:
   - If candidate has LDC: ask to upload it (10 points auto-scored)
   - If no LDC: skip those questions

**Deliverable format:** Excel/spreadsheet with:
- Question text (French)
- Question type (yes/no, dropdown, multi-select, free text)
- Scoring weight (if applicable)
- Which stage triggers this question (all / only if LDC exists)

**Ivan's action:** Once received, implement within 24-48 hours.

---

### Stream 2: Email Templates

**Owner:** Bertrand + Amelie
**Deadline:** By Friday, Jan 24th (can be after go-live)
**Status:** Founders to draft

**Email types needed:**
1. **Welcome Email** (after questionnaire submission)
2. **Qualification Email** (when marked as "Qualified")
3. **Interview Invitation** (booking link)
4. **Offer Proposal** (when offer assigned)
5. **Follow-up Reminder** (if no response to offer)

**Format:** Plain text is preferred (no fancy HTML). This avoids spam filters and feels more personal.

**Note from meeting:** Email automation is nice-to-have, not a blocker for go-live. Manual sending works fine for the first 50 candidates.

---

### Stream 3: Look & Feel (Logo + URL)

**Owner:** Collaborative (Ivan + Founders)
**Deadline:** Before public launch
**Status:** Needs coordination

**Tasks:**
1. **Logo:** Provide logo file for questionnaire header
2. **URL:** Options:
   - Keep current: `v0-re-new-2-0.vercel.app/intake` (free, works now)
   - Custom domain: `app.renew.fr/intake` (needs DNS setup + Vercel config)
3. **Colors/Branding:** Currently blue theme, adjust if needed

**Action:** Founders to share logo and decide on URL preference.

---

## FOURTH STREAM: AI Intelligence (V1.5)

**Owner:** Ivan
**Status:** Waiting for Anthropic account
**Cost:** ~$100/month experimentation budget

**What AI can enable:**
- Automated scoring of CV/Letter de Cadrage uploads
- AI-drafted personalized emails based on candidate profile
- Smart matching between candidates and offers

**Founders' action:** Create Anthropic account, add payment, share API key with Ivan.

---

## COMPLETED FEATURES (What's Already Working)

From the 38 tasks in the project, **36 are complete**:

| Feature | Status |
|---------|--------|
| Dashboard with stats, charts, heatmap | DONE |
| Repreneur list with grouping by status | DONE |
| Kanban pipeline view | DONE |
| Repreneur detail pages | DONE |
| Tier 1 automated scoring (15 questions) | DONE |
| Tier 2 manual star rating | DONE |
| Notes system (call/email/meeting types) | DONE |
| Activity tracking | DONE |
| Offer management & milestones | DONE |
| Journey stage progression | DONE |
| CV & Letter de Cadrage uploads | DONE |
| Avatar system | DONE |
| Email sending (manual trigger) | DONE |
| Public intake form (questionnaire) | DONE |
| Radar chart for candidate visualization | DONE |
| Skeleton loading & animations | DONE |

---

## PENDING TASKS (After V1.0)

### Task 51: Milestone & Stage Labels Review
**Priority:** High
**When:** After go-live, based on user feedback
**What:** Review naming of journey stages and milestones with Bertrand

### Task 52: Intermediary Portal
**Priority:** High (V2.0)
**When:** After V1.0 stable
**What:** Anonymous candidate view for M&A brokers/intermediaries

### Task 53: Deal Marketplace
**Priority:** High (V2.0)
**When:** After intermediary portal
**What:** Allow sellers to post deals, candidates to browse/match

---

## VISUAL TIMELINE

```
     JANUARY 2026
     ============

     Week of Jan 20-24              Week of Jan 27-31
     -----------------              -----------------

     Mon 20 +-- Questionnaire       Mon 27 +-- Polish & fix
            |   workshop                    |   issues
            |   (B+A)                       |
     Tue 21 +-- Continue            Tue 28 +-- Testing with
            |   workshop                    |   real users
            |                               |
     Wed 22 +-- DELIVERABLE:        Wed 29 +-- Collect
            |   Final questionnaire         |   feedback
            |   spec (B->I)                 |
     Thu 23 +-- Ivan implements     Thu 30 +-- Iterate
            |   questionnaire               |
            |                               |
     Fri 24 +-- Domain setup        Fri 31 +-- V1.0 READY
            |   Welcome email               |   FOR LAUNCH
            |   Review meeting              |
            v                               v

     ======================================================

     FEBRUARY 2026
     =============

     Week 1: GO-LIVE *
     +-- Public intake form live on app.re-new.team
     +-- LinkedIn announcement
     +-- Monitor incoming applications

     Week 2-4: V1.5 Planning
     +-- AI integration testing (if Anthropic account ready)
     +-- Flatchr data import
     +-- Milestone/stage label review (Task 51)
```

### Go-Live Criteria (MINIMUM for public launch)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Custom domain (app.re-new.team) | PENDING | Bertrand owns re-new.team |
| Final questionnaire implemented | PENDING | Waiting for spec |
| Welcome email (automated) | PENDING | Template needed from founders |
| Logo on intake form | PENDING | Need logo file |
| Platform stable | DONE | - |

---

## RECOMMENDED TIMELINE (Table Format)

| Date | Milestone | Owner |
|------|-----------|-------|
| Jan 18 (Sat) | Recap meeting done | All |
| Jan 20 (Mon) | Questionnaire workshop | Bertrand + Amelie |
| Jan 22 (Wed) | Final questionnaire delivered | Founders |
| Jan 23 (Thu) | Ivan implements questionnaire | Ivan |
| Jan 24 (Fri) | Domain setup + Welcome email + Review meeting | All |
| Jan 27-31 | Polish, testing, collect feedback | Ivan |
| Feb 3 (Mon) | **GO-LIVE** - Public intake form | All |
| Feb 10+ | V1.5 (AI intelligence) + V2.0 planning | Ivan |

---

## ACTION ITEMS FOR FOUNDERS

### Immediate (By Monday Jan 20)
1. Schedule questionnaire workshop with Amelie and Antoine
2. (Optional) Create Anthropic account for AI features

### By Wednesday Jan 22
3. Deliver final questionnaire spec (Excel format)
4. Decide on URL (keep current or custom domain)
5. Provide logo file for intake form header

### By Friday Jan 24
6. Draft 3-5 email templates (plain text)
7. Test intake form and provide feedback

---

## KEY MEETING DECISIONS CAPTURED

1. **Questionnaire structure:** 3 buckets (data, quality, readiness) - no questions requiring preparation (like "write your thesis")

2. **Email approach:** Keep simple, don't over-engineer. Manual sending is fine for V1.0.

3. **AI intelligence:** Worth exploring but V1.5 scope, not V1.0 blocker.

4. **Intermediary portal:** Good idea (Nacho's suggestion), but V2.0 scope.

5. **60/40 effort split:** 60% of V1.0 work is on founders (content), 40% is technical (Ivan).

---

## CLARIFICATIONS FROM IVAN

1. **Domain:** Vercel URL is fine for testing, but a proper domain (e.g., `app.renew.team`) is required before public go-live. This needs to be set up.

2. **Flatchr migration:** Pending but minimal task. Bertrand provides CSV, Ivan imports.

3. **Document sharing:** This recap will be shared with founders to coordinate work.

---

## OPEN DECISIONS FOR FOUNDERS

### Domain Name
**Decision:** Use `app.re-new.team` (subdomain of existing re-new.team)

**Bertrand owns re-new.team** - the main website is already live at https://re-new.team

**Technical steps for Ivan:**
1. Ask Bertrand for DNS access (Cloudflare, OVH, or wherever domain is registered)
2. Add CNAME record: `app` -> `cname.vercel-dns.com`
3. Configure custom domain in Vercel dashboard
4. SSL certificate: automatic via Vercel

**Timeline:** 1-2 hours once DNS access is available

### Questionnaire Content
**Question:** The questionnaire workshop is scheduled for Monday. Here's what Ivan needs as output:

| Field | Example |
|-------|---------|
| Question ID | Q1, Q2, Q3... |
| Question text (FR) | "Avez-vous deja realise une acquisition d'entreprise?" |
| Type | yes_no / dropdown / multi_select / text / file_upload |
| Options (if dropdown/multi) | "Oui, Partiel, Non" |
| Scoring points | 10 points if "Oui" |
| Condition | Always / Only if LDC exists |

### Email Communication Strategy
**Question:** What's the communication style for emails?
- **Formal/Professional** ("Cher Monsieur...")
- **Friendly/Casual** ("Bonjour Jean-Paul...")
- **Mix** (professional but warm)

**Note:** From meeting, Bertrand prefers simple text emails over HTML to avoid spam filters.

---

## FINAL CHECKLIST FOR GO-LIVE

### From Founders (Bertrand + Amelie)

- [ ] **Mon Jan 20:** Start questionnaire workshop
- [ ] **Wed Jan 22:** Deliver final questionnaire spec (Excel/spreadsheet format)
- [ ] **Wed Jan 22:** Provide logo file for intake form
- [ ] **Fri Jan 24:** Provide DNS access for app.re-new.team subdomain
- [ ] **Fri Jan 24:** Deliver welcome email template (plain text)
- [ ] **Fri Jan 24:** Provide Flatchr CSV export (for data import)
- [ ] **(Optional)** Create Anthropic account for AI features

### From Ivan (Platform Lead)

- [x] Better Auth migration completed
- [ ] Implement final questionnaire (Thu Jan 23)
- [ ] Configure app.re-new.team domain (Fri Jan 24)
- [ ] Implement welcome email automation (Fri Jan 24)
- [ ] Import Flatchr data (Week of Jan 27)
- [ ] Polish and testing (Jan 27-31)

### Joint Review

- [ ] **Fri Jan 24:** Review meeting - validate questionnaire and domain
- [ ] **Fri Jan 31:** Final review before go-live
- [ ] **Mon Feb 3:** GO-LIVE - Public intake form

---

## DOCUMENT END

*This document serves as the coordination guide for Re-New Platform V1.0 launch. Updates will be made as progress occurs.*

**Last updated:** January 18, 2026
