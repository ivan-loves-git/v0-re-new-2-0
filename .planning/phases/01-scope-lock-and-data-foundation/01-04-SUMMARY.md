---
phase: 01-scope-lock-and-data-foundation
plan: 04
subsystem: ui
tags: [ma-source, staff-only, opportunities]
requires:
  - phase: 01-01
    provides: ma_sources schema and actions
  - phase: 01-02
    provides: opportunity form and detail screen
provides:
  - Staff-only M&A source panel
  - Source/contact fields in opportunity form
  - Source visibility separation in opportunity detail
affects: [opportunities, ma-source]
tech-stack:
  added: []
  patterns: [staff-only source panel, shadcn Card, shadcn Badge]
key-files:
  created:
    - components/opportunities/ma-source-panel.tsx
  modified:
    - components/opportunities/opportunity-form.tsx
    - components/opportunities/opportunity-detail.tsx
    - lib/actions/opportunities.ts
key-decisions:
  - "M&A source handling remains basic firm/contact metadata only."
  - "Source/contact fields are not included in repreneur-visible sections."
patterns-established:
  - "Source details default to staff_only and are displayed separately from anonymized deal data."
requirements-completed: [MNA-01, OPP-04]
duration: 8 min
completed: 2026-05-16
---

# Phase 1 Plan 4: M&A Source Handling Summary

**Basic staff-only M&A source/contact handling inside the opportunity form and detail dashboard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-16T21:14:00Z
- **Completed:** 2026-05-16T21:22:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a compact staff-only M&A source panel.
- Wired source firm/contact fields into the opportunity form.
- Kept source data out of repreneur-visible opportunity sections.

## Task Commits

1. **Task 1-2: Source panel and wiring** - `cdca548` (feat)

## Files Created/Modified

- `components/opportunities/ma-source-panel.tsx` - Staff-only source/contact panel.
- `components/opportunities/opportunity-form.tsx` - Source fields.
- `components/opportunities/opportunity-detail.tsx` - Staff-only source section.
- `lib/actions/opportunities.ts` - Source upsert from form data.

## Decisions Made

The V2 source model does not include CRM activity history, outreach automation, or an M&A firm portal.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

No source-specific issues.

## User Setup Required

None beyond applying the opportunity foundation migration.

## Next Phase Readiness

Ready for staff validation of source/contact fields against Bertrand's Excel files.

---
*Phase: 01-scope-lock-and-data-foundation*
*Completed: 2026-05-16*
