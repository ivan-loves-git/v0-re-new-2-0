# Roadmap: Wave v2 Launch Readiness

## Overview

This roadmap delivers the v2 questionnaire relaunch to Re-New's candidate pool. The journey starts with fixing critical bugs (file uploads, scoring persistence), then builds admin tooling (WHO/WHEN editors, pipeline improvements), establishes launch infrastructure (acknowledgment emails, domain setup), and culminates in testing, data cleanup, and mass candidate communication. Each phase delivers a verifiable capability, with bug fixes preceding features that depend on them.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Critical Bug Fixes** - Fix file uploads, scoring persistence, and scoring page visibility
- [ ] **Phase 2: Data Export** - Create pre-cleanup database snapshot for audit trail
- [ ] **Phase 3: Scoring UI Cleanup** - Remove legacy scoring interface elements
- [ ] **Phase 4: WHO/WHEN Editors** - Add popup editors for parameter correction with recalculation
- [ ] **Phase 5: Pipeline Improvements** - Add score sorting and Declined status
- [ ] **Phase 6: Launch Infrastructure** - Configure acknowledgment emails, domain, and duplicate prevention
- [ ] **Phase 7: Team Decisions** - Resolve pending content and configuration decisions
- [ ] **Phase 8: Testing & Validation** - Device testing, file type testing, internal tests
- [ ] **Phase 9: Data Cleanup** - Remove incomplete/duplicate records from database
- [ ] **Phase 10: Launch** - Execute candidate communication and go live

## Phase Details

### Phase 1: Critical Bug Fixes
**Goal**: Eliminate blockers that prevent basic platform functionality
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. User can upload a 5MB PDF via the questionnaire and download it successfully from admin profile
  2. Admin can edit Tier 1 scores on a profile, close the dialog, reopen it, and see the saved values
  3. Candidate completing the questionnaire sees a thank-you screen, not a scoring summary
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Data Export
**Goal**: Create verified database snapshot before any cleanup operations
**Depends on**: Phase 1
**Requirements**: DATA-01
**Success Criteria** (what must be TRUE):
  1. Timestamped JSON export exists in repository with record count verification
  2. Export includes all current repreneurs with their scores, offers, and notes
  3. Export file can be parsed and record count matches database query
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Scoring UI Cleanup
**Goal**: Remove legacy scoring interface to prepare for new WHO/WHEN editors
**Depends on**: Phase 1
**Requirements**: SCORE-01, SCORE-02
**Success Criteria** (what must be TRUE):
  1. Legacy pencil icon that opened questionnaire parameters is no longer visible on profile
  2. Large questionnaire copy section is no longer visible on profile page
  3. Profile page displays scores but no editing interface (interim state)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: WHO/WHEN Editors
**Goal**: Enable admin correction of questionnaire answers with automatic score recalculation
**Depends on**: Phase 3
**Requirements**: SCORE-03, SCORE-04, SCORE-05
**Success Criteria** (what must be TRUE):
  1. Admin can click WHO pencil icon and see popup with all WHO parameters editable
  2. Admin can click WHEN pencil icon and see popup with all WHEN parameters editable
  3. Clicking "Calculate & Save" in either popup updates answers and recalculates score atomically
  4. Score breakdown on profile reflects recalculated values after saving
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Pipeline Improvements
**Goal**: Improve lead management with score sorting and manual decline capability
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02
**Success Criteria** (what must be TRUE):
  1. Lead column on pipeline board shows candidates sorted by Tier 1 score (highest first)
  2. Admin can manually set a candidate to "Declined" status distinct from automatic "Rejected"
  3. Declined candidates appear in a separate area from active leads
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Launch Infrastructure
**Goal**: Technical foundation for mass questionnaire relaunch
**Depends on**: Phase 1
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Candidate receives acknowledgment email within 1 minute of questionnaire submission
  2. Questionnaire is accessible at production URL (app.re-new.team or equivalent)
  3. Submitting questionnaire with existing email shows clear error instead of creating duplicate
  4. Database has UNIQUE constraint on email preventing duplicate profiles
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Team Decisions
**Goal**: Resolve all pending configuration and content decisions before launch
**Depends on**: Phase 5, Phase 6
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):
  1. End screen content after questionnaire is finalized and implemented
  2. Declined vs Rejected terminology is documented and consistent in UI
  3. Final production URL is confirmed and DNS configured
  4. SPF/DKIM/DMARC records verified for email domain
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: Testing & Validation
**Goal**: Verify platform works across devices and file types before mass launch
**Depends on**: Phase 6, Phase 7
**Requirements**: LAUNCH-05, LAUNCH-06, LAUNCH-07
**Success Criteria** (what must be TRUE):
  1. Questionnaire tested on iPhone, Android, and desktop browsers (documented results)
  2. PDF and Word document uploads tested and verified downloadable
  3. At least 6 internal team members have completed questionnaire end-to-end
  4. All internal test submissions appear correctly in admin pipeline
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Data Cleanup
**Goal**: Clean database of incomplete/duplicate records before relaunch
**Depends on**: Phase 2, Phase 8
**Requirements**: DATA-02
**Success Criteria** (what must be TRUE):
  1. Cleanup criteria documented (what qualifies as incomplete/duplicate)
  2. Records matching cleanup criteria deleted with count verification
  3. Remaining database contains only complete, unique records
  4. Cleanup logged with before/after record counts
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

### Phase 10: Launch
**Goal**: Execute candidate communication and go live with v2 questionnaire
**Depends on**: Phase 9
**Requirements**: LAUNCH-08
**Success Criteria** (what must be TRUE):
  1. Amelie has sent candidate communication with questionnaire link
  2. First batch of candidate submissions received and visible in pipeline
  3. Acknowledgment emails sending successfully for new submissions
  4. No critical issues reported in first 24 hours post-launch
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Critical Bug Fixes | 0/? | Not started | - |
| 2. Data Export | 0/? | Not started | - |
| 3. Scoring UI Cleanup | 0/? | Not started | - |
| 4. WHO/WHEN Editors | 0/? | Not started | - |
| 5. Pipeline Improvements | 0/? | Not started | - |
| 6. Launch Infrastructure | 0/? | Not started | - |
| 7. Team Decisions | 0/? | Not started | - |
| 8. Testing & Validation | 0/? | Not started | - |
| 9. Data Cleanup | 0/? | Not started | - |
| 10. Launch | 0/? | Not started | - |

---
*Roadmap created: 2026-01-26*
*Depth: comprehensive (10 phases)*
*Coverage: 24/24 v1 requirements mapped*
