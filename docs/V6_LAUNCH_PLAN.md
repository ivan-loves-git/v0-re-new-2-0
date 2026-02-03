# Re-New Platform: V1.0 Launch Guide

**Following our January 18th alignment meeting**

---

## Platform Status & Launch Plan

This document summarizes our mid-January alignment on the Re-New platform. It covers current status, what's needed from each team member, and the timeline to go-live.

**Summary:** Platform development is 95% complete. The path to launch depends on finalizing the questionnaire content and a few configuration decisions.

```
RE-NEW V1.0 LAUNCH TIMELINE                                                        TARGET: FEB 10
══════════════════════════════════════════════════════════════════════════════════════════════════

            WEEK 1: FOUNDERS         WEEK 2: IVAN BUILDS        WEEK 3: JOINT TEST        LAUNCH
            Jan 20-24                Jan 27-31                  Feb 3-7                   Feb 10
            ─────────────────────────┼──────────────────────────┼─────────────────────────┼───────
                                     │                          │                         │
FOUNDERS    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│░░░░░░░░░░░░░             │                         │
            Questionnaire Workshop   │ Email Templates          │                         │
            + Scoring Validation     │ + DNS Access             │                         │
            Due: Notion spec Wed 22  │ Due: Templates Fri 31    │                         │
                                     │                          │                         │
IVAN                                 │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
                                     │ Implement Questionnaire  │ Polish + Test           │
                                     │ + Domain Setup           │ + Flatchr Import        │
                                     │ Due: Form live Wed 29    │ Due: Ready Fri 7        │
                                     │                          │                         │
JOINT                           ◆    │                     ◆    │                    ◆    │  ★
                             Review  │                  Review  │                 Final   │ LIVE
                             Fri 24  │                  Fri 31  │                 Fri 7   │

══════════════════════════════════════════════════════════════════════════════════════════════════
LEGEND:  ▓▓▓▓ = Critical path    ░░░░ = Parallel work    ◆ = Review Meeting    ★ = Go-Live
```

*See detailed weekly breakdown at end of document.*

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

**Target: February 10th - Public launch of the intake questionnaire**

A candidate visits `app.re-new.team/welcome`, completes the questionnaire, and enters the Re-New pipeline. The team sees them in the dashboard, reviews their score, and begins the relationship.

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

#### Why This Matters

The questionnaire is the highest-leverage decision in the entire launch. Every question you add creates friction. Friction loses candidates. A 20-question form that takes 15 minutes will lose 60% of applicants compared to a 10-question form that takes 5 minutes.

But you also need enough information to qualify leads. The tension is real.

#### What To Do

Finalize the question list in the Notion template. Three buckets:

1. **Basic data:** Name, email, phone. Non-negotiable.
2. **Profile quality:** Experience level, leadership history, M&A exposure. These determine if someone is a fit.
3. **Readiness indicators:** Have they done training? Secured funding? Have a Letter de Cadrage?

For Letter de Cadrage: if they have one, ask them to upload it (auto-scores 10 points). If not, skip those questions entirely.

#### Where To Be Careful

- **No questions requiring preparation.** If answering requires them to go find a document or think for 10 minutes, they'll abandon. Save those for follow-up conversations.
- **Once live, structure changes are costly.** Adding a question later is fine. Changing the fundamental data model is not. Get the buckets right now.

**Deliverable:** Complete the questionnaire template in Notion:
https://www.notion.so/2ec36d8dca888099bd06e458acbbb554

---

### Stream 2: Email Templates

**Owner:** Bertrand + Amelie
**Deadline:** Friday, Jan 31st

#### Why This Matters

Emails are how you maintain the relationship after intake. But here's the strategic reality: this is a simple self-made CRM, not Mailchimp. The real email power will come from AI integration in V1.5, where the platform can draft personalized messages based on each candidate's profile.

For V1.0, the goal is simpler: **confirm templates work, test reliability, iterate.**

#### What To Do

Draft 5 email templates:

1. **Welcome Email** - after questionnaire submission
2. **Qualification Email** - when marked as "Qualified"
3. **Interview Invitation** - booking link
4. **Offer Proposal** - when offer assigned
5. **Follow-up Reminder** - if no response

HTML formatting is fine. Keep it clean: logo, clear text, one call-to-action per email.

#### Where To Be Careful

- **Don't over-engineer automation.** Manual sending is fine for the first 50 candidates. Focus on getting the content right, not the triggers.
- **Test deliverability.** Send test emails to different providers (Gmail, Outlook, corporate). Check spam folders.
- **Keep templates simple.** Complex HTML breaks in email clients. Logo + text + button is enough.

---

### Stream 3: Domain & Branding

**Owner:** Bertrand (DNS) + Ivan (setup)
**Deadline:** Friday, Jan 31st

#### Why This Matters

The intake form is the first impression of Re-New's digital presence. A URL like `v0-re-new-2-0.vercel.app` looks amateur. `app.re-new.team` signals professionalism.

This is the facade. What candidates see before they've decided to engage.

#### What To Do

| Item | Status |
|------|--------|
| Logo on intake form | DONE |
| Custom domain (app.re-new.team) | Pending - Bertrand to provide DNS access |

**For domain setup:** Bertrand logs into domain registrar (OVH, Gandi, Cloudflare) and either shares access with Ivan OR adds CNAME record: `app` pointing to `cname.vercel-dns.com`. Ivan handles the rest.

#### Where To Be Careful

- **DNS changes take time to propagate.** Do this early in the week, not Friday.
- **SSL certificate activates automatically** once DNS is configured. No action needed.

---

### Stream 4: Platform Consolidation

**Owner:** Bertrand + Amelie (review) + Ivan (implementation)
**Deadline:** Friday, Jan 31st

#### Why This Matters

The platform was built based on assumptions about how Re-New works. Some of those assumptions need validation. Before going live, founders should scrutinize what exists and decide: keep as-is, refine, or remove.

This is as important as the questionnaire. The questionnaire defines what data comes IN. This stream defines how that data is USED.

#### What To Do

**1. Milestone Definitions (Priority)**

The platform tracks candidates through journey stages with milestones. Current stage names and milestone definitions may not match how Re-New actually thinks about the candidate journey.

Review and confirm:
- Are the stage names right? (Lead → Qualified → Client)
- Are the milestones meaningful? (First call done, Letter de Cadrage received, etc.)
- Should milestone validation be manual or automatic?

**Recommendation:** Keep milestone validation MANUAL (human clicks checkbox). Even for file uploads like LDC, manual review is safer. Effort is minimal (one click) but prevents automation errors and maintains quality control.

**2. Feature Evaluation**

Some features were built as drafts and need validation. For each, decide: useful as-is, needs refinement, or remove entirely.

| Feature | Current State | Decision Needed |
|---------|---------------|-----------------|
| Notes system | Basic (call/email/meeting types) | Keep/Refine/Remove? |
| Activity tracking | Logs all actions | Useful or noise? |
| Offers system | Links offers to candidates | Matches your workflow? |

It's OK to leave everything unchanged. But if something doesn't fit how you actually work, better to know now than after launch.

#### Where To Be Careful

- **Don't overthink it.** If unsure, keep the feature. You can always remove later.
- **Test with real scenarios.** Walk through an actual candidate journey in the platform during Week 3.

---

## AI Intelligence (V1.5 - After Launch)

**Owner:** Ivan
**Status:** Waiting for Anthropic account
**Budget:** $100 initial (one-time to assess costs and experiment)

**What AI can enable:**
- Automated scoring of CV/Letter de Cadrage uploads
- AI-drafted personalized emails based on candidate profile
- Smart matching between candidates and offers

**Strategic Note:** AI is explicitly V1.5. Don't wait for it to launch V1.0. The platform works today without AI. The intelligence layer is an enhancement, not a requirement.

**Founders' action:** Create Anthropic account, add payment method, share login credentials with Ivan. Ivan extracts API keys, experiments, and returns with cost estimates.

---

## Operational Coordination

For coordinating and orchestrating at an operational level, I have created a task list directly on the Re-New platform:

**[View Tasks on Platform](https://v0-re-new-2-0.vercel.app/tasks)**

Why on the platform? So we can all user-test it together: authorization flows, platform capabilities, email automation, and general functionality. This reduces the chance of errors when real users arrive.

This document provides strategic context. The task system provides operational execution.

---

## After V1.0

Once V1.0 is live and stable, two directions open up.

**AI Intelligence (V1.5)**

With the Anthropic account in place, we'll quickly experiment with adding intelligence to the platform. The goal is to test costs and benefits: Can AI meaningfully score uploaded documents? Can it draft personalized emails that save time without losing quality? This is exploratory work. We'll run small experiments, measure what works, and decide what to productize.

**Major Platform Expansions (V2.0+)**

Larger opportunities exist but require separate strategic discussion. These don't impact V1.0 and will be addressed in their own planning cycle:

- **Opening to intermediaries:** An anonymized portal where M&A brokers can browse qualified candidates. This turns Re-New's qualification work into a visible, sellable asset.
- **Opening to candidates:** A self-service layer where repreneurs access training resources, track their own progress, or browse available deals.
- **Deal marketplace:** Sellers post opportunities, candidates browse and express interest, Re-New facilitates matching.

Each of these is a significant product decision with its own timeline, costs, and strategic implications. They will be discussed when V1.0 proves stable and the team has bandwidth to think bigger.

---

## Reference Documents

- **Questionnaire Template (Notion):** https://www.notion.so/2ec36d8dca888099bd06e458acbbb554
- **Task Management (Platform):** https://v0-re-new-2-0.vercel.app/tasks
- **Current Platform:** https://v0-re-new-2-0.vercel.app
- **Re-New Website:** https://re-new.team

---

## Detailed Weekly Breakdown

```
══════════════════════════════════════════════════════════════════════════════════════════════════
                                    DETAILED WEEKLY BREAKDOWN
══════════════════════════════════════════════════════════════════════════════════════════════════



WEEK 1: FOUNDERS DEFINE                                                                Jan 20-24
──────────────────────────────────────────────────────────────────────────────────────────────────

TIMELINE      Mon 20 ─────────── Tue 21 ─────────── Wed 22 ─────────── Thu 23 ─────────── Fri 24
                 │                                     │                                     │
              Workshop                              SPEC DUE                              REVIEW
               Starts                                                                    MEETING

DELIVERABLES                                        DUE         OWNER       STATUS       NOTES
──────────────────────────────────────────────────────────────────────────────────────────────────
Questionnaire spec (Notion template)                Wed 22      B+A         □            Critical path
Scoring weights validated                           Wed 22      B+A         □            For implementation
Journey stage names confirmed                       Fri 24      B           □            Review in meeting
LDC handling decision                               Wed 22      B+A         □            10 pts if uploaded

◆ CHECKPOINT Fri 24: Review meeting — Confirm spec complete, ready for Ivan to implement



──────────────────────────────────────────────────────────────────────────────────────────────────
WEEK 2: IVAN BUILDS                                                                    Jan 27-31
──────────────────────────────────────────────────────────────────────────────────────────────────

TIMELINE      Mon 27 ─────────── Tue 28 ─────────── Wed 29 ─────────── Thu 30 ─────────── Fri 31
                 │                                     │                                     │
             IMPLEMENT                              DOMAIN                               REVIEW
              STARTS                                 LIVE                               MEETING

DELIVERABLES                                        DUE         OWNER       STATUS       NOTES
──────────────────────────────────────────────────────────────────────────────────────────────────
Questionnaire implemented                           Wed 29      Ivan        □            Based on spec
Domain app.re-new.team configured                   Fri 31      Ivan        □            Needs DNS access
Welcome email automation                            Fri 31      Ivan        □            Plain text format
DNS access provided                                 Mon 27      B           □            CNAME to Vercel
Email templates drafted                             Fri 31      B+A         □            5 templates needed
Flatchr CSV exported                                Fri 31      B           □            For Week 3 import

◆ CHECKPOINT Fri 31: Review meeting — Confirm form live and working on custom domain



──────────────────────────────────────────────────────────────────────────────────────────────────
WEEK 3: JOINT TESTING                                                                   Feb 3-7
──────────────────────────────────────────────────────────────────────────────────────────────────

TIMELINE      Mon 3 ──────────── Tue 4 ──────────── Wed 5 ──────────── Thu 6 ──────────── Fri 7
                 │                                     │                                     │
             FLATCHR                               USABILITY                              FINAL
              IMPORT                                TESTS                                CHECK

DELIVERABLES                                        DUE         OWNER       STATUS       NOTES
──────────────────────────────────────────────────────────────────────────────────────────────────
Flatchr historical data imported                    Mon 3       Ivan        □            From CSV export
Intake form usability tested                        Wed 5       B+A         □            Test full flow
Email automation verified                           Wed 5       Ivan        □            Send test emails
Journey stages reviewed                             Thu 6       All         □            Confirm names
Notes/Activity features validated                   Thu 6       All         □            Keep or remove?
All issues fixed                                    Fri 7       Ivan        □            Final polish

◆ CHECKPOINT Fri 7: Final sign-off from Bertrand — Ready for go-live



──────────────────────────────────────────────────────────────────────────────────────────────────
GO-LIVE: FEBRUARY 10                                                                       ★ ★ ★
──────────────────────────────────────────────────────────────────────────────────────────────────

GO-LIVE CHECKLIST                                                                      STATUS
──────────────────────────────────────────────────────────────────────────────────────────────────
Questionnaire live and tested on app.re-new.team/welcome                               □
Domain app.re-new.team working with SSL certificate                                    □
Welcome email sends correctly after form submission                                    □
Flatchr historical candidates imported into platform                                   □
Team trained on dashboard usage                                                        □
Final sign-off from Bertrand                                                           □

══════════════════════════════════════════════════════════════════════════════════════════════════
```


