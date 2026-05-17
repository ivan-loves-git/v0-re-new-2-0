# Phase 2 UAT Results

**Status:** Plans 02-01 through 02-05 implemented; local worktree verification complete
**Environment:** Same Supabase project, controlled additive migration
**Branch:** `codex/gsd-v2-phase2-20260517`
**Worktree:** `_worktrees/renew-platform-gsd-v2-phase2`

## Plan 02-01 Scope

- Added `opportunity_matches` as the structured relationship between one opportunity and one repreneur.
- Stored platform recommendation, platform score, platform reasons, optional human recommendation, human notes, and match status.
- Added a staff-only Recommendations tab on opportunity detail.
- Kept matching structured and manual for June; no hidden AI matching was introduced.

## Migration Checklist

- [x] Saved schema snapshot at `/tmp/renew-phase2/pre_046_schema.sql`.
- [x] Applied `scripts/046_create_opportunity_matches.sql`.
- [x] Verified `public.opportunity_matches` exists with expected columns.
- [x] RLS enabled with authenticated staff policies.

## Verification

- [x] New TypeScript files do not appear in the filtered typecheck errors.
- [x] Full project typecheck still fails on the known pre-existing baseline outside this phase.
- [x] Dev server runs on `http://localhost:3012`.
- [x] Authenticated HTTP page load confirms the opportunity detail renders the Recommendations tab.
- [x] Database write path verified with a marked temporary match record.
- [x] Authenticated repreneur HTTP page load confirms `/my-opportunities` renders only the proposed anonymized opportunity.
- [x] Authenticated repreneur detail page confirms staff-only source label, raw description, and staff notes are absent.

## Plan 02-02 Scope

- Added login-email based repreneur access for June.
- Added `/my-opportunities` and `/my-opportunities/[matchId]`.
- Shows only active, non-staff-only opportunities where the match is `proposed`, `interested`, or `active_pursuit`.
- Does not expose source/contact, staff notes, raw descriptions, documents, profile editing, interest/reject, or pursuit workflow.

## Plan 02-05 Scope

- Added `scripts/048_opportunity_active_pursuit_lock.sql`.
- Enforced one `active_pursuit` match per opportunity with a database partial unique index.
- Added staff validate/drop/reopen actions for active pursuit control.
- Added `Validate pursuit` to `/opportunities/reviews`.
- Added active-lock, drop, and reopen controls to the opportunity Recommendations tab.
- Hid non-active portal matches when another repreneur owns the active pursuit.

## Plan 02-05 Verification

- Applied and verified the active-pursuit lock index in the approved Supabase project.
- Database UAT confirmed:
  - first interested match can become `active_pursuit`
  - second active pursuit for the same opportunity is blocked
  - dropping the active pursuit releases the lock
  - another interested match can then become `active_pursuit`
- Browser UAT confirmed:
  - staff review queue renders `Validate pursuit`
  - validation moves the demo response out of the queue
  - Recommendations tab shows `Active pursuit locked`
  - drop returns the opportunity to `Open for validation`
  - reopen restores the match to `Interested` and returns it to the review queue
- Demo state after verification:
  - `DEMO-OPP-20260517-01` for `myworkmail4@gmail.com` is restored to `interested`
  - response remains unreviewed for Ivan to test

## Temporary UAT Data

Cleaned after verification:

- Deleted 2 marked Phase 2 UAT opportunities.
- Deleted 2 marked Phase 2 UAT match rows.
- Deleted 1 marked Phase 2 UAT repreneur profile.
- Deleted 2 marked Phase 2 UAT users and their sessions/accounts.
- Verified remaining marked Phase 2 UAT opportunities, repreneurs, and users: `0`.
