---
gsd_type: phase_summary
phase: "02-core-deal-workflow"
plan: "02-05"
status: complete
completed_at: "2026-05-17T10:59:07Z"
---

# 02-05: Validated Pursuit, Active Lock, and Reopen Logic Summary

## Completed

- Added a database-level partial unique index that allows only one `active_pursuit` match per opportunity.
- Added staff actions to:
  - validate an `interested` match into `active_pursuit`
  - drop an active pursuit into `dropped`
  - reopen a dropped pursuit back into the review queue as `interested`
- Added active-lock status and controls to the staff Recommendations tab.
- Added `Validate pursuit` to the staff response review queue.
- Hid non-active repreneur portal matches when another repreneur already owns the active pursuit.
- Blocked manual staff saving of `active_pursuit`; validation must use the explicit action.

## Scope Boundaries Kept

- No deal-stage timeline was added.
- No NDA or document download gating was added.
- No email or Slack notifications were added.
- No automatic validation or AI matching was introduced.

## Verification

- Applied and verified `scripts/048_opportunity_active_pursuit_lock.sql` against the approved Supabase project.
- Database UAT created temporary records, validated the first active pursuit, confirmed a second active pursuit was blocked, dropped the first pursuit, then validated the second pursuit.
- Browser UAT with staff login:
  - `/opportunities/reviews` renders `Validate pursuit`.
  - Validating the demo response moves the opportunity out of the review queue.
  - The opportunity Recommendations tab shows `Active pursuit locked`.
  - Dropping the active pursuit shows `Open for validation` and `Reopen`.
  - Reopening restores the demo match to `Interested` and returns it to the review queue.
- Focused TypeScript check showed no errors in the changed files.
- Full lint could not run because `eslint` is not installed in the project.
- Full typecheck still fails on known pre-existing baseline files outside this phase.

## Demo Data State

- `DEMO-OPP-20260517-01` for `myworkmail4@gmail.com` was restored to `interested`.
- The response is left unreviewed so Ivan can still see and test it in `/opportunities/reviews`.

## Executive Summary

This plan adds the staff decision gate between repreneur interest and real deal pursuit. Interest is still only a signal; the Re-New team now explicitly validates one active path.

The lock is strict where it matters and reversible when needed. Only one repreneur can hold the active pursuit, but dropping that pursuit reopens the opportunity for another validated path.
