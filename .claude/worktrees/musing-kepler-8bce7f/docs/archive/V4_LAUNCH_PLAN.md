# Re-New Platform: V1.0 Launch Guide

**Following our January 18th alignment meeting**

---

## The Turning Point

On January 18th, 2026, we met to take stock of where we are and align on the path to launch. This document captures that moment and serves as our shared guide forward.

**The headline:** The platform is built. What remains is not technical work, but strategic decisions from the founders about how Re-New will present itself to the world through this tool.

---

## Where We Are

| Area | Status |
|------|--------|
| Platform Infrastructure | DONE |
| Authentication System | DONE |
| Dashboard & CRM | DONE |
| Intake Form (tech ready) | Waiting for final question list |
| Email System (tech ready) | Waiting for templates |
| Scoring System | DONE |
| Logo on Intake Form | DONE |
| Custom URL | Pending DNS access |

**Platform status:** 95% complete (36/38 tasks). All core features working. The blockers are content decisions, not code.

---

## Where We're Going

**Target: February 3rd - Public launch of the intake questionnaire**

A candidate visits `app.re-new.team/intake`, completes the questionnaire, and enters the Re-New pipeline. The team sees them in the dashboard, reviews their score, and begins the relationship.

This is V1.0: a professional, branded entry point that replaces ad-hoc candidate collection and establishes Re-New's digital presence.

---

## The Critical Path

Everything flows from one decision chain:

```
Questionnaire Design  -->  Scoring Logic  -->  Journey Stages
     (what to ask)        (how to rank)      (how to track)
```

Once founders finalize the questionnaire, Ivan implements it. The scoring weights follow from the questions. The journey stages follow from how candidates progress.

---

## Three Workstreams for V1.0

### Stream 1: Questionnaire Finalization

**Owner:** Bertrand + Amelie
**Deadline:** Wednesday, Jan 22nd

**What's needed:**
1. Final list of questions organized in 3 buckets:
   - **Bucket 1:** Basic data (name, email, phone)
   - **Bucket 2:** Profile quality (experience, leadership, M&A knowledge)
   - **Bucket 3:** Readiness indicators (training, funding, letter de cadrage status)

2. Decision on **Letter de Cadrage** handling:
   - If candidate has LDC: ask to upload it (10 points auto-scored)
   - If no LDC: skip those questions

**Strategic Note:** Every question creates friction. Friction loses candidates. The intake form should capture what you *need* to qualify someone, not everything you *might want* to know. Additional information can be gathered later through follow-ups or interviews. Start lean, add later.

**Deliverable:** Complete the questionnaire template in Notion:
https://www.notion.so/2ec36d8dca888099bd06e458acbbb554

---

### Stream 2: Email Templates

**Owner:** Bertrand + Amelie
**Deadline:** Friday, Jan 24th (can be after go-live)

**Email types needed:**
1. **Welcome Email** - after questionnaire submission
2. **Qualification Email** - when marked as "Qualified"
3. **Interview Invitation** - booking link
4. **Offer Proposal** - when offer assigned
5. **Follow-up Reminder** - if no response

**Format:** Plain text preferred (avoids spam filters, feels more personal).

**Note:** Email automation is nice-to-have, not a blocker. Manual sending works fine for the first 50 candidates.

---

### Stream 3: Domain & Branding

**Owner:** Bertrand (DNS) + Ivan (setup)
**Deadline:** Friday, Jan 24th

| Item | Status |
|------|--------|
| Logo on intake form | DONE |
| Custom domain (app.re-new.team) | Pending - Bertrand to provide DNS access |

**For domain setup:** Bertrand logs into domain registrar (OVH, Gandi, Cloudflare) and either shares access with Ivan OR adds CNAME record: `app` pointing to `cname.vercel-dns.com`. Ivan handles the rest.

---

## Key Design Decisions

### Journey Stages & Milestones

The platform tracks candidates through stages. Current names may need adjustment to match how Re-New thinks about the journey.

**Recommendation:** Keep milestone validation MANUAL (human clicks checkbox). Even for file uploads like LDC, manual review is safer. Effort is minimal (one click) but prevents automation errors and maintains quality control.

### Features to Test with Real Use

Some features were built as drafts and need validation:
- Notes system (call/email/meeting types)
- Activity tracking
- Offers system

Test these in real scenarios during the Jan 27-31 polish period. Either remove if not useful or improve based on feedback.

---

## Fourth Stream: AI Intelligence (V1.5)

**Owner:** Ivan
**Status:** Waiting for Anthropic account
**Cost:** ~$100/month experimentation

**What AI can enable:**
- Automated scoring of CV/Letter de Cadrage uploads
- AI-drafted personalized emails based on candidate profile
- Smart matching between candidates and offers

**Founders' action:** Create Anthropic account, add payment method, share login credentials with Ivan. Ivan will extract the API keys needed.

---

## Operational Coordination

For coordinating and orchestrating at an operational level, I have created a task list directly on the Re-New platform:

**[View Tasks on Platform](https://v0-re-new-2-0.vercel.app/tasks)**

Why on the platform? So we can all user-test it together: authorization flows, platform capabilities, email automation, and general functionality. This reduces the chance of errors when real users arrive.

All deadlines, assignments, and progress tracking happen there. This document provides strategic context; the task system provides operational execution.

---

## Timeline

```
     JANUARY 2026
     ============

     Week of Jan 20-24              Week of Jan 27-31
     -----------------              -----------------

     Mon 20 -- Questionnaire        Mon 27 -- Polish & fix
               workshop (B+A)                 + Test email automation
     Tue 21 -- Continue workshop    Tue 28 -- Testing with real data
     Wed 22 -- DELIVERABLE:         Wed 29 -- Collect feedback
               Final questionnaire            + Journey/milestone review
     Thu 23 -- Ivan implements      Thu 30 -- Iterate
     Fri 24 -- Domain setup         Fri 31 -- V1.0 READY
               + Review meeting

     FEBRUARY 2026
     =============
     Mon Feb 3 -- GO-LIVE: Public intake form on app.re-new.team
```

---

## Go-Live Checklist

| Requirement | Status | Owner |
|-------------|--------|-------|
| Final questionnaire implemented | Pending | Founders (spec) -> Ivan (code) |
| Custom domain configured | Pending | Bertrand (DNS) -> Ivan (setup) |
| Welcome email ready | Pending | Founders (template) -> Ivan (automation) |
| Flatchr data imported | Pending | Bertrand (CSV) -> Ivan (import) |
| Logo on intake form | DONE | - |
| Platform stable | DONE | - |

---

## After V1.0

| Version | Focus | Timeline |
|---------|-------|----------|
| V1.5 | AI intelligence (document scoring, smart emails) | Feb-Mar |
| V2.0 | Intermediary portal (anonymous views for M&A brokers) | Q2 |
| V2.5 | Deal marketplace (sellers post, candidates browse) | Q2-Q3 |

---

## Reference Documents

- **Questionnaire Template (Notion):** https://www.notion.so/2ec36d8dca888099bd06e458acbbb554
- **Task Management (Platform):** https://v0-re-new-2-0.vercel.app/tasks
- **Current Platform:** https://v0-re-new-2-0.vercel.app
- **Re-New Website:** https://re-new.team

---

*This document marks our alignment after January 18th. Strategy is captured here. Tasks are tracked on the platform.*

**Last updated:** January 18, 2026
