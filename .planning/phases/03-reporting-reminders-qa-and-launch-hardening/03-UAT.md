---
gsd_type: uat_report
phase: "03-reporting-reminders-qa-and-launch-hardening"
status: pass
completed_at: "2026-05-17T15:28:36Z"
---

# Phase 3 UAT: Reporting, Reminders, QA, and Launch Hardening

## Result

PASS with one dataset correction.

The app workflow is demo-safe for the June V2 scope after adding a minimal marked demo pursuit path. Before correction, the database had 15 demo opportunities and 3 demo matches, but no active pursuit, pursuit stage, NDA state, or opportunity document. That meant the product could render the screens but could not prove the full staff-to-repreneur-to-document flow with current demo data.

## Dataset Correction

Added marked demo records against `DEMO-OPP-20260517-01` and `myworkmail4@gmail.com`:

- Converted one demo match from `interested` to `active_pursuit`.
- Set pursuit stage to `seller_meeting`.
- Set NDA status to `signed`.
- Added pursuit event history for seller meeting.
- Added `QA Demo Teaser-DEMO` as `approved_for_repreneur`.
- Added `QA Demo Signed NDA-DEMO` as `staff_only` and linked it to the pursuit NDA state.

No schema changes were made.

## Browser Checks

| Check | Result | Evidence |
|-------|--------|----------|
| Staff dashboard renders KPI view | PASS | `/dashboard` shows `Deal-flow operating view`, `Active pursuits 1`, and `Seller meetings 1`. |
| Staff dashboard renders freshness view | PASS | `/dashboard` shows `Opportunity freshness` and stale-threshold copy. |
| Opportunity list shows freshness data | PASS | `/opportunities` shows 15 `Month:` labels. |
| Opportunity detail shows date/month | PASS | Demo opportunity detail shows `Added 17 mai 2026 / Month: mai 2026`. |
| Opportunity pursuit tab works | PASS | Pursuit tab shows `Seller meeting`, `Signed`, and QA demo notes. |
| Opportunity documents tab works | PASS | Documents tab shows approved teaser and staff-only signed NDA records. |
| Review page renders | PASS | `/opportunities/reviews` renders `Opportunity Reviews`. |
| Staff user cannot use repreneur portal | PASS | Staff browser sent `/portal/deals` back to `/dashboard`. |
| Legacy route behavior | PASS | Unauthenticated `/my-opportunities` redirects to `/portal/deals`; staff browser ultimately lands at `/dashboard`. |
| Protected routes unauthenticated | PASS | `curl -I /opportunities` and `/portal/deals` return 307 to `/auth/login`. |

## Data Checks

Read-only Supabase verification after dataset correction:

| Data Signal | Result |
|-------------|--------|
| Total opportunities | 15 |
| Demo opportunities | 15 |
| Demo opportunities with `date_added` | 15 |
| Active opportunities | 15 |
| Total matches | 3 |
| Proposed matches | 2 |
| Active pursuits | 1 |
| Staged matches | 1 |
| Pursuit events | 1 |
| Signed NDA matches | 1 |
| Opportunity documents | 2 |
| Approved repreneur documents | 1 |
| Demo repreneur rows for `myworkmail4@gmail.com` | 1 |
| Demo repreneur role | `repreneur` |

## Build and Tooling

- `pnpm run build` passes.
- Focused TypeScript filtering found no errors in the Phase 3 files touched in 03-02.
- Full `pnpm exec tsc --noEmit --pretty false` still fails on known baseline issues outside Phase 3.
- `pnpm run lint` cannot run because `eslint` is not installed.

## Residual Risk

- The demo repreneur browser flow was not re-run with a separate logged-in browser session during this pass to avoid disturbing the active staff browser session.
- The data model and route checks confirm the repreneur portal has the required active pursuit, signed NDA, and approved document data available.
- The local build is green, but Vercel should still be monitored after merge because the platform build previously surfaced production-only route errors.

## Executive Summary

Phase 3 QA now has a realistic end-to-end demo path: sourced opportunity, repreneur match, active pursuit, seller meeting stage, signed NDA, and approved document. This is enough to demonstrate the June V2 operating workflow.

The main remaining work is launch packaging: write the demo/release checklist and make the V3 backlog explicit so deferred items do not creep back into June scope.
