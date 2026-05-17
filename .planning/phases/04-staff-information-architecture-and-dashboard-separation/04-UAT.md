---
gsd_type: uat
phase: "04-staff-information-architecture-and-dashboard-separation"
created_at: "2026-05-17"
status: passed
---

# Phase 4 UAT

## Checks

- [x] `/dashboard` redirects to `/dashboard_re`.
- [x] `/analytics` redirects to `/analytics_re`.
- [x] `/dashboard_re` renders with title `Dashboard || Repreneurs`.
- [x] `/analytics_re` renders with title `Analytics || Repreneurs`.
- [x] `/dashboard_op` renders with title `Dashboard || Opportunities`.
- [x] `/analytics_op` renders with title `Analytics || Opportunities`.
- [x] Sidebar shows `Repreneurs`, `Opportunities`, `Tools`, and `Project`.
- [x] Sidebar does not show Journey, Opportunity Reviews, Mission, Instructions, or Offers.
- [x] `/journey`, `/opportunities/reviews`, `/guide`, and `/guide/instructions` remain direct-link accessible.
- [x] Staff trying `/portal/deals` redirects to `/dashboard_re`.
- [x] Repreneur users still cannot access staff dashboard routes.

## Result

Passed on 2026-05-17.

Evidence:
- `pnpm run build` completed successfully.
- Staff browser UAT passed for redirects, route rendering, sidebar grouping, hidden archived sidebar entries, and direct archived URLs.
- Clean unauthenticated browser session was redirected from `/dashboard_re` to `/auth/login`.
- Demo repreneur browser session landed on `/portal/deals` and was redirected back to `/portal/deals` when attempting `/dashboard_re`.
- Screenshots saved locally under `output/playwright/phase4-*.png`.

Notes:
- The main project `.env.local` was missing local Better Auth database keys that existed in the prior worktree; those ignored local-only keys were restored before browser testing.
- The linked demo repreneur account password was reset for UAT access testing. No schema migration was introduced.
