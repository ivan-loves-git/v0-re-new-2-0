---
status: resolved
trigger: "renew platform navigation is way too laggy. there almost 1 second behind eveyry interaction that requires ne pages to load. switch of pages is also very laggy. I've zero dev experience but I think it's a architectural issue that needs to be fixed not a code bug. its a coding writing syntax od architecture or whatever, this has to be slved structurally. I've used other saas and they can be smooth, I know this. we do NOT have so much darta.."
created: "2026-05-21"
updated: "2026-05-22"
---

# Debug Session: Page Navigation Lag

## Symptoms

- expected_behavior: Staff app navigation should feel smooth and responsive, with page switches and interactions that load new pages happening without a visible one-second stall.
- actual_behavior: Page-level navigation and interactions that require a new page load feel almost one second behind.
- error_messages: No user-facing errors reported.
- timeline: Reported during the Phase 8 post-demo workflow planning window.
- reproduction: Navigate between staff pages in the Re-New platform and trigger interactions that load a new page.

## Current Focus

- hypothesis: Confirmed. The lag was structural: dashboard routes were doing broad repeated server reads and remounting page shells instead of preserving a warm dashboard frame with streamed data.
- test: Compared the last committed code (`b2d87fe`) against the performance branch in local production mode using the same authenticated browser flow.
- expecting: Staff navigation should show route feedback quickly, keep the dashboard shell stable, and avoid repeated full-page data waits on common staff pages.
- next_action: Deploy branch, apply the included database index migration if the migration pipeline is manual, and verify the production footer build number before closing the release.
- reasoning_checkpoint: The baseline was recovered from the last committed code after implementation, not from a historical production recording. It is still a real local browser comparison, not a guessed 1000ms placeholder.
- tdd_checkpoint: Build and lint passed after implementation; typecheck stalled and should be re-run outside the current stuck local process before final release if needed.

## Evidence

- Web guidance used during planning:
  - Next.js App Router navigation, streaming, Cache Components, and UI state preservation guidance.
  - Supabase query optimization guidance.
  - Request waterfall guidance from TanStack Query documentation, used as diagnosis context without adding TanStack Query.
- Code evidence:
  - `app/(dashboard)/template.tsx` and `components/page-transition.tsx` were removed from the dashboard path because they encouraged route remounting during navigation.
  - `next.config.mjs` now enables Cache Components.
  - Dashboard data reads now go through cached server snapshots in `lib/data/dashboard-snapshots.ts`.
  - Broad repeated reads were replaced with purpose-built loaders for repreneur list/dashboard, opportunity work surfaces, and analytics.
  - Server writes now invalidate the relevant dashboard cache tags so short-lived cache does not hide new edits.
  - Loading boundaries were added for dashboard routes so page switches can show immediate feedback while data settles.
  - SQL index migrations were added for the lifecycle/status/date and relationship filters used by the staff dashboard.
- Measurement evidence:

| Case | Before ms | After ms | Result |
|------|-----------|----------|--------|
| Repreneurs | 85 | 120 | Still near-instant; slightly slower than baseline but no dead wait. |
| Pipeline | 70 | 73 | Flat and near-instant. |
| Analytics | 89 | 69 | Faster. |
| Opportunities Find | 1671 | 82 | Large lag removed. |
| Dashboard | 83 | 106 | Still near-instant; slightly over the 100ms target. |
| Repreneur detail | 4893 | 75 | Large lag removed. |

- Chart artifact: `docs/solutions/navigation-performance-before-after.svg`.
- Metric definition: click to route URL/shell response in authenticated local production mode.
- Baseline note: the baseline was rebuilt from the last committed code in a temporary local copy after the implementation. It was not a live historical production capture, but it avoids using the user's rough 1000ms report as fake measured data.

## Eliminated

- "Too much data" is not the primary explanation. The biggest measured losses were on route architecture and repeated blocking reads, not on database volume alone.
- Prefetch alone is not enough. It improves perceived speed but does not fix the repeated blocking server work when a route is cold.
- A client cache library was not introduced. The app already uses Next App Router, so the safer structural fix is server caching, streaming, and narrower loaders first.

## Resolution

- root_cause: Dashboard navigation mixed remount-prone route structure, uncached data-heavy server pages, broad Supabase reads, and missing streaming/loading boundaries.
- fix: Enabled Cache Components, preserved the dashboard shell, added cached server snapshots with cache tags, narrowed key data loaders, invalidated cache tags after writes, added route loading boundaries, and added query indexes for justified staff dashboard patterns.
- verification: `npm run build` passed; `npm run lint` passed with existing warnings; authenticated Playwright route timing was captured for six staff cases. `npx tsc --noEmit` stalled locally and was not counted as passed.
- files_changed: See performance branch commit for full file list; the core files are `next.config.mjs`, `lib/data/dashboard-snapshots.ts`, dashboard route pages, server actions that mutate dashboard data, `app/(dashboard)/loading.tsx`, `scripts/055_dashboard_navigation_performance_indexes.sql`, and `supabase/migrations/20260521_dashboard_navigation_performance_indexes.sql`.
