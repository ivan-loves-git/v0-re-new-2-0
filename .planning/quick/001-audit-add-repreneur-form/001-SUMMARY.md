---
phase: quick
plan: 001
subsystem: ui
tags: [forms, repreneur, v2-questionnaire, cleanup]

# Dependency graph
requires:
  - phase: v2-questionnaire-system
    provides: q05-q16 intake form for scoring data collection
provides:
  - Simplified admin form for basic repreneur creation (no legacy Tier 1 fields)
  - Documentation of field categories in action code
affects: [phase-05-pipeline, admin-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - components/repreneurs/repreneur-form.tsx
    - lib/actions/repreneurs.ts

key-decisions:
  - "Admin form collects only basic contact info, not scoring data"
  - "Legacy Tier 1 fields (investment_capacity, sector_preferences, etc.) removed from form but preserved in action for backwards compatibility"
  - "v2 questionnaire (q05-q16) is now the source of truth for scoring data"

patterns-established:
  - "Admin creates minimal record, sends repreneur questionnaire link for scoring data"

# Metrics
duration: 4min
completed: 2026-01-27
---

# Quick Task 001: Audit Add Repreneur Form Summary

**Simplified RepreneurForm to collect only basic contact info, removing legacy Tier 1 scoring fields now handled by v2 questionnaire**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T11:00:00Z
- **Completed:** 2026-01-27T11:04:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed 4 legacy Tier 1 field UI components (investment_capacity, target_acquisition_size, sector_preferences, target_location checkboxes)
- Removed ~86 lines of obsolete form code (state, handlers, imports)
- Added comprehensive JSDoc documentation to createRepreneur and updateRepreneur actions
- Updated form description to guide admin to send questionnaire link

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify RepreneurForm by removing legacy Tier 1 fields** - `d6cfe0a` (refactor)
2. **Task 2: Update updateRepreneur action to match simplified form** - `64f390b` (docs)

## Files Created/Modified
- `components/repreneurs/repreneur-form.tsx` - Simplified form with only basic fields (name, email, phone, linkedin, status, source, persona, company_background, consent)
- `lib/actions/repreneurs.ts` - Added JSDoc comments documenting field categories

## Decisions Made
- Keep Checkbox import for GDPR consent (still needed, wasn't removed)
- Actions keep handling legacy fields for backwards compatibility with existing data and imports
- Form description updated to guide admin workflow: "Enter basic contact details. Send the questionnaire link to collect scoring data."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin form now aligned with v2 questionnaire workflow
- Ready for Phase 5 pipeline improvements
- Existing repreneurs with legacy data unaffected

---
*Phase: quick-001*
*Completed: 2026-01-27*
