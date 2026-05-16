---
phase: 01-scope-lock-and-data-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, opportunities, server-actions]
requires: []
provides:
  - Opportunity, M&A source, and opportunity document metadata schema
  - TypeScript opportunity/source/document contracts
  - Staff-only opportunity CRUD server actions
affects: [opportunities, import, documents, matching]
tech-stack:
  added: []
  patterns: [createAdminClient, requireUser, explicit visibility metadata]
key-files:
  created:
    - scripts/044_create_opportunities_foundation.sql
    - lib/types/opportunity.ts
    - lib/actions/opportunities.ts
  modified: []
key-decisions:
  - "M&A source/contact is stored as minimal staff-only data, not as a CRM."
  - "Repreneur visibility is explicit metadata, not inferred from storage paths or source records."
patterns-established:
  - "Opportunity records separate staff-only source data from anonymized repreneur-visible fields."
requirements-completed: [OPP-01, OPP-02, OPP-04, OPP-05, MNA-01]
duration: 18 min
completed: 2026-05-16
---

# Phase 1 Plan 1: Data Foundation Summary

**Opportunity schema, TypeScript contracts, and staff-only CRUD actions with explicit visibility boundaries**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-16T20:55:00Z
- **Completed:** 2026-05-16T21:13:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `ma_sources`, `opportunities`, and `opportunity_documents` foundation schema.
- Added TypeScript row/insert/update types and option constants.
- Added staff-only list/get/create/update/archive actions.

## Task Commits

1. **Task 1-3: Opportunity foundation** - `23eff36` (feat)

## Files Created/Modified

- `scripts/044_create_opportunities_foundation.sql` - Postgres schema and RLS policies.
- `lib/types/opportunity.ts` - Opportunity, source, and document type contracts.
- `lib/actions/opportunities.ts` - Staff-only server actions.

## Decisions Made

M&A source/contact is intentionally minimal. Automatic PDF parsing, full M&A CRM, and hidden AI matching remain out of V2 scope.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Global `pnpm exec tsc --noEmit --pretty false` fails on pre-existing archived/intake/email files. A filtered TypeScript check for opportunity-related paths returned no errors.

## User Setup Required

Apply `scripts/044_create_opportunities_foundation.sql` in Supabase before using the new opportunity screens against a real database.

## Next Phase Readiness

Ready for staff opportunity screens, import review, source handling, and document metadata.

---
*Phase: 01-scope-lock-and-data-foundation*
*Completed: 2026-05-16*
