---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: complete
stopped_at: Phase 4 staff IA and dashboard separation complete
last_updated: "2026-05-17T16:40:00Z"
last_activity: 2026-05-17
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 22
  completed_plans: 22
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** Re-New staff can manage opportunities and confidently connect the right repreneurs to the right deals without Bertrand holding the whole matrix manually.
**Current focus:** June V2 plus Phase 4 staff IA cleanup complete; ready for release monitoring and V3 selection

## Current Position

Phase: 5 of 5 complete
Plan: 22 of 22 complete
Status: Phase 4 staff IA and dashboard separation complete
Last activity: 2026-05-17

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: n/a
- Total execution time: 0 hours

## Quick Tasks Completed

| Date | Task | Result |
|------|------|--------|
| 2026-05-17 | Demo repreneur credentials and access guard | Created/reset `myworkmail4@gmail.com` as a linked demo repreneur user, populated three portal-visible demo matches, and tightened portal access after repreneur deletion. |
| 2026-05-17 | Phase 2 GSD verification gate | Created `02-UAT.md`; build, browser, routing, Supabase API, active-pursuit lock, stage, and NDA/document gate checks passed. |
| 2026-05-17 | Phase 3 operational KPI dashboard | Added internal deal-flow operating KPIs to `/dashboard`; browser UAT showed 15 active intermediaries, 15 active opportunities, 3 introductions, and 1 pending review. |
| 2026-05-17 | Phase 3 opportunity freshness reminders | Added date/month display on opportunity list/detail and a staff-dashboard stale reminder for open opportunities older than 90 days with no active pursuit. |
| 2026-05-17 | Phase 3 end-to-end QA | Created `03-UAT.md`; seeded one marked demo active-pursuit path with seller-meeting stage, signed NDA, approved teaser, and staff-only NDA document. |
| 2026-05-17 | Phase 3 launch/demo checklist | Created launch/demo checklist and V3 deferred backlog; marked June V2 implementation complete. |
| 2026-05-17 | Phase 4 staff IA and dashboard separation | Split staff navigation into Repreneurs and Opportunities, moved repreneur dashboards to `/dashboard_re` and `/analytics_re`, added `/dashboard_op` and `/analytics_op`, and kept archived pages direct-link accessible. |
| 2026-05-18 | Email tools soft expansion | Moved Emails into Tools before Wavy and added `Rep`/future `Opp` template audience metadata to support incremental email automation expansion. |

## Accumulated Context

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Testing Environment and Release Protocol (URGENT)
- Phase 4 added: Staff information architecture and dashboard separation.

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- Bertrand answered several original PDR questions but expanded the target product direction.
- June V2 should be scoped tightly around core validation.
- V3 can follow quickly once basics are validated.
- Ivan initially selected a separate Supabase test project for Phase 1.1.
- Ivan then approved same/current Supabase project testing on 2026-05-17 because another Supabase project adds cost.
- Phase 1.1 is now a controlled same-project migration: additive SQL only, backup/rollback note first, marked UAT data, cleanup plan.
- Phase 1.1 plan 02 completed: opportunity tables applied, private opportunity document bucket created, app runs on port 3011, authenticated `/opportunities` renders marked UAT data.
- Middleware now protects `/opportunities` so unauthenticated requests redirect to login instead of returning 500.
- Phase 1.1 plan 03 completed: browser UAT passed for create, edit, archive, import review, and document visibility/removal using marked UAT records.
- Release recommendation: ready to push/merge after Ivan's acceptance; note existing typecheck baseline risk.
- Ivan accepted the local UAT result on 2026-05-17 and approved push/merge.
- Marked Phase 1.1 UAT opportunities, temporary UAT users/sessions, and UAT document storage file were removed before push/merge.
- Phase 2 work continues in a fresh worktree branched from merged `origin/main`.
- Phase 2 plan 02-01 completed: `opportunity_matches` stores structured platform recommendation, optional human recommendation, match status, score, and reasons between an opportunity and a repreneur.
- Matching remains structured/manual for June; no hidden AI interpretation was introduced.
- Phase 2 plan 02-02 completed: logged-in repreneurs can access `/my-opportunities` and anonymized opportunity detail only for active non-staff-only opportunities explicitly proposed to their matching repreneur profile.
- Phase 2 UAT data for 02-01 and 02-02 was cleaned after verification.
- Phase 2 plan 02-03 inserted after Ivan clarified that repreneur access must not live inside the staff dashboard shell.
- Phase 2 plan 02-03 completed: repreneur deal access moved to `/portal/deals`, a read-only `/portal/profile` was added, post-login routing now splits staff vs repreneur users, and staff dashboard layout blocks repreneur-role access.
- Quick task completed: `myworkmail4@gmail.com` is a linked demo repreneur login with a populated portal, and deleting a repreneur now removes their repreneur portal role and active sessions.
- Phase 2 plan 02-04 completed: repreneurs can mark a proposed opportunity as interested or not a fit, and staff can review those responses at `/opportunities/reviews` without creating active pursuit yet.
- Phase 2 plan 02-05 completed: staff can validate one interested match into active pursuit, the database blocks a second active pursuit, dropping the active pursuit releases the lock, and dropped matches can be reopened into review.
- Active pursuit also hides non-active matches for the same opportunity from other repreneurs in the portal until the pursuit is dropped.
- Phase 2 plan 02-06 completed: staff can track the active pursuit stage from interest through intermediary meeting, seller meeting, LOI, closed, or dropped, with internal history and safe portal-stage display.
- Phase 2 plan 02-07 completed: staff can track pursuit-level NDA status, link an NDA document, and active repreneurs can download only approved documents once NDA status allows access.
- Phase 2 GSD UAT gate completed on 2026-05-17: no blockers found; Phase 2 is safe to use as the base for Phase 3, but the full June V2 milestone should not be closed until Phase 3 QA and launch readiness are complete.
- Phase 3 plan 03-01 completed: staff dashboard now has an internal deal-flow operating view for active intermediaries, active opportunities, introductions, active pursuits, seller meetings, LOIs, dropped deals, closed deals, current stages, approved documents, and NDA-blocked pursuits.
- Phase 3 plan 03-02 completed: opportunity list/detail now show exact date added and month added, and staff dashboard flags open opportunities older than 90 days when no active pursuit exists.
- Phase 3 plan 03-03 completed: UAT passes after adding a minimal marked demo path for one active pursuit, seller meeting, signed NDA, approved teaser, and staff-only NDA document.
- Phase 3 plan 03-04 completed: launch/demo checklist and V3 deferred backlog are written, and the June V2 implementation is marked complete.
- Phase 4 completed: staff navigation now separates repreneur and opportunity work; legacy `/dashboard` and `/analytics` redirect to repreneur pages; archived Journey, Reviews, Mission, and Instructions are hidden from sidebar but routes remain available.
- Email should now be treated as a shared Tools surface. Current templates are tagged `Rep`; future opportunity automation should add `Opp` templates and context-specific send panels inside the existing `/emails` cockpit instead of creating a parallel page.

### Pending Todos

- Mirror Phase 1.1 into Linear after the protocol is accepted.
- Save the sent 2026-05-16 WhatsApp scope-boundary message in project communications.

### Blockers/Concerns

- June V2 plus Phase 4 IA cleanup is complete; next risk is release monitoring and disciplined V3 selection.
- Phase 3 focused on operating confidence: KPIs, stale reminders, end-to-end QA, and launch/demo readiness.
- Matching must avoid hidden AI scope until structured data is stable.
- M&A CRM must remain basic source/contact tracking in June.
- Phase 2 review remediation completed: email matching is case-insensitive, role precedence is documented, the match status state machine is documented, legacy `/my-opportunities` URLs redirect to `/portal/deals`, and the staff review/recommendation tables received focused UI fixes.
- Phase 3 Reporting, Reminders, QA, and Launch Hardening is complete under the Phase 1.1 release protocol.
- Phase 4 was a navigation and route refactor only; no database migration was introduced.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Automation | Automatic PDF teaser parsing | Deferred to V3 | 2026-05-16 |
| CRM | Full M&A firm CRM | Deferred to V3 | 2026-05-16 |
| AI | AI matching and sector interpretation | Deferred to V3 | 2026-05-16 |
| Legal workflow | E-signature | Deferred to V3 | 2026-05-16 |
| Portal | M&A firm portal | Out of V2 | 2026-05-16 |

## Session Continuity

Last session: 2026-05-17T16:40:00Z
Stopped at: Phase 4 staff IA and dashboard separation complete; ready for release monitoring and V3 selection
Resume file: .planning/phases/04-staff-information-architecture-and-dashboard-separation/04-03-SUMMARY.md
