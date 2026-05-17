---
gsd_type: phase_summary
phase: "02-core-deal-workflow"
plan: "02-06"
status: complete
completed_at: "2026-05-17T12:49:22Z"
---

# 02-06: Deal Stage Tracking Summary

## Completed

- Added `opportunity_pursuit_stage` with the June stage set: interest, intermediary meeting, seller meeting, LOI, closed, and dropped.
- Added current pursuit stage fields to `opportunity_matches`.
- Added `opportunity_pursuit_events` as a lightweight internal history table.
- Updated validation so a newly validated pursuit starts at `interest`.
- Updated drop logic so dropped active pursuits record the `dropped` stage.
- Added staff-only stage update actions and a new `Pursuit` tab on opportunity detail.
- Added safe current-stage display in the repreneur portal without exposing staff notes or internal history.

## Scope Boundaries Kept

- No full CRM timeline was added.
- No tasks, reminders, notifications, or stale follow-up automation were added.
- No NDA/document gating was added.
- No multiple-active-pursuit behavior was introduced.
- No closing economics, commission, or payment workflow was added.

## Verification

- Applied and verified `scripts/049_opportunity_pursuit_stages.sql` against the approved Supabase project.
- Confirmed the new table and stage column are reachable through the Supabase API.
- `pnpm run build` passes.
- Focused TypeScript check showed no errors in the changed Phase 02-06 files.
- Full typecheck still fails on known pre-existing baseline files outside this phase, including archived intake code, older email templates, and older dashboard async component typings.

## Executive Summary

This plan gives Re-New a simple deal-stage tracker after staff validates one active pursuit. Staff can move that pursuit from interest through meetings, LOI, closed, or dropped, while the repreneur portal only sees the safe current stage.

The feature stays deliberately narrow. We now know where each active pursuit stands, but we have not turned the product into a CRM with tasks, reminders, notifications, or legal document gating.
