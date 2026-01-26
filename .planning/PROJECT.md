# Wave v2 Launch Readiness

## What This Is

Wave is Re-New's internal management platform for repreneurs — entrepreneurs looking to acquire businesses. Unlike a traditional ATS, Wave treats each repreneur as a long-term client relationship, tracking their journey from initial lead through multiple consulting offers.

This milestone focuses on fixing blockers, polishing rough edges, and launching the v2 questionnaire to the existing candidate pool.

## Core Value

**Get the v2 questionnaire live and usable for mass relaunch.** Existing candidates will refill the questionnaire to build a clean database with complete records (names, emails, scores).

## Requirements

### Validated

<!-- Shipped and confirmed working in existing codebase -->

- ✓ Multi-step intake questionnaire (v2) with WHO/WHEN/NEEDS sections — existing
- ✓ Repreneur profiles with full lifecycle tracking (lead/qualified/client) — existing
- ✓ Tier 1 automatic scoring from questionnaire answers — existing
- ✓ Tier 2 manual star ratings (6 dimensions post-interview) — existing
- ✓ Tier 3 milestone tracking with journey derivation — existing
- ✓ Offer management with repreneur-offer junction tracking — existing
- ✓ Pipeline board with drag-and-drop status management — existing
- ✓ Email sending via Resend with French templates — existing
- ✓ Activity/audit logging for all changes — existing
- ✓ Better Auth for email/password authentication — existing
- ✓ Flatchr data import script — existing

### Active

<!-- Current scope. Building toward these. -->

**Bug Fixes:**
- [ ] Fix file attachment upload (<10 MB files failing with error)
- [ ] Fix admin scoring persistence (edits disappear after re-opening profile)
- [ ] Remove end-of-form scoring page (candidates shouldn't see their scores)

**Scoring Edit Redesign:**
- [ ] Remove old pencil icon that opens legacy questionnaire parameters
- [ ] Remove big questionnaire copy section from profile page
- [ ] Add WHO pencil icon → opens popup with all WHO parameters
- [ ] Add WHEN pencil icon → opens popup with all WHEN parameters
- [ ] Add "Calculate" button in each popup that recalculates and saves score

**Pipeline Improvements:**
- [ ] Lead column sorting by score (highest first)
- [ ] Add "Declined" status as manual action (distinct from "Rejected" = low score)

**Launch Infrastructure:**
- [ ] Acknowledgment email sent immediately on questionnaire submission
- [ ] URL/domain change for questionnaire (app.re-new.team or similar)
- [ ] Duplicate email prevention verification

**Data Hygiene:**
- [ ] Export current database to CSV (snapshot before relaunch)
- [ ] Clean database (remove incomplete/duplicate records)

**Launch Activities (Non-Code):**
- [ ] Team decision: End screen content after questionnaire
- [ ] Team decision: Declined vs Rejected wording
- [ ] Team decision: Final URL for questionnaire
- [ ] Device testing (phones, various screen sizes)
- [ ] File type testing (PDF, Word uploads)
- [ ] Internal tests (~6 before broad send)
- [ ] Candidate communication to relaunch questionnaire (Amelie)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Journey tier label updates (Explorer/Learner/Ready/Serial Acquirer) — address post-launch
- AI-personalized emails with approval workflow — future milestone
- Real-time database duplicate monitoring — handle manually for now
- Cost analytics per client — future milestone
- Client-facing portal — future milestone

## Context

**Current state:**
The v2 questionnaire is built and functional. The pending work is deployment blockers, bug fixes, and polish needed before relaunching to the candidate pool.

**Why the relaunch:**
The Flatchr import lacks emails/phones due to GDPR. Rather than manually patching partial profiles, the team will email existing candidates to refill the 5-minute questionnaire — rebuilding a clean database.

**Data handling:**
Email is the unique identifier. Export current database before cleaning, then compare new submissions against old records for duplicates.

**Team:**
- Ivan: Code (fixes, features, infrastructure)
- Amelie: Content (candidate communication, email copy)
- Bertrand: Testing, admin tasks

## Constraints

- **Timeline**: ~1 week to launch readiness
- **Tech stack**: Next.js 16 + Supabase + Vercel (already deployed)
- **Deployment**: DNS change needed for app.re-new.team
- **Testing**: Minimum 6 internal tests required before broad send
- **GDPR**: Consent required for all email sends, tracked in database

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Relaunch questionnaire to entire pool | Cleaner than patching partial records from Flatchr import | — Pending |
| Email as unique identifier | Prevents duplicate profiles, enables matching old/new | — Pending |
| Manual "Declined" vs automatic "Rejected" | Declined is human action, Rejected is low score threshold | — Pending |
| Remove candidate-facing scoring page | Candidates shouldn't see their raw scores | — Pending |
| Export before clean | Preserve historical data for comparison | — Pending |

---
*Last updated: 2026-01-26 after initialization*
