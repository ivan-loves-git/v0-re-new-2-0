# 06-02 Summary: M&A Source Directory UI

## Completed

- Added `/opportunities/ma` as a staff-only Opportunities page.
- Added an `M&A` sidebar item under the Opportunities group.
- Added source directory stats: total sources, sources with email, open opportunities, and stale follow-ups.
- Added a searchable source table with source type, contact details, linked opportunity counts, latest opportunity, and notes.
- Added create/edit dialog for source firm, type, contact name, email, phone, and notes.

## Verification

- The page uses the same section-header and shadcn table/card/dialog patterns as the rest of the staff UI.
- Source create/edit actions are staff-gated and revalidate related opportunity surfaces.

## Scope Guard

Delete, bulk import, owner assignment, communication history, and firm-level pipeline reporting remain outside this V2 slice.
