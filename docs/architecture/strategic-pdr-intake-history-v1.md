# Strategic PDR intake and history v1

Ticket #43 keeps PDR-owned evidence inside authenticated WAVE without making
PDR a delivery system again. GitHub remains the authority for Product Changes,
Decisions, Tickets, discussion and delivery state.

## Runtime boundary

- All PDR reads and writes use `lib/pdr/intake-server.ts`, a server-only
  service-role adapter behind Better Auth staff checks.
- The browser never receives a PDR service credential, storage path, legacy
  attachment JSON, or signed storage URL.
- New attachments are saved in the private `pdr-intake-attachments` bucket and
  streamed only from the staff-authorized attachment route.
- Old attachment JSON is preserved in place as historical evidence but is not
  exposed as a link. It must be individually reconciled and privately
  registered before it is downloadable from WAVE.
- Historical PDR Work Cards remain presentation-only and are not read as
  current delivery authority. The cutover migration freezes their table.

## Identity and disposition

Request identity comes from the current Better Auth session; the submitted
form cannot select an actor. The only disposition mutator additionally checks
`wave_pdr_governance_capabilities` for the exact current user id. Production
cutover must seed **only Ivan's current Better Auth user id** in that table;
staff role alone is insufficient.

## Release gates

`20260830113000_wave_pdr_staff_intake.sql` revokes the old PDR public reads
and freezes legacy Work Cards. It must not be applied until all of the
following are ready in the same protected cutover:

1. private attachment bucket and WAVE pages are deployed;
2. the exact Ivan capability has been seeded and tested; and
3. the public standalone PDR retirement gate is explicitly passed.

Before the migration, reconcile record counts and immutable identifiers for
`pdr_proposals`, `pdr_requests`, `pdr_feedback`, and `pdr_work_cards` against
the existing standalone PDR. Do not rewrite historical rows to make the counts
fit. A failed PDR query is surfaced as unavailable; WAVE must not substitute a
PDR Work Card or create a GitHub item as a fallback.

## Rollback boundary

Before public retirement, rollback means restore only the former table grants,
remove the Work Card freeze trigger and the added proposal constraints. Do not
delete private copied attachment records/objects or the singleton capability:
they are immutable cutover evidence. Once public retirement is accepted,
rollback requires a new governance decision rather than restoring a public PDR.
