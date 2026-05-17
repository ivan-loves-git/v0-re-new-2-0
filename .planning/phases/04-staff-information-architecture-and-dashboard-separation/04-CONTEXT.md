---
gsd_type: context
phase: "04-staff-information-architecture-and-dashboard-separation"
created_at: "2026-05-17"
status: complete
---

# Phase 4 Context

## Goal

Separate internal staff navigation and dashboards into two clear domains:

- Repreneurs: repreneur pipeline, groups, find, emails, and repreneur analytics.
- Opportunities: opportunity operations, opportunity records, and opportunity analytics.

## Locked Decisions

- Use flat route names: `/dashboard_re`, `/dashboard_op`, `/analytics_re`, `/analytics_op`.
- Keep legacy `/dashboard` and `/analytics` as redirects to repreneur equivalents.
- Hide Journey, Opportunity Reviews, Mission, and Instructions from the sidebar, but do not delete the routes.
- No database migration.

## Relevant Existing Files

- `components/app-sidebar.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/analytics/page.tsx`
- `components/analytics/period-selector.tsx`
- `lib/access-control.ts`
- `lib/supabase/proxy.ts`

## Acceptance Criteria

- Staff sidebar has Repreneurs, Opportunities, Tools, and Project groups.
- Repreneur dashboard has no opportunity KPI/freshness content.
- Opportunity dashboard is operational and queue-focused.
- Opportunity analytics contains the opportunity KPI panel.
- Repreneur analytics keeps the existing analytics surface.
- Archived pages remain direct-link accessible.
