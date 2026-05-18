---
gsd_type: summary
phase: "05-unify-repreneur-find-and-groups-ux-and-replicate-the-pattern"
plan_id: "05-01"
status: complete
completed_at: "2026-05-18"
---

# Summary 05-01: Shared Work Surface Contract and Opportunity Journey Helper

## Completed

- Added `05-DESIGN-CONTRACT.md` for Find, Groups, shared page anatomy, badge language, opportunity columns, and component extraction boundaries.
- Added `lib/utils/opportunity-journey.ts` with a deterministic derived opportunity journey helper.
- Added unit coverage for draft, paused, archived, closed, live inventory, matching, proposed, interest received, active pursuit, pursuit stages, and dropped/declined-only states.
- Preserved the core scope rule: opportunity journey is a display label derived from source facts, not a new manual database field.

## Verification

- `pnpm exec vitest run lib/utils/__tests__/opportunity-journey.test.ts` passes with 16 tests.
- This plan did not touch KPI work that is active in another local workstream.

## Executive Summary

The phase now has a clear design contract and a tested helper for the most important opportunity table label. Staff will see one simple journey label, while the system keeps availability, match status, and pursuit stage as separate source facts.

This gives plans 05-02 and 05-03 a stable foundation: they can build consistent Repreneur and Opportunity work surfaces without redesigning the status model again.
