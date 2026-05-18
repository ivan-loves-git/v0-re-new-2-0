# Phase 5: Unified Find and Groups Work Surfaces - Context

**Gathered:** 2026-05-18
**Status:** Ready for execution planning
**Source:** Ivan request in Codex session

## Phase Boundary

Phase 5 turns the existing repreneur `Groups` and `Find` pages into a coherent UX pair, then creates equivalent opportunity work surfaces. The work is primarily product and frontend architecture: shared table structure, filter bars, pagination, grouping logic, visual tags, and column choices.

This phase does not rebuild dashboards, analytics, portal routes, matching logic, document handling, or the opportunity database schema unless a small helper function is needed to derive display labels.

## Locked Decisions

- `Groups` and `Find` are both valuable and should remain distinct.
- `Find` is the cross-record search and filtering surface.
- `Groups` is the operating-bucket surface with paginated grouped tables.
- Repreneur Find and Groups should visually match more closely before opportunity equivalents are built.
- Opportunities should receive matching Find and Groups pages under the Opportunities navigation.
- Opportunity journey must be a primary visual tag in opportunity tables.
- Opportunity journey is derived from existing source facts: opportunity availability status, match status, and pursuit stage.
- Do not add a new manually edited `opportunity_journey_status` field in this phase.
- Filters at the top, visual colors, table structure, pagination, grouping, and chosen columns are the key UX quality points.

## Opportunity Journey Labels

The derived labels approved for use:

- Draft
- Live in inventory
- Matching
- Proposed
- Interest received
- Active pursuit
- Intermediary meeting
- Seller meeting
- LOI
- Closed
- Dropped
- Paused
- Archived

## Candidate Opportunity Columns

Prioritize columns that help staff scan and act:

- Reference or public title
- Journey label
- Availability status
- Visibility
- Sector / activity
- Location
- Revenue, EBITDA, headcount
- Date added / freshness
- Source or source type where staff-only context is allowed
- Active pursuit repreneur, if any
- Match counts or pending review signal, if useful without clutter

## Existing Code References

- `components/repreneurs/repreneurs-groups-page.tsx` - current repreneur Groups shell.
- `components/repreneurs/repreneur-table.tsx` - current grouped repreneur table, filters, pagination, tags.
- `components/repreneurs/repreneurs-explore-page.tsx` - current repreneur Find shell.
- `components/repreneurs/repreneur-explore-table.tsx` - current flat repreneur search/filter/sort table.
- `components/opportunities/opportunity-table.tsx` - current opportunity records table.
- `components/opportunities/opportunity-status-badge.tsx` - current opportunity status and visibility badges.
- `lib/types/opportunity.ts` - opportunity status, match status, pursuit stage, and label helpers.
- `lib/actions/opportunities.ts` - staff opportunity list/create/edit actions.
- `lib/actions/opportunity-matches.ts` - match and pursuit data access.
- `app/(dashboard)/opportunities/page.tsx` - current opportunity records route.
- `components/app-sidebar.tsx` - staff navigation.
- `app/(dashboard)/guide/guidelines/page.tsx` - new internal journey explanation page.

## Risks

- Over-abstracting too early could slow down delivery. Extract shared components only where the repreneur and opportunity surfaces genuinely share behavior.
- Opportunity tables can become too wide. Use compact tags and choose columns for staff decisions, not database completeness.
- Grouping and pagination can hide records if filters and counts are unclear. Each group needs visible counts and predictable pagination reset behavior.
- Derived journey labels must be deterministic and documented so staff trust them.
