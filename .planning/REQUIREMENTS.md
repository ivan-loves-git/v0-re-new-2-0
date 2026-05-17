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

- [ ] **REP-01**: A repreneur can access anonymized opportunities through the platform.
- [ ] **REP-02**: A repreneur can express interest in an opportunity.
- [ ] **REP-03**: A repreneur can reject or ignore an opportunity without creating staff ambiguity.
- [ ] **REP-04**: June access does not imply full repreneur profile editing or advanced self-service.

### Deal Progress

- [ ] **DEAL-01**: Staff can validate when a repreneur is actively pursuing an opportunity.
- [ ] **DEAL-02**: Multiple repreneurs can be exposed to the same opportunity before active pursuit is validated.
- [ ] **DEAL-03**: Once active pursuit is validated, the opportunity is not exposed to additional repreneurs unless the pursuit drops.
- [ ] **DEAL-04**: Staff can track the stages: interest, intermediary meeting, seller meeting, LOI, dropped, closed.

### NDA and Documents

- [ ] **NDA-01**: Staff can track whether an opportunity requires a per-opportunity NDA.
- [ ] **NDA-02**: Staff can attach or record the NDA document/status for an opportunity-repreneur pursuit.
- [ ] **DOC-01**: Repreneurs can download opportunity PDFs that staff choose to expose.

### Freshness and M&A Follow-Up

- [ ] **FRESH-01**: Each opportunity shows date added and month added.
- [x] **MNA-01**: Staff can record basic M&A source/contact information needed for the opportunity.
- [ ] **MNA-02**: Staff get a simple stale-opportunity reminder after 3 months when nobody is actively pursuing the opportunity.

### Reporting

- [ ] **KPI-01**: Staff can see operational counts for active intermediaries, opportunities, introductions, seller meetings, LOIs, dropped deals, and closed deals.
- [ ] **KPI-02**: Reporting is internal only for June.

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
| Advanced repreneur self-service | Repreneur access must stay narrow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPP-01, OPP-02, OPP-03, OPP-04, OPP-05 | Phase 1 | Pending |
| MNA-01 | Phase 1 | Complete |
| MATCH-01, MATCH-02, MATCH-03 | Phase 2 | Complete |
| REP-01, REP-02, REP-03, REP-04 | Phase 2 | Pending |
| DEAL-01, DEAL-02, DEAL-03, DEAL-04 | Phase 2 | Pending |
| NDA-01, NDA-02, DOC-01 | Phase 2 | Pending |
| FRESH-01, MNA-02 | Phase 3 | Pending |
| KPI-01, KPI-02 | Phase 3 | Pending |
| ENV-01, ENV-02, TEST-01, REL-01, REL-02 | Phase 1.1 | Complete |

**Coverage:**
- June V2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-17 after Phase 2 matching foundation*
