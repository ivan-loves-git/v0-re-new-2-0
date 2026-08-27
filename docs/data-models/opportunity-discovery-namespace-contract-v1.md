# Opportunity discovery and data-namespace contract v1

## Authority and status

This is the released product and data contract for W-164. It supersedes the
W-021 manual broad-publication operating rule. W-021 remains historical
evidence; it was not rewritten.

The implementation authority is migration
`20260827103000_w164_lifecycle_namespace_visibility.sql` plus the portal and
staff application reads released from PR #74. The migration and its exact
manifest-bound reconciliation were published on 2026-08-27; the final verified
production application SHA is `fe989446e74a5cc1af3afd2e3aeea2b28d0ba2c5`.

## Discovery rule

An opportunity's lifecycle is its publication control inside its own data
namespace:

- `active` is visible in Deal Flow;
- every other lifecycle state is hidden;
- missing title, teaser, sector, location, revenue, EBITDA, headcount or other
  completeness fields is a staff warning, not a visibility blocker;
- an incomplete repreneur thesis suppresses personalized ranking, not the
  neutral live inventory;
- a staff recommendation remains visible to its exact intended repreneur while
  the opportunity is active and the match remains an allowed portal state.

There is no separate staff visibility approval. The retained
`opportunities.repreneur_exposure` column is compatibility data derived in the
same transaction: `active` becomes `anonymized`; all other states become
`staff_only`. No current workflow writes `repreneur_visible`.

## REAL and DEMO namespaces

`opportunities.is_demo` and `repreneurs.is_demo` define two isolated
namespaces. The only allowed pairings are REAL-to-REAL and DEMO-to-DEMO.

Namespace equality is enforced at the database/service authority for match
creation and mutation, portal inventory, manual recommendations, automatic
matching, responses, pursuits, NDA and memorandum access, documents and child
evidence. Cross-namespace reads and actions fail closed.

DEMO-to-DEMO remains available for controlled staff QA. Any row connected to a
DEMO opportunity or DEMO repreneur is excluded from production statistics,
operating queues, reports and real automatic recommendations. Test side
effects use only the approved test sink or an invalid recipient.

Historical cross-namespace matches are retained as immutable audit evidence.
They cannot be changed, deleted, opened or acted on in either portal and they
do not contribute to production statistics or queues. Reclassifying a matched
opportunity or repreneur requires a separate approved data treatment.

## Portal-safe projection

Deal Flow exposes only the approved public-safe projection: neutral reference,
safe public title, safe teaser, sector, activity, location, revenue, EBITDA,
headcount and source-date display. It never exposes source firm, source office,
source contacts, internal notes, internal reference, source teaser, Information
Memorandum or raw identifiers.

If `public_title` is blank, the portal uses `Confidential acquisition
opportunity`. It never falls back to an internal reference, source name,
description or confidential text. A teaser identical to the internal
description is suppressed rather than exposed.

## Reconciliation and rollback

Production reconciliation is manifest-bound and idempotent. A fresh preflight
enumerates every row whose compatibility exposure disagrees with lifecycle,
records a digest and accepts only that exact current manifest. Application
must leave zero mismatches: every active row is `anonymized`; every non-active
row is `staff_only`.

The read-only 2026-08-27 preflight found 104 compatibility changes in the
current dataset:

- 38 REAL active rows normalize to `anonymized` (37 were `staff_only` and one
  carried the legacy `repreneur_visible` value), producing 149 REAL active
  rows visible inside the REAL namespace;
- 57 REAL draft rows with stale `anonymized` values normalize to `staff_only`;
- nine DEMO active rows normalize to `anonymized`, producing 22 DEMO active
  rows visible only inside the DEMO namespace;
- 20 REAL active rows without a safe public title use the neutral placeholder;
  no confidential field is copied into the title.

The same preflight found nine historical cross-namespace matches. They and
their existing dependent audit evidence remain unchanged: 16 pursuit-evidence
rows, two NDA artifacts, one confidential grant and one memorandum
notification. The release makes those relationships inaccessible,
non-actionable and absent from production statistics and operating queues; it
does not delete, reassign or rewrite them.

The apply records only changed compatibility values and their prior audit
metadata. It does not create publication-history events or duplicate W-021
evidence. The guarded rollback restores only rows still equal to the applied
result; concurrent later staff changes make rollback fail closed.

The manifest rollback restores only the compatibility values changed by its
exact recorded W-164 run and is a separate, explicitly authorized production
action. A full return to the superseded W-021 operating model would also need
a reviewed corrective schema migration plus the prior application deployment;
the manifest rollback alone does not restore that old workflow.

## Production proof

The authorized 2026-08-27 reconciliation applied the complete 104-row manifest
with digest
`eff8b0e9a529717310825bcaae7e974941e6f5775953894b2788d0290929f8a2`.
The immutable run is `75b5f1bd-a077-4333-a03e-b4328fc2ed0a`; it recorded 104
changes and 104 exact rollback rows without adding W-021 publication events.

The final production check found zero lifecycle/exposure mismatches. Current
inventory comprised 153 REAL active and 22 DEMO active opportunities, visible
only inside their matching namespaces. All 66 inactive opportunities were
hidden: 58 REAL drafts, three REAL archived, one REAL closed, one DEMO draft
and three DEMO closed. Current-row movement after the manifest therefore
followed the database lifecycle trigger without another publication action.

Portal proof confirmed neutral inventory for an incomplete thesis, safe-title
fallback, no raw or source fields in the projection, and denial of historical
cross-namespace detail and NDA actions. The nine historical cross-namespace
matches and their evidence remain retained and non-actionable.

## Acceptance trace

- lifecycle transition tests cover create, activate, pause and reactivate;
- portal tests cover incomplete thesis, safe neutral inventory, exact-match
  precedence, safe title fallback and raw-field exclusion;
- namespace tests cover REAL-to-REAL, DEMO-to-DEMO and cross-pair denial across
  read and action paths;
- migration rehearsal covers manifest digest, idempotent apply, exact
  postcondition and guarded rollback;
- production proof must report aggregate before/after mismatch counts, zero
  discoverable cross-namespace rows and portal behavior without listing
  confidential records.
