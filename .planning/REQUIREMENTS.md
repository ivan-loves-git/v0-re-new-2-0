# Requirements: Wave v2 Launch Readiness

**Defined:** 2026-01-26
**Core Value:** Get the v2 questionnaire live and usable for mass relaunch

## v1 Requirements

Requirements for launch readiness. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: Fix file upload routing (`step-contact.tsx` calls `/api/upload` but route is `/api/upload-cv`)
- [ ] **BUG-02**: Fix admin scoring persistence (RLS silent failure — edits disappear after re-opening profile)
- [ ] **BUG-03**: Configure server action body size limit in `next.config.mjs` (currently 1MB default, need higher)
- [ ] **BUG-04**: Remove end-of-form scoring page (candidates shouldn't see their scores)

### Scoring Edit Redesign

- [ ] **SCORE-01**: Remove old pencil icon that opens legacy questionnaire parameters
- [ ] **SCORE-02**: Remove big questionnaire copy section from profile page
- [ ] **SCORE-03**: Add WHO pencil icon → opens popup with all WHO parameters
- [ ] **SCORE-04**: Add WHEN pencil icon → opens popup with all WHEN parameters
- [ ] **SCORE-05**: Add "Calculate & Save" button in each popup that recalculates and persists score

### Pipeline Improvements

- [ ] **PIPE-01**: Lead column sorting by score (highest first)
- [ ] **PIPE-02**: Add "Declined" status as manual action (distinct from Rejected = low score)

### Launch Infrastructure

- [ ] **INFRA-01**: Send acknowledgment email immediately on questionnaire submission
- [ ] **INFRA-02**: URL/domain change for questionnaire (app.re-new.team or similar)
- [ ] **INFRA-03**: Duplicate email prevention (database UNIQUE constraint + pre-submission UI check)

### Data Hygiene

- [ ] **DATA-01**: Export current database to CSV (snapshot before cleanup)
- [ ] **DATA-02**: Clean database (remove incomplete/duplicate records)

### Launch Activities (Non-Code)

- [ ] **LAUNCH-01**: Team decision — end screen content after questionnaire
- [ ] **LAUNCH-02**: Team decision — Declined vs Rejected wording
- [ ] **LAUNCH-03**: Team decision — final URL for questionnaire
- [ ] **LAUNCH-04**: Verify SPF/DKIM/DMARC for email domain before mass send
- [ ] **LAUNCH-05**: Device testing (phones, various screen sizes)
- [ ] **LAUNCH-06**: File type testing (PDF, Word uploads)
- [ ] **LAUNCH-07**: Internal tests (~6 before broad send)
- [ ] **LAUNCH-08**: Candidate communication to relaunch questionnaire (Amelie)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Future Enhancements

- **SCORE-F1**: Add `score_override` column for explicit manual overrides separate from calculated scores
- **PIPE-F1**: Add "Withdrawn" status for candidates who exit mid-process
- **PIPE-F2**: Journey tier label alignment (Explorer/Learner/Ready/Serial Acquirer)
- **EMAIL-F1**: AI-personalized acknowledgment emails with human approval workflow
- **UPLOAD-F1**: File upload progress indicator (requires XMLHttpRequest)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cost analytics per client | Future milestone — requires time tracking integration |
| Client-facing portal | Future milestone — significant new surface area |
| Real-time duplicate monitoring | Manual comparison sufficient for now |
| OAuth/social login | Email/password sufficient for internal tool |
| Mobile app | Web-first, mobile via responsive design |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1: Critical Bug Fixes | Pending |
| BUG-02 | Phase 1: Critical Bug Fixes | Pending |
| BUG-03 | Phase 1: Critical Bug Fixes | Pending |
| BUG-04 | Phase 1: Critical Bug Fixes | Pending |
| SCORE-01 | Phase 3: Scoring UI Cleanup | Pending |
| SCORE-02 | Phase 3: Scoring UI Cleanup | Pending |
| SCORE-03 | Phase 4: WHO/WHEN Editors | Pending |
| SCORE-04 | Phase 4: WHO/WHEN Editors | Pending |
| SCORE-05 | Phase 4: WHO/WHEN Editors | Pending |
| PIPE-01 | Phase 5: Pipeline Improvements | Pending |
| PIPE-02 | Phase 5: Pipeline Improvements | Pending |
| INFRA-01 | Phase 6: Launch Infrastructure | Pending |
| INFRA-02 | Phase 6: Launch Infrastructure | Pending |
| INFRA-03 | Phase 6: Launch Infrastructure | Pending |
| DATA-01 | Phase 2: Data Export | Pending |
| DATA-02 | Phase 9: Data Cleanup | Pending |
| LAUNCH-01 | Phase 7: Team Decisions | Pending |
| LAUNCH-02 | Phase 7: Team Decisions | Pending |
| LAUNCH-03 | Phase 7: Team Decisions | Pending |
| LAUNCH-04 | Phase 7: Team Decisions | Pending |
| LAUNCH-05 | Phase 8: Testing & Validation | Pending |
| LAUNCH-06 | Phase 8: Testing & Validation | Pending |
| LAUNCH-07 | Phase 8: Testing & Validation | Pending |
| LAUNCH-08 | Phase 10: Launch | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-26 after roadmap creation*
