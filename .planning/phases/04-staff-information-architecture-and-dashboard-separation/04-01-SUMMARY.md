---
gsd_type: summary
phase: "04-staff-information-architecture-and-dashboard-separation"
plan_id: "04-01"
status: complete
completed_at: "2026-05-17"
---

# Summary 04-01: Split Staff Navigation and Route Redirects

## Completed

- Replaced the mixed `Re-New Team` sidebar group with separate `Repreneurs` and `Opportunities` groups.
- Kept `Tools` and renamed the guidance area to `Project`, with only Roadmap visible.
- Hid Journey, Opportunity Reviews, Mission, Instructions, and Offers from sidebar navigation while preserving their routes.
- Redirected `/dashboard` to `/dashboard_re` and `/analytics` to `/analytics_re`.
- Updated staff login and portal redirects to prefer `/dashboard_re`.

## Executive Summary

Staff navigation now follows the actual operating model: repreneur work and opportunity work are separate areas. Old links still work through redirects, so the change improves clarity without breaking existing access.
