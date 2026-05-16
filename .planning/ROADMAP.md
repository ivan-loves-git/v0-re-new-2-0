# Roadmap: Re-New Platform V2

## Overview

June V2 should ship the first usable deal-flow operating layer: opportunity data, basic matching, repreneur opportunity actions, deal progress tracking, document handling, and simple reporting. The roadmap deliberately postpones high-complexity work until the core workflow is validated.

## Phases

- [ ] **Phase 1: Scope Lock and Data Foundation** - Lock the opportunity schema, import path, and staff-side opportunity management.
- [ ] **Phase 2: Core Deal Workflow** - Build matching, repreneur access, interest/reject actions, validated pursuit, stages, NDA/document handling.
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
- [ ] 01-01: Finalize database model and field visibility.
- [ ] 01-02: Build opportunity create/edit/list/detail for staff.
- [ ] 01-03: Build Excel import mapper for source and shared deal-flow files.
- [ ] 01-04: Add basic M&A source/contact fields where required by opportunities.
- [ ] 01-05: Add file attachment storage and staff-side document management.

### Phase 2: Core Deal Workflow

**Goal**: Repreneurs can see anonymized opportunities, express interest or rejection, and staff can validate/manage active pursuits.

**Depends on**: Phase 1.

**Requirements**: MATCH-01, MATCH-02, MATCH-03, REP-01, REP-02, REP-03, REP-04, DEAL-01, DEAL-02, DEAL-03, DEAL-04, NDA-01, NDA-02, DOC-01

**Success Criteria** (what must be TRUE):
1. Staff can see platform-recommended fit plus optional human recommendation.
2. Repreneurs can access only the opportunity information intended for them.
3. Staff can convert interest into a validated active pursuit.
4. Multi-repreneur exposure and active-pursuit lock behave consistently.
5. NDA/document status is visible on the relevant pursuit.

**Plans**: 6 plans

Plans:
- [ ] 02-01: Build structured matching and recommendation fields.
- [ ] 02-02: Build repreneur opportunity access and anonymized opportunity detail.
- [ ] 02-03: Build interest/reject actions and staff notification/review flow.
- [ ] 02-04: Build validated pursuit, active-pursuit lock, and re-open logic when dropped.
- [ ] 02-05: Build deal stage tracking from interest to closed/dropped.
- [ ] 02-06: Build per-opportunity NDA and repreneur document download flow.

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
Phases execute in numeric order: 1 -> 2 -> 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scope Lock and Data Foundation | 0/5 | Not started | - |
| 2. Core Deal Workflow | 0/6 | Not started | - |
| 3. Reporting, Reminders, QA, and Launch Hardening | 0/4 | Not started | - |
