# Phase 8 Navigation Performance Stabilization

**Status:** Completed locally; pending branch review/deploy
**Date:** 2026-05-22
**Parent Phase:** 8 - Post-demo workflow MVP
**Related Plan:** 08-01 Stabilize demo blockers and searchable selectors
**Source Debug Note:** `.planning/debug/page-navigation-lag.md`

## Goal

Make staff dashboard navigation feel like a modern SaaS: route changes should respond immediately, keep the dashboard frame stable, and avoid a blank one-second wait while server data loads.

This session treats navigation speed as architecture work, not as a small visual bug. The fix should make the common staff pages lighter and warmer before Phase 8 adds more workflow surface area.

## Scope

- Staff dashboard shell and common dashboard routes.
- Repreneur list, pipeline, analytics, opportunity Find, dashboard, and repreneur detail navigation.
- Server-side dashboard data reads and write invalidation paths.
- Database indexes for the dashboard query patterns introduced or confirmed during this pass.

Out of scope:

- Public intake and external portal performance unless later profiling shows a shared bottleneck.
- Adding a client cache framework such as TanStack Query.
- Rewriting the product navigation IA.

## Architecture Decisions

- Enable Next.js Cache Components so dashboard routes can keep a fast shell while data-heavy sections stream.
- Remove the dashboard page-transition/template remount pattern because it worked against smooth route switching.
- Move dashboard data access into tagged cached server loaders:
  - Repreneur lists and pipeline snapshots: short operational cache.
  - Analytics snapshots: short reporting cache.
  - Guide/roadmap surfaces: slow-changing route shell behavior through cache boundaries.
- Replace broad repeated reads with purpose-built loaders that return only the fields needed by each screen.
- Invalidate relevant cache tags immediately after writes so staff edits stay fresh.
- Add loading boundaries so every staff route switch can show immediate feedback.
- Add Supabase index migrations for lifecycle/status filters, date ordering, relationship lookups, activity type/date, and match status/pursuit filters.

## Measurement

Baseline was recovered by rebuilding the last committed code (`b2d87fe`) in a temporary local production-like copy after implementation. This is not a historical production recording, but it is a real browser comparison and avoids using the rough reported one-second lag as a fake measured value.

| Case | Before ms | After ms | Outcome |
|------|-----------|----------|---------|
| Repreneurs | 85 | 120 | Still near-instant; no dead wait. |
| Pipeline | 70 | 73 | Flat and near-instant. |
| Analytics | 89 | 69 | Faster. |
| Opportunities Find | 1671 | 82 | Large lag removed. |
| Dashboard | 83 | 106 | Still near-instant; slightly above the 100ms target. |
| Repreneur detail | 4893 | 75 | Large lag removed. |

Chart: `docs/solutions/navigation-performance-before-after.svg`

Metric: authenticated browser click to route URL/shell response in local production mode.

## Verification

- `npm run build` passed after the performance implementation.
- `npm run lint` passed with existing warnings and no blocking errors.
- Authenticated browser smoke covered the six measured staff routes.
- `npx tsc --noEmit` stalled locally and is not counted as passed. Re-run it before a final release gate if the environment stops hanging.

## Acceptance Notes

- The two worst routes no longer have multi-second navigation waits.
- Four of six measured cases are under 100ms.
- All six measured cases are under 120ms.
- The remaining 100ms target misses are not the old user-visible dead wait, but Repreneurs and Dashboard should stay on the watch list after production deployment.
- The index migration files are included. If database migrations are not applied automatically on deploy, apply them manually before judging production performance.

## Follow-up

- After deployment, test the same six cases on `app.re-new.team` and confirm the footer build number matches the pushed commit.
- If production still feels slow, profile server timing on `/repreneurs`, `/dashboard_re`, and `/opportunities/find` first.
- Keep future Phase 8 work on the cached snapshot pattern instead of adding new broad Supabase reads in page components.

## Executive Summary

The dashboard now loads through a faster frame: pages keep a stable shell, heavy data is cached briefly, and the app stops rebuilding large route payloads on every click. This is the structural fix Ivan asked for before adding more post-demo workflow features.

The measured result is strongest on the previously slow routes: Opportunities Find moved from 1671ms to 82ms, and repreneur detail moved from 4893ms to 75ms in local production browser testing. The remaining common routes are all near-instant, with production verification still needed after deploy.
