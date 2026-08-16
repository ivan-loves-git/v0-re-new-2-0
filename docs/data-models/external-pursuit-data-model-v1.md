# WAVE External Pursuit Data Model v1

## Contract status

| Item | Value |
| --- | --- |
| Status | Approved implementation contract for W-104 and W-105 |
| Scope | A repreneur-owned record of work outside WAVE opportunities |
| Implementation owner | Dev team |
| Visibility | The owner repreneur and authorized staff only; all other repreneurs and unassigned users are denied |

This is a separate model from the canonical M&A contract in
`ma-advisory-data-model-v1.md`. It never creates, changes, imports, exports,
matches, pursues, gates, or discloses an `opportunity`, `opportunity_match`, or
canonical opportunity-pursuit record. It is also not a historical-interaction
import target.

## Delivery boundary and dependent cards

W-105 implements this persistence, authorization, role-safe projection,
immutable audit and delete-on-request foundation. W-106 and W-107 can build the
owner and staff dossier surfaces on it; W-108 adds private attachment handling;
W-109 adds the staff-only conversion into a linked canonical opportunity; W-110
uses representative synthetic dossiers; and W-111 runs the final M2.1
validation suite. No historical import, legacy
backfill, reviewer loop or M2 validation is a dependency of this contract.

This beta-safe release creates no UI route, outbound notification, email, SMS,
push automation, export or canonical M&A record. The initial `due_at` field is
only an in-product due/overdue state; it sends nothing.

## Purpose and lifecycle

An External Pursuit is a staff-visible, repreneur-owned record of an independent
acquisition search or relationship. It does not represent a Re-New mandate or a
WAVE opportunity.

It is not a private personal CRM: authorised Re-New staff can see all dossier
detail by default. Only staff-internal notes are hidden from the owner. W-106
and W-111 must present this plainly in the owner-facing notice and test that it
is understood before beta use.

| Stage | Meaning | Who can act |
| --- | --- | --- |
| `identified` | Initial dossier | Owner repreneur and staff |
| `contact_qualification` | Contact / qualification | Owner repreneur and staff |
| `information` | Information gathering | Owner repreneur and staff |
| `meetings` | Meetings | Owner repreneur and staff |
| `negotiation` | Negotiation | Owner repreneur and staff |
| `loi` | Letter of intent | Owner repreneur and staff |
| `due_diligence_financing` | DD / financing | Owner repreneur and staff |
| `completed` | Completed | Owner repreneur and staff |
| `dropped_archived` | Dropped / archived | Owner repreneur and staff |
| Delete requested | Owner asked for deletion; content remains available only to staff until fulfilled | Owner may request; staff fulfills |
| Deleted tombstone | The dossier, content, contacts and ordinary audit are removed; only minimal attributed identity remains | Staff may read the tombstone; owner and other repreneurs cannot |

Deletion is deliberately two-step. An owner requests it; authorized staff
fulfils this no-attachment foundation by purging the dossier. W-108 extends the
staff fulfillment wrapper to remove private file objects first; a failed storage
deletion must leave the record intact and cannot create a partial tombstone.

Existing Re-New opportunity and canonical-pursuit states are read-only
projections onto this macro-stage map. Their existing canonical state, Gate,
lock and disclosure rules remain authoritative. No External Pursuit board move
may guess a mapping or mutate a Re-New record; W-106 finalizes the exact
projection display mapping only.

## W-105–W-111 acceptance traceability

| Card | Fixed rule or exception | Executable evidence |
| --- | --- | --- |
| W-105 | Separate domain; actor/time audit; owner/staff boundary; deletion tombstone | Migration 093, role-safe server actions, disposable owner A/B/staff rehearsal |
| W-106 | Owner and staff title-only progressive intake, one Re-New/External provenance board, explicit staff-visibility notice and read-only canonical mapping | Owner/staff UI/browser tests; no acknowledgement requirement; no board move changes a Re-New record |
| W-107 | Shared and staff-only notes, next action, due date, responsible party and visible due/overdue state with no outbound automation | Staff browser test, owner projection regression and no-email/no-push boundary test |
| W-108 | Private attachments and delete-before-fulfil cleanup | Storage cleanup failure/retry test; no success before object removal |
| W-109 | Staff-only conversion to a linked canonical opportunity | Explicit conversion action test; no generic board mutation or Gate shortcut |
| W-110 | Dedicated external capacity, freshness and availability aggregates; explicit exclusion from Re-New KPI, export and analytics | Aggregate and exclusion tests using synthetic fixtures |
| W-111 | Final M2.1 validation and owner notice | Full role, mobile, privacy and release suite |

## Tables and visibility

| Table | Purpose | Visibility / retention |
| --- | --- | --- |
| `external_pursuits` | Owner, title, macro stage, availability and in-product due date | Owner and staff receive this dossier state; availability is `available`, `limited`, `unavailable` or `unknown` (the default) |
| `external_pursuit_notes` | Owner-visible notes | Owner and staff receive `shared_notes`; cleared on fulfillment |
| `external_pursuit_staff_notes` | Separate staff-only notes | Never serialized to the owner; cleared on fulfillment |
| `external_pursuit_contacts` | Repeatable people or organisations associated with a pursuit | Same owner/staff rule; deleted with pursuit content |
| `external_pursuit_audit_events` | Immutable actor/time event evidence | Staff only while the dossier exists; purged with it |
| `external_pursuit_deletion_tombstones` | Minimum deletion attribution | Staff-only former dossier ID, owner ID and request/fulfil actor and time; no content |

There are no browser database policies for these tables. All access is through
server-side Better Auth checks and the service-role client. Direct anon and
authenticated database access is revoked.

The tombstone additionally retains one opaque fulfillment idempotency key solely
to make an interrupted staff fulfillment retry-safe. It is never projected,
exported or treated as dossier content; a different fulfillment key is rejected.

## Required rules

1. Every non-deleted External Pursuit has exactly one canonical repreneur owner.
2. The owner repreneur and staff may create, read and edit active records. A
   repreneur can never read or write another owner’s record. Unassigned users
   are denied.
3. `shared_notes` are owner-visible. `staff_internal_notes` are physically
   separate and staff-only. No action serializes staff notes to an owner.
4. Contacts are repeatable records; they do not create or link canonical M&A
   contacts, firms, offices, opportunity source records, matches or pursuits.
5. Create, update, contact changes and deletion requests append immutable audit
   events with actor and timestamp. They cannot be updated or deleted normally;
   controlled fulfillment purges the ordinary audit with the dossier and writes
   the minimum request/fulfil attribution to the tombstone.
6. Staff fulfillment removes the entire dossier row, shared/internal notes,
   contacts and ordinary audit events, while retaining only former dossier ID,
   owner ID, request/fulfil actor and time in the tombstone. W-108 owns private
   attachments; its delete path must
   remove objects before calling this fulfillment primitive and may not claim
   success while cleanup remains.
7. No historic interaction is imported in this phase. Any later supplied source
   material needs a separately approved mapping and retention decision.

## Acceptance matrix

| Scenario | Expected result |
| --- | --- |
| Owner creates or edits an active record | Allowed; immutable audit event records actor/time |
| Staff creates or edits for an assigned owner | Allowed; immutable audit event records actor/time |
| Other repreneur or unassigned user reads/writes | Denied before database access |
| Owner reads record | In this phase sees title, shared notes and contacts only; there is no attachment field. W-108 later adds owner attachment metadata/downloads for that owner only |
| Staff reads record | In this phase sees shared/internal notes, contacts and audit timeline; W-108 later adds attachment metadata |
| Owner requests deletion | Request is recorded; staff retains pending content to fulfil safely |
| Staff fulfils deletion | The dossier and content are purged; only the minimal tombstone remains |
| W-108 attachment cleanup fails | Its fulfillment wrapper fails; no completion message is allowed |
