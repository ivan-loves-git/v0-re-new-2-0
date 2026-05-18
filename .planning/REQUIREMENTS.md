# Requirements: Re-New Platform V2

**Defined:** 2026-05-16
**Core Value:** Re-New staff can manage opportunities and confidently connect the right repreneurs to the right deals without Bertrand holding the whole matrix manually.

## June V2 Requirements

### Opportunities

- [x] **OPP-01**: Staff can create, edit, and archive opportunities.
- [x] **OPP-02**: Opportunity records include the locked June fields: reference, source, location, sector, description, revenue, EBITDA, headcount, and date added.
- [x] **OPP-03**: Staff can import opportunities from the supplied Excel sources.
- [x] **OPP-04**: Repreneur-visible opportunity fields are anonymized and do not expose M&A firm/source details.
- [x] **OPP-05**: Staff can attach PDFs or deal documents to an opportunity.

### Matching

- [x] **MATCH-01**: Staff can see a platform-recommended match value between an opportunity and repreneurs using structured fields.
- [x] **MATCH-02**: Staff can add or adjust a human recommendation so the platform can evolve with feedback.
- [x] **MATCH-03**: Matching logic uses structured fields first and does not depend on AI interpretation for June.

### Repreneur Access

- [x] **REP-01**: A repreneur can access anonymized opportunities through the platform.
- [x] **REP-02**: A repreneur can express interest in an opportunity.
- [x] **REP-03**: A repreneur can reject or ignore an opportunity without creating staff ambiguity.
- [x] **REP-04**: June access does not imply full repreneur profile editing or advanced self-service.
- [x] **REP-05**: Repreneur access uses a separate external portal route/layout instead of the internal staff dashboard shell.
- [x] **REP-06**: A repreneur can view a read-only profile summary with scores, strengths, improvement points, and calls to action.

### Deal Progress

- [x] **DEAL-01**: Staff can validate when a repreneur is actively pursuing an opportunity.
- [x] **DEAL-02**: Multiple repreneurs can be exposed to the same opportunity before active pursuit is validated.
- [x] **DEAL-03**: Once active pursuit is validated, the opportunity is not exposed to additional repreneurs unless the pursuit drops.
- [x] **DEAL-04**: Staff can track the stages: interest, intermediary meeting, seller meeting, LOI, dropped, closed.

### NDA and Documents

- [x] **NDA-01**: Staff can track whether an opportunity requires a per-opportunity NDA.
- [x] **NDA-02**: Staff can attach or record the NDA document/status for an opportunity-repreneur pursuit.
- [x] **DOC-01**: Repreneurs can download opportunity PDFs that staff choose to expose.

### Freshness and M&A Follow-Up

- [x] **FRESH-01**: Each opportunity shows date added and month added.
- [x] **MNA-01**: Staff can record basic M&A source/contact information needed for the opportunity.
- [x] **MNA-02**: Staff get a simple stale-opportunity reminder after 3 months when nobody is actively pursuing the opportunity.

### M&A Source Directory and Intermediary Emails

- [x] **MNA-DIR-01**: Staff can view M&A sources/intermediaries in a dedicated Opportunities page.
- [x] **MNA-DIR-02**: Staff can create and edit source firm name, source type, contact name, email, phone, and notes.
- [x] **MNA-DIR-03**: Existing opportunity source labels are linked to normalized M&A source records.
- [x] **EMAIL-MA-01**: Email Tools include M&A/intermediary templates for validity checks, information requests, repreneur interest feedback, and process follow-up.
- [x] **EMAIL-MA-02**: M&A/intermediary templates are reviewable and testable without being mixed into repreneur manual sends.

### Reporting

- [x] **KPI-01**: Staff can see operational counts for active intermediaries, opportunities, introductions, seller meetings, LOIs, dropped deals, and closed deals.
- [x] **KPI-02**: Reporting is internal only for June.

### Staff Information Architecture

- [x] **STAFF-IA-01**: Internal staff navigation separates repreneur work from opportunity work with clear sidebar groups.
- [x] **DASH-RE-01**: The repreneur dashboard is available at `/dashboard_re` and contains repreneur pipeline content only.
- [x] **DASH-OP-01**: The opportunity dashboard is available at `/dashboard_op` and focuses on operational opportunity queues and follow-up work.
- [x] **ANALYTICS-RE-01**: Repreneur analytics are available at `/analytics_re`.
- [x] **ANALYTICS-OP-01**: Opportunity KPI reporting is available at `/analytics_op`.
- [x] **ARCHIVE-01**: Journey, opportunity reviews, mission, and instructions are hidden from sidebar navigation while remaining available by direct URL.
- [x] **REDIRECT-01**: Legacy `/dashboard` and `/analytics` routes redirect to the repreneur dashboard and analytics pages.

### Unified Work Surfaces

- [x] **UX-01**: Repreneur Groups and Find share a coherent visual table structure, filter bar, pagination behavior, color system, and tag style.
- [x] **UX-02**: Shared UI patterns are reused or extracted where they reduce meaningful duplication across repreneur and opportunity work surfaces.
- [x] **UX-03**: Find pages prioritize cross-record search and filtering; Groups pages prioritize operating buckets with paginated grouped tables.
- [x] **UX-04**: Desktop and mobile layouts are tested in browser for readable tables, non-overlapping filters, stable pagination, and clear row navigation.
- [x] **OPP-JOURNEY-01**: Opportunities expose a derived journey label from availability status, match status, and pursuit stage instead of storing a fourth manual status.
- [x] **OPP-FIND-01**: Staff can search, filter, sort, and scan opportunities in a Find page that visually matches repreneur Find.
- [x] **OPP-GROUPS-01**: Staff can view opportunities grouped by useful operating buckets, with journey-first tags and clear deal-flow columns.

### Test Environment and Release Protocol

- [x] **ENV-01**: Re-New has a documented test environment policy selecting the same/current Supabase project for controlled Phase 1.1 migration, fake data, and UAT.
- [x] **ENV-02**: The Phase 1 opportunity migrations can be applied to the approved Supabase project after backup/rollback is recorded and additive-only scope is confirmed.
- [x] **TEST-01**: Phase 1 has a written UAT checklist covering opportunity CRUD, import review, staff-only/repreneur-visible separation, source/contact handling, and documents.
- [x] **REL-01**: The release protocol defines when Codex/Claude can push, open a PR, merge, and deploy, including who approves each step.
- [x] **REL-02**: GSD, Linear, and GitHub responsibilities are documented so project memory, team tracking, and code history stay aligned.

## V3 / Deferred Requirements

### Automation and Intelligence

- **AUTO-01**: Parse PDF teasers automatically into opportunity fields.
- **AI-01**: Use AI to interpret sectors and qualitative investment theses.
- **AI-02**: Generate in-platform deal analysis memos.
- **DOC-02**: Read PDFs inline inside the platform.

### External Portals and Advanced Operations

- **MNA-CRM-01**: Build full M&A firm CRM with 300 to 1000 contact support.
- **PORTAL-01**: Give M&A firms portal access.
- **NDA-ESIGN-01**: Add e-signature workflow.
- **REP-SELF-01**: Add full repreneur self-service and profile editing.
- **REPORT-01**: Add polished investor-style reporting.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic teaser parsing | Not needed to validate core June workflow |
| Full M&A CRM | Large surface; basic source/contact tracking is enough |
| AI matching | Requires stable data model and human feedback first |
| E-signature | Legal workflow complexity exceeds June need |
| M&A firm portal | Bertrand confirmed no V2 portal |
| In-platform memo generation | Already defined as V3 |
| Advanced repreneur self-service | Repreneur access must stay read-only/narrow in June |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPP-01, OPP-02, OPP-03, OPP-04, OPP-05 | Phase 1 | Complete |
| MNA-01 | Phase 1 | Complete |
| MATCH-01, MATCH-02, MATCH-03 | Phase 2 | Complete |
| REP-01, REP-04 | Phase 2 | Complete |
| REP-05, REP-06 | Phase 2 | Complete |
| REP-02, REP-03 | Phase 2 | Complete |
| DEAL-01, DEAL-02, DEAL-03 | Phase 2 | Complete |
| DEAL-04 | Phase 2 | Complete |
| NDA-01, NDA-02, DOC-01 | Phase 2 | Complete |
| FRESH-01, MNA-02 | Phase 3 | Complete |
| KPI-01, KPI-02 | Phase 3 | Complete |
| ENV-01, ENV-02, TEST-01, REL-01, REL-02 | Phase 1.1 | Complete |
| STAFF-IA-01, DASH-RE-01, DASH-OP-01, ANALYTICS-RE-01, ANALYTICS-OP-01, ARCHIVE-01, REDIRECT-01 | Phase 4 | Complete |
| UX-01 | Phase 5 | Complete |
| UX-02, UX-03, OPP-FIND-01, OPP-GROUPS-01 | Phase 5 | Complete |
| UX-04 | Phase 5 | Complete |
| OPP-JOURNEY-01 | Phase 5 | Complete |
| MNA-DIR-01, MNA-DIR-02, MNA-DIR-03, EMAIL-MA-01, EMAIL-MA-02 | Phase 6 | Complete |

**Coverage:**
- June V2 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-18 after Phase 6 M&A source directory and email workflow implementation*
