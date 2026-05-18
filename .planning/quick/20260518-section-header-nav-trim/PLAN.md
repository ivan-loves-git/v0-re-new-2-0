---
date: 2026-05-18
status: complete
type: quick
---

# Section Header And Navigation Trim

## Intent

Standardize staff page titles and remove the redundant Opportunities Records entry from the staff sidebar now that Groups and Find are the operating surfaces.

## Scope

- Remove `Records` from the Opportunities sidebar group.
- Keep `/opportunities` available as a direct route, but stop promoting it in navigation.
- Replace `Dashboard || Repreneurs`, `Dashboard || Opportunities`, `Analytics || Repreneurs`, and `Analytics || Opportunities` with plain titles.
- Add a shared page-header pattern with colored section icons:
  - green for Repreneurs
  - purple for Opportunities
- Apply the pattern to dashboard, analytics, groups, and find pages.

## Verification

- Build must pass.
- Browser smoke checks must confirm the sidebar no longer shows `Records`.
- Browser smoke checks must confirm plain titles and colored section headers render on representative Repreneur and Opportunity pages.
