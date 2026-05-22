# Phase 8 UAT: Post-demo Workflow MVP

**Date:** 2026-05-22  
**Environment:** Local production server at `http://localhost:3012` using the approved Re-New Supabase project  
**Staff account:** `ivanpaudice@icloud.com`  
**Status:** Passed locally; production deploy verification still pending

## Database Readiness

Applied additive Phase 8 database migrations to the approved Supabase project:

- `20260522_phase8_opportunity_field_cleanup.sql`
- `20260522_phase8_info_memo_stage.sql`
- `20260522_phase8_nda_info_memo_email_template.sql`

The opportunity field cleanup migration is deploy-safe: it adds and backfills the new canonical fields while keeping legacy columns as temporary compatibility shims. Old confusing fields are no longer used by the app UI/code, but they are not dropped in this release because a raw rename/drop would create a deployment-order break.

## Technical Verification

- `npm run build` passed.
- `npm run lint` passed with existing repository warnings and 0 errors.
- `npx vitest run lib/utils/__tests__/opportunity-journey.test.ts` passed: 17 tests.
- `npx tsc --noEmit --pretty false` still fails on pre-existing unrelated type issues in:
  - `app/(dashboard)/dashboard_re/page.tsx`
  - `app/routing/page.tsx`
  - `lib/data/dashboard-snapshots.ts`

## Browser UAT

Automated browser checks passed on the local production server:

- Staff login works with the stored staff credentials.
- Portal preview repreneur selector is searchable by email/name.
- Opportunity overview shows recommended repreneurs without opening the deeper Recommendations tab.
- Opportunity Recommendations tab repreneur selector is searchable by email/name.
- Repreneur profile shows the reverse Opportunity Matches card.
- Opportunity creation shows required Excel-field validation warnings.
- Opportunity creation with a marked temporary UAT opportunity saved successfully and redirected to the new opportunity detail page.
- Opportunity edit save feedback returns to `Save changes` and shows success feedback.
- Pursuit stage selector includes `Info memo received` before `Intermediary meeting`.
- M&A workflow recommends the NDA/info memo request when there is an active pursuit.
- Portal Access card renders on the repreneur profile.

Temporary browser-created record `UAT-PHASE8-1779445816179` and its matching temporary M&A source were deleted after verification.

## Scope Notes

- JSON import from ChatGPT output remains deferred to V4/backlog.
- Full PDF-to-opportunity AI ingestion remains deferred beyond Phase 8.
- Info memo document storage remains out of scope for this phase.
- Full HTML email editing remains out of scope.
- Intermediary portal remains out of scope.

## Residual Risk

- Production browser UAT must be repeated after the code is deployed and the footer build number matches the pushed commit.
- Legacy compatibility columns should be physically dropped only after the new production app has been live and stable.
- The existing typecheck baseline still needs a separate cleanup pass.

## Executive Summary

Phase 8 is now locally verified as a practical post-demo workflow: staff can create cleaner opportunities from the Excel structure, search repreneur selectors, see matches both ways, save opportunity edits without stuck loading, and request the M&A firm's NDA/info memo from the opportunity workflow.

The implementation keeps the current MVP disciplined. The platform now supports Bertrand and Colin's immediate operating needs, while heavier automation such as PDF ingestion, JSON import, and intermediary portals stays parked for a later version.
