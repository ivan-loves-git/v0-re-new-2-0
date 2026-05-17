# Roadmap: Re-New Platform V2

## Overview

June V2 should ship the first usable deal-flow operating layer: opportunity data, basic matching, repreneur opportunity actions, deal progress tracking, document handling, and simple reporting. The roadmap deliberately postpones high-complexity work until the core workflow is validated.

## Phases

- [x] **Phase 1: Scope Lock and Data Foundation** - Lock the opportunity schema, import path, and staff-side opportunity management. (completed 2026-05-16)
- [x] **Phase 1.1: Testing Environment and Release Protocol** - Set up safe test environment, UAT, and release gates before building more product scope. (completed 2026-05-17)
- [ ] **Phase 2: Core Deal Workflow** - Build matching, separated repreneur portal access, interest/reject actions, validated pursuit, stages, NDA/document handling.
- [ ] **Phase 3: Reporting, Reminders, QA, and Launch Hardening** - Add operational KPIs, stale reminders, end-to-end testing, and launch readiness.

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
- [ ] 02-04: Build interest/reject actions and staff notification/review flow.
- [ ] 02-05: Build validated pursuit, active-pursuit lock, and re-open logic when dropped.
- [ ] 02-06: Build deal stage tracking from interest to closed/dropped.
- [ ] 02-07: Build per-opportunity NDA and repreneur document download flow.

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
- [ ] 03-01: Build operational KPI dashboard.
- [ ] 03-02: Build freshness display and stale-opportunity reminder.
- [ ] 03-03: Run end-to-end QA with sample opportunities, repreneurs, PDFs, NDA states, and stage changes.
- [ ] 03-04: Prepare launch/demo checklist and create V3 deferred backlog.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scope Lock and Data Foundation | 5/5 | Complete   | 2026-05-16 |
| 1.1. Testing Environment and Release Protocol | 3/3 | Complete | 2026-05-17 |
| 2. Core Deal Workflow | 3/7 | In progress | - |
| 3. Reporting, Reminders, QA, and Launch Hardening | 0/4 | Not started | - |
