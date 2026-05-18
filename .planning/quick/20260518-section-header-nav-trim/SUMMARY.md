---
date: 2026-05-18
status: complete
type: quick
---

# Section Header And Navigation Trim

## Result

- Removed `Records` from the Opportunities sidebar group while preserving `/opportunities` as a direct route.
- Stopped promoting the old records route from the Opportunity dashboard cards and standard back links; operational links now point to Find or Groups.
- Added a shared `SectionPageHeader` component with green Repreneur and purple Opportunity icon treatments.
- Applied plain page titles and colored headers to dashboard, analytics, groups, and find pages.
- Updated dashboard breadcrumb labels so flat staff routes no longer display `|| Repreneurs` or `|| Opportunities`.

## Verification

- `git diff --check` passed.
- `pnpm run build` passed with existing framework/package warnings.
- Browser smoke checked `/dashboard_re`, `/dashboard_op`, `/analytics_re`, `/analytics_op`, `/opportunities/groups`, `/opportunities/find`, `/repreneurs`, and `/repreneurs/explore`.
- Browser smoke confirmed no sidebar `Records` item and no legacy `||` title suffixes on the checked staff pages.
