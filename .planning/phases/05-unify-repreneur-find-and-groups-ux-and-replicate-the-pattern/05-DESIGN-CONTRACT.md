# Phase 5 Design Contract: Find, Groups, and Opportunity Journey

## Purpose

Phase 5 gives staff a consistent way to work with repreneurs and opportunities without flattening different jobs into one generic table. `Find` is for cross-record search. `Groups` is for operating buckets and daily work.

## Shared Page Anatomy

Every Find or Groups surface should use the same broad structure:

1. Page title and short operational description.
2. Primary actions in the header, such as New, Import, or Export.
3. Filter bar directly above the table.
4. Active-filter reset when any filter is applied.
5. Bordered table shell with compact rows.
6. Clickable primary record cell leading to the detail page.
7. Empty state that names the current filter condition.
8. Pagination or group counts that make hidden records visible.

## Find Surface

`Find` is a flat, searchable table across the whole domain.

- It should prioritize search, filters, sorting, and row navigation.
- It should show enough columns to compare records quickly.
- It should not group records into lifecycle buckets.
- It should keep filters stable and visible while the user scans results.

## Groups Surface

`Groups` is an operating-bucket table.

- It should show meaningful buckets with counts.
- It should keep each group visually distinct without creating a separate page per status.
- It should paginate within groups when record counts grow.
- It should preserve the same row density, badge style, and primary cell behavior as Find.

## Repreneur Pattern

Repreneur Groups and Find remain separate:

- `/repreneurs` is Groups.
- `/repreneurs/explore` is Find.

Both pages should share visual rhythm, filter placement, badge language, table density, row hover behavior, and export access. Groups keeps the lifecycle operating buckets; Find keeps the broader search and comparison tools.

## Opportunity Pattern

Opportunities should receive equivalent surfaces:

- `/opportunities/groups` is Groups.
- `/opportunities/find` is Find.
- `/opportunities` remains Records during the transition.

Opportunity tables should prioritize staff-operating columns:

- Reference or public title.
- Journey label.
- Availability status.
- Visibility.
- Sector and activity.
- Location.
- Revenue, EBITDA, and headcount when available.
- Date added and freshness.
- Source label or source type in staff-only routes.
- Active pursuit repreneur, if present.
- Pending review or match count signal when useful.

## Opportunity Journey Contract

Opportunity journey is a display label, not a database field.

It is derived from:

- Opportunity availability status.
- Opportunity match status.
- Active pursuit stage.

The source facts remain separate so the journey label cannot disagree with workflow state. The helper lives in `lib/utils/opportunity-journey.ts`.

### Journey Priority

Availability-level terminal or inactive states win first:

1. `draft` -> Draft.
2. `paused` -> Paused.
3. `archived` -> Archived.
4. `closed` -> Closed.

For active opportunities:

1. Active pursuit with stage -> stage label.
2. Active pursuit without stage -> Active pursuit.
3. Any interested match -> Interest received.
4. Any proposed match -> Proposed.
5. Any draft or shortlisted match -> Matching.
6. Only declined or dropped matches -> Dropped.
7. No matches -> Live in inventory.

## Badge Language

Use compact badges as scan anchors:

- Repreneur lifecycle: commercial relationship state.
- Repreneur journey: acquisition-readiness state.
- Opportunity journey: first visible deal-flow state.
- Opportunity availability: source operational state.
- Visibility: staff/repreneur disclosure boundary.

Avoid adding a new color system unless existing badge variants cannot support the distinction. The goal is a calm scanning system, not decorative status noise.

## Component Boundary

Extract shared components only when a second page needs the same behavior immediately. Good candidates:

- Filter bar shell.
- Active-filter reset row.
- Compact record primary cell.
- Pagination summary.
- Opportunity journey badge.

Do not extract a generic mega-table unless the duplication becomes real and painful.

## Verification Notes

Plan 05-01 verification focuses on deterministic journey behavior and contract clarity:

- Unit tests cover opportunity journey derivation.
- Build must pass.
- Later plans verify browser behavior on the actual pages.

## Executive Summary

Phase 5 should make the work surfaces feel like one operating system. Staff can search broadly in Find, work buckets in Groups, and read the same badge language across people and deals.

The key product choice is that opportunity journey is derived, not manually edited. This keeps the interface simple for staff while preserving clean source facts underneath.
