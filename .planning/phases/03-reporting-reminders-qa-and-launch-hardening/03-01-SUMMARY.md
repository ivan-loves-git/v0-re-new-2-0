---
gsd_type: phase_summary
phase: "03-reporting-reminders-qa-and-launch-hardening"
plan: "03-01"
status: complete
completed_at: "2026-05-17T14:56:36Z"
---

# 03-01: Operational KPI Dashboard Summary

## Completed

- Added a staff-only opportunity KPI data action reading from opportunities, M&A/source labels, opportunity matches, pursuit stages, NDA status, and opportunity documents.
- Added a new dashboard section: `Deal-flow operating view`.
- Shows operational counts for:
  - active intermediaries
  - active opportunities
  - introductions
  - active pursuits
  - seller meetings
  - LOIs
  - dropped deals
  - closed deals
- Added internal conversion bars for introductions to active pursuit, active pursuits reaching seller meeting, and LOIs becoming closed deals.
- Added current pursuit-stage table and operational badges for approved documents and NDA-blocked pursuits.

## Scope Boundaries Kept

- Reporting remains internal to the staff dashboard.
- No external reporting page was added.
- No investor/report export was added.
- No stale reminder was added in this plan; that remains 03-02.
- No repreneur portal behavior changed.

## Verification

- `pnpm run build` passes.
- Browser UAT on `http://localhost:3012/dashboard` confirmed the new KPI section renders with live current data:
  - 15 active intermediaries
  - 15 active opportunities
  - 3 introductions
  - 1 pending review
- Focused TypeScript filtering showed no errors in `opportunity-analytics`, `opportunity-kpi-panel`, or the new dashboard KPI integration.
- Full typecheck still exits on the known pre-existing dashboard async-server-component baseline with the older TypeScript version.
- `pnpm run lint` cannot run because `eslint` is not installed in the project.

## Executive Summary

The staff dashboard now has the first June V2 operating view for deal-flow health. Re-New can see whether opportunities are moving from sourcing to introductions, active pursuit, meetings, LOI, drop, or close without manually inspecting every record.

This keeps reporting deliberately simple and internal. It is enough to operate the June workflow, while polished investor-style reporting remains a later V3 item.
