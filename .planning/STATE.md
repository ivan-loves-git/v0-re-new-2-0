---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
stopped_at: Phase 9 repreneur profile detail IA refactor completed locally; production verification pending
last_updated: "2026-06-18T00:00:00+02:00"
last_activity: 2026-06-18
progress:
  total_phases: 10
  completed_phases: 10
  total_plans: 39
  completed_plans: 39
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** Re-New staff can manage opportunities and confidently connect the right repreneurs to the right deals without Bertrand holding the whole matrix manually.
**Current focus:** Phase 9 repreneur profile detail IA refactor is complete locally. Production deployment verification remains the next release concern.

## Current Position

Phase: 9 - Repreneur Profile Detail IA Refactor
Plan: 1 of 1 complete locally
Status: Complete locally
Last activity: 2026-06-18

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 39
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
| 2026-05-18 | Internal journey guidelines page | Added `/guide/guidelines` under Project navigation to explain repreneur lifecycle, repreneur readiness journey, opportunity layers, and the derived opportunity journey label. |
| 2026-05-18 | Phase 5 work surface contract | Added the Find/Groups design contract and tested derived opportunity journey helper; KPI work remains separate in another local workstream. |
| 2026-05-18 | Repreneur Find/Groups UX alignment | Aligned `/repreneurs` and `/repreneurs/explore` headers, filters, result counts, pagination reset behavior, and table overflow protection. |
| 2026-05-18 | Opportunity Find/Groups work surfaces | Added `/opportunities/find` and `/opportunities/groups`, sidebar links, derived journey badges, opportunity filters, and grouped deal-flow buckets while preserving `/opportunities` as Records. |
| 2026-05-18 | Phase 5 UX validation | Created `05-UAT.md`; build and journey helper tests passed, route/browser checks passed, and manual pre-deploy smoke checks were recorded for typing/select/mobile interactions. |
| 2026-05-18 | KPI metric system and visible rule-based match scoring | Kept one compact KPI tile system, accepted automatic platform match scoring as the V2 base, made the score visible to staff and repreneurs, added focused scoring tests, and cleaned temporary prototype noise. |
| 2026-05-18 | Visible platform recommendation preview | Restored the Add recommendation form to show automatic platform recommendation, score, and top reasons beside the human recommendation field. |
| 2026-05-18 | Save feedback toast standard | Made the green bottom-right save banner the shared success feedback pattern and removed duplicate inline success feedback from recommendation saves. |
| 2026-05-18 | Opportunity Groups table polish | Split opportunity group tags into clearer colored columns and removed secondary fields from the dense Groups view to harmonize with the Repreneur Groups table. |
| 2026-05-18 | Section page headers and navigation trim | Removed Opportunities Records from sidebar/dashboard promotion, restored plain page titles, and added green Repreneur / purple Opportunity icon headers across dashboard, analytics, groups, and find pages. |
| 2026-05-18 | Phase 6 M&A source directory | Backfilled opportunity source labels into normalized `ma_sources`, added `/opportunities/ma`, created source/contact editing, and seeded four intermediary email templates in Email Tools. |
| 2026-05-18 | Phase 7 M&A workflow activation | Added an opportunity-detail M&A tab that drafts, sends, and logs intermediary follow-up emails from linked source contacts and M&A templates. |
| 2026-05-18 | Phase 7 M&A workflow UAT | Browser-tested template switching, no-email blocking, live send feedback, interaction history refresh, DB logging, and UAT cleanup on production build `10.aec5a6f`. |
| 2026-05-19 | Repreneur-facing portal recovery | Reproduced the production repreneur login with the tester account, added explicit `repreneur_id` linkage for portal roles, added staff-managed enable/resend/disable portal access, and promoted repreneur production UAT to a mandatory release gate. |
| 2026-05-22 | Phase 8 post-demo planning | Added Phase 8 requirements, PRD brief, codebase research, pattern map, five executable plans, and a plan check for founder-demo workflow feedback. |
| 2026-05-22 | Dashboard navigation performance stabilization | Removed dashboard route remount patterns, enabled Cache Components, added cached dashboard snapshots, narrowed data loaders, added loading boundaries and index migrations, measured six authenticated routes, and saved the before/after chart. |
| 2026-05-22 | Phase 8 post-demo workflow MVP | Fixed portal access reliability, added searchable repreneur selectors, enforced Excel-backed opportunity fields, cleaned confusing opportunity/source field names, added bidirectional matching visibility, added info memo pursuit stage, added NDA/info memo M&A request workflow, applied additive database migrations, and passed local production browser UAT. |
| 2026-06-18 | Production QA persona matrix | Added owned QA accounts for staff, populated repreneur, empty repreneur, and unassigned/no-role access; production browser validation passed for login routing, empty portal state, populated portal list, and staff/repreneur boundary redirects. |
| 2026-06-18 | Phase 9 repreneur profile IA refactor | Refactored the staff repreneur profile into a URL-backed six-tab command surface, restored visible qualification radar graphs, preserved legacy questionnaire tab links, and passed local staff browser QA. |

## Accumulated Context

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Testing Environment and Release Protocol (URGENT)
- Phase 4 added: Staff information architecture and dashboard separation.
- Phase 5 added: Unified repreneur Find/Groups UX and equivalent opportunity Find/Groups work surfaces.
- Phase 6 added: M&A source directory and intermediary email workflow foundations.
- Phase 7 added: M&A workflow activation from opportunity details.
- Phase 8 added and completed locally: Post-demo workflow MVP from founder demo feedback, focused on real opportunity creation, matching visibility, NDA/info memo follow-up, and confusing field cleanup.
- Phase 8 navigation stabilization completed before feature execution so the staff app does not add new workflow surface area on top of slow route architecture.
- Phase 9 added: Repreneur profile detail IA refactor, focused on turning the long staff profile page into a tabbed command surface with visible qualification graphs.
- Phase 9 completed locally: staff profile detail now uses Overview, Qualification, Readiness, Opportunities, Engagement, and Timeline tabs with the radar graphs restored in Qualification.

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
- The opportunity journey should be a derived display layer, not a fourth manually edited status field. It summarizes opportunity availability, match status, and pursuit stage for staff scanning.
- Phase 5 should make Repreneur Find and Groups visually coherent first, then replicate that structure for Opportunities with journey-first tags and operating columns.
- Phase 5 plan 05-01 completed: opportunity journey derivation is now implemented and tested in `lib/utils/opportunity-journey.ts`.
- Phase 5 plan 05-02 completed: Repreneur Groups and Find now share the same page rhythm, filter shell, result count pattern, pagination reset behavior, and narrow-screen table protection.
- Phase 5 plan 05-03 completed: Opportunities now have parallel Find and Groups work surfaces with journey-first tags, operating columns, and sidebar access.
- Phase 5 plan 05-04 completed: UAT evidence recorded; implementation is ready for human smoke testing before deployment.
- KPI and matching decision captured on 2026-05-18: simple KPIs should use one compact tile component, and the rule-based platform match score is visible to both staff and repreneurs during V2 while remaining tunable over time.
- The recommendation form should show Platform recommendation as a read-only automatic preview on the left of Human recommendation; automatic must not mean invisible.
- Successful saves should use the shared bottom-right green toast as the primary feedback surface across the platform; inline messages should be reserved for errors, validation, or persistent page state.
- Grouped work-surface tables should keep one tag concept per column where possible; secondary descriptive detail belongs in the detail page or Find view, not the denser Groups view.
- Staff page titles should stay plain. Repreneur vs Opportunity context should be carried by the sidebar group and the colored section-header icon, not by title suffixes.
- The old `/opportunities` records route remains direct-link available, but staff navigation and operational dashboard links should promote `/opportunities/find` for item lookup and `/opportunities/groups` for bucket-level operations.
- M&A intermediaries are now first-class source records in `/opportunities/ma`; V2 remains an internal staff tool, not a full M&A firm portal or large-scale CRM.
- M&A email templates are tagged as opportunity/intermediary templates and are available for review/test in Email Tools, but normal manual sending remains repreneur-only until a dedicated intermediary send workflow is designed.
- Phase 7 plan 07-01 completed: `ma_source_interactions` records intermediary follow-up history, and staff-only server actions can draft/send/log M&A emails from opportunity/source context.
- Phase 7 plan 07-02 completed: opportunity detail pages now include an M&A tab with template selection, editable subject/body, source contact status, send feedback, and interaction history.
- Phase 7 plan 07-03 completed: production browser UAT passed after fixing the client send transport, required interaction metadata, and Better Auth/Supabase Auth `created_by` mismatch for the M&A interaction log.
- Repreneur portal recovery decision on 2026-05-19: portal entry must require an explicit `app_user_roles` repreneur role linked to `repreneur_id`; matching a repreneur email alone is no longer sufficient.
- Repreneur portal recovery decision on 2026-05-19: staff/admin QA cannot be counted as external portal QA. Any release touching access, routing, matches, profile, or documents needs production UAT as a real repreneur user.
- Navigation performance decision on 2026-05-22: dashboard routes should keep a stable shell, use cached server snapshots and narrow loaders, stream or show loading states for dynamic sections, and invalidate cache tags after writes. Do not bring back dashboard route remount wrappers or repeated broad Supabase reads.
- Phase 8 deployment decision on 2026-05-22: opportunity field cleanup uses additive/backfilled canonical columns first and keeps legacy confusing columns as temporary compatibility shims. Drop the legacy columns only after the new production app is live and stable.
- Phase 8 workflow decision on 2026-05-22: `info_memo_received` is a real pursuit stage between interest and intermediary meeting, not an info memo document-storage feature.
- Phase 9 IA decision on 2026-06-18: profile tabs use staff workflow buckets rather than acquisition journey stages. Journey remains a header badge/progress signal.
- Phase 9 IA decision on 2026-06-18: Overview must be a dense command view; Qualification owns WHO/WHEN, Tier 1/Tier 2, leadership assessment, and radar/pentagram-style graphs.
- Phase 9 execution decision on 2026-06-18: legacy `?tab=questionnaire` links resolve to Qualification so old profile links keep working.
- Phase 9 visual QA decision on 2026-06-18: scoring accuracy controls stack vertically inside the narrow Qualification score card to avoid label collision.

### Pending Todos

- Mirror Phase 1.1 into Linear after the protocol is accepted.
- Save the sent 2026-05-16 WhatsApp scope-boundary message in project communications.

### Blockers/Concerns

- Repreneur production UAT must be re-run after the recovery deploy. The previous Phase 3 note that route/data checks were enough for repreneur behavior is superseded.
- Phase 8 still needs production verification after deploy; local production browser UAT passed on `http://localhost:3012`, but production footer build-number verification remains pending.
- Phase 9 still needs production verification after deploy; local staff browser QA passed on `http://localhost:3012`, but production footer build-number verification remains pending.
- Navigation performance branch still needs production verification after deploy; local production browser timing passed.
- `npx tsc --noEmit --pretty false` now runs but fails on pre-existing unrelated baseline issues in `dashboard_re`, `routing`, and `dashboard-snapshots`.
- Phase 8 should not add PDF-to-opportunity AI ingestion or JSON import automation unless the scope is explicitly reopened.
- Phase 7 browser UAT passed; the remaining M&A risk is product/process scope, not the basic send-and-log workflow.
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
| CRM | Full intermediary activity timeline and bulk contact management | Deferred to V3 | 2026-05-18 |
| Automation | ChatGPT JSON opportunity import path | Deferred to V4/backlog | 2026-05-22 |
| Automation | Full PDF-to-opportunity AI ingestion | Deferred beyond Phase 8 | 2026-05-22 |

## Session Continuity

Last session: 2026-05-22T17:14:33+08:00
Stopped at: Phase 8 in progress; navigation performance stabilization completed locally and ready for branch review/deploy
Resume file: .planning/STATE.md
