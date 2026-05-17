---
gsd_type: phase_summary
phase: "03-reporting-reminders-qa-and-launch-hardening"
plan: "03-02"
status: complete
completed_at: "2026-05-17T15:20:48Z"
---

# 03-02: Freshness Display and Stale-Opportunity Reminder Summary

## Completed

- Added an internal opportunity freshness data action.
- Added a staff-dashboard `Opportunity freshness` panel below the deal-flow KPI section.
- The panel flags active, paused, or draft opportunities older than 90 days when no match is in `active_pursuit`.
- The panel also shows oldest open opportunity age and counts open opportunities missing a date.
- Updated the opportunities table to show exact date added and month added.
- Updated opportunity detail header to show exact date added and month added.

## Scope Boundaries Kept

- No schema or Supabase migration was added.
- No automated email, Slack, or calendar reminders were added.
- No repreneur-facing freshness display was added.
- Full M&A CRM follow-up remains deferred.

## Verification

- `pnpm run build` passes.
- Focused TypeScript filtering showed no errors in the new freshness action, freshness panel, opportunity table, or opportunity detail.
- Full `pnpm exec tsc --noEmit --pretty false` still exits on known baseline errors outside this work.
- `pnpm run lint` cannot run because `eslint` is not installed in the project.
- Browser smoke on `http://localhost:3012/dashboard` confirmed:
  - `Opportunity freshness` renders.
  - `Stale opportunity follow-up` renders.
  - The 90-day threshold copy renders.
  - Current data shows `0 stale` opportunities.
- Browser smoke on `http://localhost:3012/opportunities` confirmed 15 visible month labels.
- Browser smoke on one opportunity detail confirmed exact date plus month in the header.
- Screenshots saved:
  - `/tmp/renew-03-02-freshness-dashboard.png`
  - `/tmp/renew-03-02-opportunities-month.png`

## Executive Summary

Re-New staff can now see whether opportunity records are fresh enough to operate. The table and detail pages expose both exact date and month, while the dashboard gives a simple stale reminder when an open opportunity is older than 90 days and has no active pursuit.

This keeps the June scope tight. It gives the team enough follow-up signal to run the workflow without turning V2 into a full CRM or automated reminder system.
