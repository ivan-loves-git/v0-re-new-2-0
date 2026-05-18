# Plan 05-03 Summary: Opportunity Find and Groups Work Surfaces

**Status:** complete
**Completed:** 2026-05-18
**Phase:** 5 - Unified Find and Groups Work Surfaces

## What Changed

- Added `/opportunities/find` as a flat searchable opportunity work surface.
- Added `/opportunities/groups` as a grouped opportunity operating surface.
- Kept `/opportunities` as the existing Records page.
- Added Opportunities sidebar links for `Groups`, `Find`, and existing `Records`.
- Added a read-only opportunity work-surface loader that includes source data plus match/pursuit summaries.
- Added opportunity journey badges based on the derived journey helper from Plan 05-01.
- Added filters for journey, status, visibility, sector, location, source type, freshness, and active pursuit.
- Added grouped buckets for draft, live inventory, matching/proposed, interest received, active pursuit, meeting/LOI, paused, and closed/dropped/archived.

## Files Changed

- `app/(dashboard)/opportunities/find/page.tsx`
- `app/(dashboard)/opportunities/groups/page.tsx`
- `components/app-sidebar.tsx`
- `components/opportunities/opportunity-status-badge.tsx`
- `components/opportunities/opportunity-work-surface-table.tsx`
- `lib/actions/opportunities.ts`
- `lib/types/opportunity.ts`
- `lib/utils/opportunity-journey.ts`

## Verification

- `pnpm run build` passed.
- `pnpm exec vitest run lib/utils/__tests__/opportunity-journey.test.ts` passed: 16 tests.
- Browser check passed for `/opportunities/find`, `/opportunities/groups`, and existing `/opportunities`.
- Browser DOM check confirmed the new sidebar links, page headings, search controls, journey filters, grouped buckets, and Records page preservation.
- `pnpm exec tsc --noEmit --pretty false` still fails on the existing baseline; the run exposed and this plan fixed the Phase 5 journey-options readonly type issue.

## Notes

- No database migration was introduced.
- KPI/scoring dirty files were not touched.
- Plan 05-04 still needs the dedicated UX validation pass across desktop/mobile, filters, row navigation, and pagination.

## Executive Summary

Opportunities now have the same operating split as repreneurs: Find for full-list searching and Groups for bucket-based daily work. The existing Records page remains available, so the team gets the new workflow without losing the old table.

The key product improvement is that each opportunity now shows a derived journey tag, so staff can scan deal-flow state without manually combining availability, match response, and pursuit stage in their head.
