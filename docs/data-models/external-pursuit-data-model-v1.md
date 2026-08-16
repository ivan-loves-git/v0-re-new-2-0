# WAVE External Pursuit Data Model v1

## Contract status

| Item | Value |
| --- | --- |
| Status | Approved implementation contract for W-104 through W-108 |
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

W-106 adds owner route `/portal/pursuits` and staff route
`/opportunities/pursuits`. They present one provenance-labelled board: External
Pursuits are editable standalone dossiers, while Re-New cards are read-only
projections of the existing canonical journey. `/portal/deals` remains Re-New
discovery. Every External card is visibly labelled `External`; every canonical
card is visibly labelled `Re-New · read-only`. The mandatory notice states that
External Pursuits are visible to their owner and authorised Re-New staff and
never enter matching, source records, confidentiality gates, exports or Re-New
KPIs. No acknowledgement is required.

This release creates no outbound notification, email, SMS, push automation,
export or canonical M&A record. The initial `due_at` field is only an
in-product due/overdue state; it sends nothing.

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

| Canonical current journey stage | W-106 board column |
| --- | --- |
| Canonical draft, shortlisted or proposed journey | `identified` |
| Canonical interested or current active-pursuit journey | `contact_qualification` |
| `info_memo_received` | `information` |
| `intermediary_meeting` or `seller_meeting` | `meetings` |
| `loi` | `loi` |
| `closed` | `completed` |
| `dropped` | `dropped_archived` |

The board derives this location through the existing canonical
`deriveOpportunityJourney` helper and role-safe opportunity readers, one
canonical match at a time. An opportunity-level closed state never turns its
proposed or declined sibling matches into completed pursuits: only the match
that genuinely reached `completed`/`closed` or `dropped` receives a terminal
board card. This is only a visual location. It does not infer `negotiation` or
`due_diligence_financing`, write a canonical pursuit stage, or change any
canonical gate, source, match, document or disclosure rule.

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
| `external_pursuits` | Owner, title, macro stage, availability, paired next action/responsibility and in-product due date | Owner and staff receive this dossier state; availability is `available`, `limited`, `unavailable` or `unknown` (the default). `next_action` is optional but when present requires `responsible_party`: `owner` or `staff` |
| `external_pursuit_notes` | Owner-visible notes | Owner and staff receive `shared_notes`; cleared on fulfillment |
| `external_pursuit_staff_notes` | Separate staff-only notes | Never serialized to the owner; cleared on fulfillment |
| `external_pursuit_contacts` | Repeatable people or organisations associated with a pursuit | Same owner/staff rule; deleted with pursuit content |
| `external_pursuit_audit_events` | Immutable actor/time event evidence | Staff only while the dossier exists; purged with it |
| `external_pursuit_deletion_tombstones` | Minimum deletion attribution | Staff-only former dossier ID, owner ID and request/fulfil actor and time; no content |
| `external_pursuit_attachments` | Private dossier file metadata | Owner and authorized staff only; metadata is purged with the dossier after private object cleanup |

W-106 stores optional `external_url`, `target_company`, descriptive
`source_channel`, `revenue_meur`, `ebitda_keur` and `headcount` on the External
Pursuit dossier only. They are nullable, external-only context and never
create, update or link an M&A source, firm, office, contact, opportunity,
match or canonical pursuit.

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
8. Creation is progressive: title alone creates an External Pursuit at
   `identified`; every other W-106 context field is optional. Contacts are
   repeatable standalone records and may be added or revised later.
9. A deletion-requested dossier is hidden and denied to its owner. It remains
   visible to staff only so staff can fulfil the approved purge; it is not an
   editable board item.
10. A board stage move is a narrow patch containing dossier ID, new stage,
    Better Auth actor and idempotency key only. It never resubmits title or
    optional dossier fields, so a stale card cannot overwrite a concurrent
    edit.
11. The editor captures one immutable dossier-and-contact submission snapshot,
    with one parent retry key and one stable client identity and derived retry
    key for each contact. After a partial or ambiguous save it locks editing and
    dismissal until that exact snapshot replays successfully; a changed field
    can never reuse an earlier key and be reported as saved when the database
    correctly replayed the earlier payload. Further edits begin only from the
    reloaded saved state with fresh keys. A row with email, phone or role but no
    name or organisation is rejected visibly; it is never silently discarded.
12. Stage moves, owner deletion requests and staff fulfillment each keep their
    own operation key across an ambiguous network result. Deletion requires a
    confirmation naming the dossier. Staff can inspect all pending dossier
    metadata and contacts before confirming the irreversible purge.
13. W-107 calculates due state from `due_at` as an `Europe/Paris` civil date:
   no date, due today, upcoming, or overdue only when the date is before today.
   It sends no reminder or other outbound communication.
14. W-107's follow-up save is a narrow patch. It never writes title or stage,
   and sends only fields changed since the form loaded, preventing a stale
   follow-up form from overwriting a concurrent board or follow-up change. The
   client retains the exact attempted patch, snapshot and idempotency key until
   success is confirmed. When transport leaves the result ambiguous, all
   follow-up inputs are frozen and only an exact retry is permitted; reverting
   or adding another edit cannot bypass confirmation. Outside recovery, a
   changed payload receives a new key. The database serializes the write and
   makes same-actor/same-key replay a no-op. It appends actor/time and
   content-free changed-field metadata only; note text is not copied to audit,
   errors, logs or analytics.
15. W-108 attachments are separate from `opportunity_documents`, NDA artifacts,
   information memoranda, source teasers and interaction evidence. They are
   never exported, matched, scored, used as a Gate input or projected to an
   opportunity or canonical pursuit.
16. Only PDF, DOC, DOCX, XLS, XLSX, CSV, JPG/JPEG, PNG, WEBP and GIF are
   accepted, each at most 20 MiB. The server validates extension, declared MIME
   and the complete bounded file structure: PDFs require a complete, inactive
   PDF envelope; OOXML files require their expected package entries and reject
   macro/archive/polyglot content; legacy Office files require their expected
   compound-document stream; CSV is scanned as UTF-8 text; and images require
   their complete type envelope. Executables, HTML, SVG and generic archives are
   rejected. Objects have random safe paths in the private
   `external-pursuit-attachments` bucket; browser storage policies and public
   URLs are never created.
17. The owner or authorized staff may list, upload, download and remove an
   active dossier's attachments. Downloads are 60-second signed redirects after
   exact server-side dossier and attachment authorization. Unassigned users and
   other repreneurs are denied. Every register/remove writes immutable actor/time
   audit evidence. The role-safe list includes declared type, upload date and a
   safe uploader label (`You`, `Re-New staff` or `Dossier owner`); raw staff user
   identifiers are never sent to an owner.
18. Staff fulfillment first removes every private object. Any storage failure
   stops fulfillment before metadata/content purge and tombstone creation. Once
   objects are gone, metadata is removed and W-105's existing fulfillment
   primitive may write its minimal tombstone; retry is safe.

## Acceptance matrix

| Scenario | Expected result |
| --- | --- |
| Owner creates or edits an active record | Allowed; immutable audit event records actor/time |
| Staff creates or edits for an assigned owner | Allowed; immutable audit event records actor/time |
| Other repreneur or unassigned user reads/writes | Denied before database access |
| Owner reads record | In W-106 sees the title, stage, availability, optional external URL/target company/descriptive source channel/external-only metrics and contacts of the owner’s active dossier. W-107 separately owns shared notes and follow-up surfaces; W-108 later adds owner attachment metadata/downloads for that owner only |
| Staff reads record | In W-106 sees the same dossier metadata and contacts for every owner, including pending-deletion content for review. W-107 separately adds staff note/follow-up surfaces and W-108 later adds attachment metadata |
| Owner requests deletion | A confirmation names the dossier; the retry-safe request is recorded and staff retains pending content to fulfil safely |
| Staff fulfils deletion | Staff reviews the pending dossier, confirms the named irreversible purge, and can safely replay an ambiguous response; only the minimal tombstone remains |
| W-108 attachment cleanup fails | Its fulfillment wrapper fails; no completion message is allowed |
| Owner/staff saves W-107 follow-up | The permitted shared fields save with actor/time evidence; staff notes remain absent from the owner projection |
| Other repreneur/unassigned caller saves W-107 follow-up | Denied at the server and database boundary |
