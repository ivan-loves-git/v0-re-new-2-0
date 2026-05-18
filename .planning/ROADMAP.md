# Roadmap: Re-New Platform V2

## Overview

June V2 should ship the first usable deal-flow operating layer: opportunity data, basic matching, repreneur opportunity actions, deal progress tracking, document handling, and simple reporting. The roadmap deliberately postpones high-complexity work until the core workflow is validated.

## Phases

- [x] **Phase 1: Scope Lock and Data Foundation** - Lock the opportunity schema, import path, and staff-side opportunity management. (completed 2026-05-16)
- [x] **Phase 1.1: Testing Environment and Release Protocol** - Set up safe test environment, UAT, and release gates before building more product scope. (completed 2026-05-17)
- [x] **Phase 2: Core Deal Workflow** - Build matching, separated repreneur portal access, interest/reject actions, validated pursuit, stages, NDA/document handling. (completed 2026-05-17)
- [x] **Phase 3: Reporting, Reminders, QA, and Launch Hardening** - Add operational KPIs, stale reminders, end-to-end testing, and launch readiness. (completed 2026-05-17)
- [x] **Phase 4: Staff Information Architecture and Dashboard Separation** - Split internal staff navigation and dashboards into repreneur and opportunity work surfaces. (completed 2026-05-17)
- [x] **Phase 5: Unified Find and Groups Work Surfaces** - Make repreneur Find/Groups visually coherent and replicate that operating pattern for opportunities. (completed 2026-05-18)
- [x] **Phase 6: M&A Source Directory and Intermediary Email Workflows** - Add an editable source/intermediary directory and broker-facing email template foundations. (completed 2026-05-18)
- [x] **Phase 7: M&A Intermediary Workflow Activation** - Start opportunity-specific intermediary follow-up from the M&A tab using source contacts, templates, sends, and interaction history. (completed 2026-05-18)

## Phase Details

### Phase 1: Scope Lock and Data Foundation

**Goal**: Staff can manage the June opportunity database from locked fields and real samples.

**Depends on**: Nothing.

**Requirements**: OPP-01, OPP-02, OPP-03, OPP-04, OPP-05, MNA-01

**Success Criteria** (what must be TRUE):
1. Staff can create and edit an opportunity with the locked June schema.
2. Existing Excel opportunity data can be imported or mapped without manual re-entry of every field.
3. Staff can attach documents to opportunities.
4. Repreneur-visible and staff-only fields are clearly separated.

**Plans**: 5 plans

Plans:
- [x] 01-01: Finalize database model and field visibility.
- [x] 01-02: Build opportunity create/edit/list/detail for staff.
- [x] 01-03: Build Excel import mapper for source and shared deal-flow files.
- [x] 01-04: Add basic M&A source/contact fields where required by opportunities.
- [x] 01-05: Add file attachment storage and staff-side document management.

### Phase 01.1: Testing Environment and Release Protocol (INSERTED)

**Goal:** Re-New can test Phase 1 in the approved current Supabase project with controlled migration rules, then push/merge/release only after UAT and rollback/cleanup conditions are clear.
**Requirements**: ENV-01, ENV-02, TEST-01, REL-01, REL-02
**Depends on:** Phase 1

**Success Criteria** (what must be TRUE):
1. Testing uses the approved current Supabase project because a separate project would add cost.
2. Codex/Claude can run the worktree app against the approved database without committing secrets.
3. Phase 1 has a concrete UAT checklist and result log.
4. Backup/rollback, UAT cleanup, push, PR, merge, and deploy responsibilities are written in simple language.

**Plans:** 3 plans

Plans:
- [x] 01.1-01: Lock same-project Supabase policy and local env rules.
- [x] 01.1-02: Confirm backup/rollback, apply Phase 1 migrations, and run the worktree app.
- [x] 01.1-03: Complete Phase 1 UAT, classify findings, and prepare PR/merge/release recommendation.

### Phase 2: Core Deal Workflow

**Goal**: Repreneurs can see anonymized opportunities, express interest or rejection, and staff can validate/manage active pursuits.

**Depends on**: Phase 1.

**Requirements**: MATCH-01, MATCH-02, MATCH-03, REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, DEAL-01, DEAL-02, DEAL-03, DEAL-04, NDA-01, NDA-02, DOC-01

**Success Criteria** (what must be TRUE):
1. Staff can see platform-recommended fit plus optional human recommendation.
2. Repreneurs can access only the opportunity information intended for them.
3. Staff can convert interest into a validated active pursuit.
4. Multi-repreneur exposure and active-pursuit lock behave consistently.
5. NDA/document status is visible on the relevant pursuit.

**Plans**: 7 plans

Plans:
- [x] 02-01: Build structured matching and recommendation fields.
- [x] 02-02: Build repreneur opportunity access and anonymized opportunity detail.
- [x] 02-03: Split staff dashboard and repreneur portal routing/profile.
- [x] 02-04: Build interest/reject actions and staff notification/review flow.
- [x] 02-05: Build validated pursuit, active-pursuit lock, and re-open logic when dropped.
- [x] 02-06: Build deal stage tracking from interest to closed/dropped.
- [x] 02-07: Build per-opportunity NDA and repreneur document download flow.

### Phase 3: Reporting, Reminders, QA, and Launch Hardening

**Goal**: The team can operate V2 day to day and demo the June scope with confidence.

**Depends on**: Phase 2.

**Requirements**: FRESH-01, MNA-02, KPI-01, KPI-02

**Success Criteria** (what must be TRUE):
1. Staff can see operational KPIs for deal-flow health.
2. Staff can identify old opportunities and get a simple stale reminder after 3 months.
3. The full staff-to-repreneur-to-staff workflow is tested with realistic data.
4. Deferred V3 scope is visible but not accidentally included in June.

**Plans**: 4 plans

Plans:
- [x] 03-01: Build operational KPI dashboard.
- [x] 03-02: Build freshness display and stale-opportunity reminder.
- [x] 03-03: Run end-to-end QA with sample opportunities, repreneurs, PDFs, NDA states, and stage changes.
- [x] 03-04: Prepare launch/demo checklist and create V3 deferred backlog.

### Phase 4: Staff Information Architecture and Dashboard Separation

**Goal**: Staff can navigate repreneur and opportunity work as separate operating areas, with dashboards and analytics pages that do not blend the two domains.

**Depends on**: Phase 3.

**Requirements**: STAFF-IA-01, DASH-RE-01, DASH-OP-01, ANALYTICS-RE-01, ANALYTICS-OP-01, ARCHIVE-01, REDIRECT-01

**Success Criteria** (what must be TRUE):
1. Sidebar navigation is grouped into `Repreneurs`, `Opportunities`, `Tools`, and `Project`.
2. Existing repreneur dashboard and analytics content live on `/dashboard_re` and `/analytics_re`.
3. Opportunity operations live on `/dashboard_op`, while opportunity KPIs live on `/analytics_op`.
4. Old `/dashboard` and `/analytics` routes redirect to the repreneur equivalents.
5. Archived pages are removed from sidebar navigation but still available by direct URL.

**Plans**: 3 plans

Plans:
- [x] 04-01: Split staff navigation and route redirects.
- [x] 04-02: Separate repreneur and opportunity dashboard/analytics surfaces.
- [x] 04-03: Update roadmap, requirements, GSD summaries, and verification evidence.

### Phase 5: Unified Find and Groups Work Surfaces

**Goal**: Staff can use visually consistent Find and Groups pages for both repreneurs and opportunities, with shared filtering, pagination, grouping, table structure, and journey-first tagging.

**Depends on**: Phase 4.

**Requirements**: UX-01, UX-02, UX-03, UX-04, OPP-JOURNEY-01, OPP-FIND-01, OPP-GROUPS-01

**Success Criteria** (what must be TRUE):
1. Repreneur Groups and Find use a coherent table shell, filter bar, colors, pagination, and tag system while preserving their different jobs.
2. Opportunities gain equivalent Find and Groups pages using the same UX structure and visual language as repreneurs.
3. The derived opportunity journey label is visible as a primary tag in opportunity tables.
4. Opportunity columns are chosen for operating usefulness: reference, journey, source/status, sector/activity, location, size signals, date/freshness, and active pursuit context.
5. Sidebar navigation and page naming make the two domains feel parallel without hiding existing Records or dashboard pages.
6. Browser UAT validates desktop and mobile layouts, filter behavior, grouping, pagination, and row navigation for both domains.

**Plans**: 4 plans

Plans:
- [x] 05-01: Lock shared table, filter, pagination, and journey-label design contract.
- [x] 05-02: Unify repreneur Groups and Find visual structure.
- [x] 05-03: Build opportunity Find and Groups pages from the shared pattern.
- [x] 05-04: Validate UX consistency, responsiveness, and navigation.

### Phase 6: M&A Source Directory and Intermediary Email Workflows

**Goal**: Staff can manage intermediary contacts as first-class opportunity sources and review/test M&A-focused email templates before using them in follow-up workflows.

**Depends on**: Phase 5.

**Requirements**: MNA-DIR-01, MNA-DIR-02, MNA-DIR-03, EMAIL-MA-01, EMAIL-MA-02

**Success Criteria** (what must be TRUE):
1. Staff can open `/opportunities/ma` from the Opportunities sidebar group.
2. The M&A page lists source firms, source type, contact name, email, phone, notes, linked opportunity counts, and stale follow-up signals.
3. Staff can create and edit source/contact records without leaving the page.
4. Existing opportunity `source_label` values are linked to normalized `ma_sources`.
5. Email Tools include reviewable/testable M&A templates for validity checks, missing information, repreneur interest feedback, and process follow-up.
6. M&A templates do not appear in the normal repreneur manual-send flow.

**Plans**: 4 plans

Plans:
- [x] 06-01: Normalize M&A source data and backfill opportunity links.
- [x] 06-02: Build the M&A source directory UI and navigation.
- [x] 06-03: Add intermediary email templates and template review/test support.
- [x] 06-04: Validate build, database state, browser smoke, and documentation.

### Phase 7: M&A Intermediary Workflow Activation

**Goal**: Staff can act on an opportunity's M&A source directly from the opportunity detail page by preparing, sending, and logging intermediary follow-up emails.

**Depends on**: Phase 6.

**Requirements**: MNA-WF-01, MNA-WF-02, MNA-WF-03, MNA-WF-04

**Success Criteria** (what must be TRUE):
1. Staff can open an M&A workflow tab from an opportunity detail page.
2. Staff can select an M&A template and see it prefilled with source, opportunity, and repreneur context.
3. Staff can edit the subject/body before sending to the intermediary contact.
4. Sent intermediary messages are logged against the opportunity and source.
5. The workflow blocks sending when no source email exists and full browser UAT validates template switching, successful send feedback, and interaction history.

**Plans**: 3 plans

Plans:
- [x] 07-01: Add intermediary interaction storage and server workflow actions.
- [x] 07-02: Add opportunity-detail M&A workflow UI.
- [x] 07-03: Run full browser workflow UAT and release review.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scope Lock and Data Foundation | 5/5 | Complete   | 2026-05-16 |
| 1.1. Testing Environment and Release Protocol | 3/3 | Complete | 2026-05-17 |
| 2. Core Deal Workflow | 7/7 | Complete | 2026-05-17 |
| 3. Reporting, Reminders, QA, and Launch Hardening | 4/4 | Complete | 2026-05-17 |
| 4. Staff Information Architecture and Dashboard Separation | 3/3 | Complete | 2026-05-17 |
| 5. Unified Find and Groups Work Surfaces | 4/4 | Complete | 2026-05-18 |
| 6. M&A Source Directory and Intermediary Email Workflows | 4/4 | Complete | 2026-05-18 |
| 7. M&A Intermediary Workflow Activation | 3/3 | Complete | 2026-05-18 |
