# WAVE M&A Data Model and Dictionary v1

## Contract status

| Item | Value |
| --- | --- |
| Status | Approved and live contract |
| Implementation status | Migrations 076 to 083 are live and schema-verified. W-010 activated Colin's approved 28 July workbook in production on 2026-07-28: WAVE is now the sole operational record for the imported snapshot and Excel is read-only evidence. The activation reconciled 148 opportunity references, 229 firms, 431 offices, 575 named contacts and 603 active affiliations; temporary staging was purged and the retained manifest contains only approved aggregate evidence. The canonical office/contact model, W-064 provisional Acme foundation, W-062 interaction persistence, W-066 staff Relationships workspace, W-043 staff-only NDA artifact foundation and W-072 purpose-aware email suppression are live. W-071 post-cutover reconciliation and W-069's permanently staff-only source-teaser retention remain approved target behavior and are not yet implemented. |
| Contract owner | Ivan Paudice, CTO and product owner |
| Implementation owner | Dev team |
| Business reviewers | Bertrand and Colin when a real operating case needs confirmation |
| PDR scope | W-001, repreneur action and staff-verified transition authority; W-021, conditional source-identity disclosure; W-043, canonical NDA artifact foundation; W-061, M&A office and contact identity foundation; W-062, canonical interaction persistence; W-066, staff relationship timeline and interaction capture; W-063, canonical staff opportunity intake; W-064, provisional source foundation; W-065, staff review workflow; W-069, separate permanently staff-only source teaser; W-020, controlled one-time cutover staging; W-010, production activation and WAVE-only switch; W-013, WAVE-only adoption proof; W-042, lifecycle communication enforcement; W-071, post-cutover opportunity classification and identity reconciliation; W-072, purpose-aware M&A contact campaign email suppression |
| Last reviewed against live Supabase | 2026-07-30 |
| Last reviewed against source workbook | 2026-07-30, Colin's approved 2026-07-28 `CRM M&A for Ivan.xlsx` snapshot |

This is the only human-readable source of truth for the M&A advisory data model. Supabase enforces the released implementation. This document defines the approved business meaning, target relationships, requiredness and visibility.

If the released database and this contract disagree, the difference must be made explicit. Do not silently change the document to describe an accidental implementation and do not call a target rule implemented until it is verified in the live database.

Any change to the M&A schema, business validation, visibility rule or import mapping must update this document in the same commit before release.

W-061 core scope is the firm, office, contact affiliation and opportunity source foundation. W-062 core scope is the office-anchored interaction history. Interaction attachments, discovery provenance and geography confidence are valid optional capabilities, but they do not block either core card unless the PDR explicitly brings them into scope.

The W-061 foundation deliberately does not add an opportunity sourcing channel. Ivan rejected that proposal. It also retires `opportunities.repreneur_exposure` from the target operating model: the legacy column remains only while old reads are migrated, and is not an active intake, import or disclosure control. Until those reads are removed, the W-061 service writes `staff_only` for every new record and every transition from or to `draft` as a compatibility firewall; it does not backfill or alter an already visible active record. W-063 is the staff application boundary for those rules: activation never publishes an opportunity.

## Requiredness language

| Label | Meaning |
| --- | --- |
| System | Generated and maintained by WAVE |
| Always | Required when the record is created |
| Valid opportunity | Required before an opportunity may leave `draft` and while it is `active` or `paused` |
| Repreneur visible | Required before an opportunity may be exposed to a repreneur |
| Conditional | Required only when the stated condition is true |
| Optional | May be absent without making the record invalid |

Database `NOT NULL` is not a substitute for this contract. A database field may remain nullable to support drafts or migration staging while still being required at a later business gate.

Closed and archived opportunities preserve the source and contact history that was valid when work occurred. They are not required to keep a currently active affiliation or usable current email.

## Model at a glance

```mermaid
flowchart LR
    Firm["M&A advisory firm"] -->|"one or more"| Office["Operating office"]
    Contact["Contact identity"] --> Affiliation["Office affiliation"]
    Office --> Affiliation
    Office -->|"exactly one source"| Opportunity["Opportunity"]
    Opportunity --> OpportunityContact["Opportunity contact"]
    Affiliation --> OpportunityContact
    Office --> Interaction["Interaction"]
    Affiliation -. "optional contact context" .-> Interaction
    Opportunity -. "optional opportunity context" .-> Interaction
    Interaction --> Attachment["Interaction attachment"]
    Opportunity --> OpportunityDocument["Opportunity document"]
    OpportunityDocument --> NdaArtifact["Immutable NDA artifact version"]
    Opportunity -. "optional active pursuit" .-> NdaArtifact
```

The constant relationship chain is:

`M&A advisory firm → operating office → contacts, opportunities and interactions`

Every non-archived firm has at least one active office. A firm without a known branch structure receives one synthetic default office. A multi-office firm has no fallback office: staff must select the real office. Contacts may work across several offices through affiliations. Opportunities and interactions never attach directly to a firm.

`Network` is optional information on a firm. It is not a separate operational entity in version 1.

## 1. M&A advisory firm

**Purpose:** the stable identity of the M&A advisory business. It is not an office and it does not directly own contacts, opportunities or interactions.

**Target table:** `ma_firms`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable internal identity |
| `name` | Text | Always | Staff only | WAVE | Human-readable firm name; trimmed and non-empty |
| `status` | `prospect`, `active`, `archived` | Always | Staff only | WAVE | Defaults to `prospect`; archiving preserves history |
| `category` | Controlled text | Optional | Staff only | WAVE | Examples include M&A boutique, advisory bank and transaction advisory; taxonomy may evolve without changing relationships |
| `network_label` | Text | Optional | Staff only | WAVE | Informational grouping only; it cannot own contacts, opportunities, scoring or workflow |
| `website_url` | URL | Optional | Staff only | WAVE | Firm-level website |
| `discovery_channel` | Controlled text | Optional | Staff only | WAVE | How Re-New first identified the firm |
| `discovery_url` | URL | Optional | Staff only | WAVE | Evidence supporting the discovery channel |
| `discovered_at` | Date | Optional | Staff only | WAVE | Date the firm was added to the source dataset |
| `internal_notes` | Text | Optional | Staff only | WAVE | Relationship context; never exposed to repreneurs |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Last change audit |
| `archived_by`, `archived_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when archived |

### Firm rules

1. Every non-archived firm has at least one active operating office.
2. Creating a firm without a known real office creates one synthetic default office with the same name.
3. A firm may exist as a prospect without contacts or opportunities.
4. A referenced firm is archived, never hard deleted.
5. A firm with an `active` or `paused` opportunity through any of its offices cannot be archived. Staff first closes, archives or moves those opportunities in the same transaction.
6. New firm identity intake creates the firm, its real or synthetic initial office, a named contact and an active affiliation atomically. A real office is used whenever one is known; a synthetic default is used only when it is not.
7. Canonical firm intake serializes on the lower-trimmed name and rejects an existing exact canonical match. It does not merge records automatically.
8. Firm name similarity may raise a duplicate warning but does not merge records automatically.

## 2. Operating office

**Purpose:** the exact operational location or unit through which Re-New manages contacts, opportunities and interactions.

**Target table:** `ma_offices`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable internal identity |
| `firm_id` | UUID | Always | Staff only | WAVE | Exactly one parent firm |
| `name` | Text | Always | Staff only | WAVE | Office name; default office may use the firm name |
| `status` | `active`, `archived` | Always | Staff only | WAVE | Defaults to `active` |
| `is_default` | Boolean | Always | Staff only | WAVE | `true` only for the synthetic office created when no real office is known |
| `city` | Text | Optional | Staff only | WAVE | Main office city |
| `address` | Text | Optional | Staff only | WAVE | Postal address when operationally useful |
| `region_codes` | List of controlled codes | Optional | Staff only | WAVE | Geographic coverage using the canonical WAVE geography taxonomy |
| `coverage_note` | Text | Optional | Staff only | WAVE | Free-text exception or national coverage note |
| `geography_confidence` | `confirmed`, `review` | Conditional | Staff only | WAVE | Used when imported geographic classification needs review |
| `website_url` | URL | Optional | Staff only | WAVE | Office-specific website |
| `general_email` | Email | Optional | Staff only | WAVE | Office mailbox; it is not a person and cannot be an opportunity primary contact |
| `general_phone` | Text | Optional | Staff only | WAVE | Office telephone |
| `internal_notes` | Text | Optional | Staff only | WAVE | Office-specific relationship context |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Last change audit |
| `archived_by`, `archived_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when archived |

### Office rules

1. An office belongs to exactly one firm.
2. At most one synthetic default office may exist for a firm.
3. A multi-office firm has no automatic fallback. Staff must select the real office.
4. When a real active office becomes known, WAVE removes the synthetic default from intake selection and rejects it for new or changed opportunity source contexts. Historical links remain until staff resolves any active records.
5. An office with referenced contacts, opportunities or interactions is archived, never hard deleted.
6. Contacts, opportunities and interactions attach to an office, never directly to the firm.

## 3. Contact

**Purpose:** one stable WAVE identity for one person.

**Target table:** `ma_contacts`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable person identity |
| `first_name` | Text | Conditional | Staff only | WAVE | At least one of first name or last name is required |
| `last_name` | Text | Conditional | Staff only | WAVE | At least one of first name or last name is required |
| `display_name` | Text | System | Staff only | WAVE | Derived from the available name fields |
| `status` | `active`, `archived` | Always | Staff only | WAVE | Defaults to `active` |
| `email` | Email | Optional | Staff only | WAVE | Normalized for comparison; not globally unique |
| `phone` | Text | Optional | Staff only | WAVE | Normalized for search while preserving the entered display value |
| `linkedin_url` | URL | Optional | Staff only | WAVE | Person-level profile |
| `internal_notes` | Text | Optional | Staff only | WAVE | Person-level relationship context |
| `campaign_email_suppressed` | Boolean | Always | Staff only | WAVE | Defaults to `false`; blocks campaign, bulk and general relationship outreach to this person |
| `campaign_email_suppression_reason` | Text | Conditional | Staff only | WAVE | Required while campaign email is suppressed; explains the retained source or staff decision |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Last change audit |
| `archived_by`, `archived_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when archived |

### Contact rules

1. A contact is a person, not a generic office mailbox.
2. An active contact has at least one active office affiliation.
3. The same contact may have several office affiliations without duplicating the person.
4. Email is not globally unique. Repeated email raises a warning for review but does not block a legitimate multi-office relationship.
5. A contact without a usable email may exist, but cannot be the primary contact of a valid opportunity.
6. A referenced contact is archived, never hard deleted.
7. Adding a second contact to an office, or affiliating an existing canonical contact to another office, uses the audited `create_or_affiliate_ma_contact` service. It creates no legacy contact or recurrent synchronization record.
8. Campaign suppression belongs to the canonical person and applies across all office affiliations. A suppressed contact is excluded from campaign, bulk and general relationship-outreach audiences, and the final send boundary must reject those purposes even if a caller supplies the address directly.
9. Campaign suppression does not prohibit an explicitly classified opportunity-specific operational message. At W-072 launch, the operational allowlist contains exactly one purpose: an NDA request to a contact actively linked to that opportunity. The send evidence must retain the opportunity, contact, purpose, actor and delivery outcome. Free-text purpose and a generic bypass are not valid authorization. Adding any other operational purpose requires a separately approved PDR decision and an update to this contract before implementation.
10. Setting, changing or removing campaign suppression requires a staff actor, time and reason in immutable audit evidence. The 18 named W-010 contacts retain their imported warning note until structured backfill and send-boundary verification are complete; the note alone is not the target enforcement mechanism.

## 4. Contact office affiliation

**Purpose:** identifies the exact office relationship through which a contact works.

**Target table:** `ma_contact_office_affiliations`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable relationship identity |
| `contact_id` | UUID | Always | Staff only | WAVE | One contact |
| `office_id` | UUID | Always | Staff only | WAVE | One operating office |
| `job_title` | Text | Optional | Staff only | WAVE | Role held at this office |
| `is_active` | Boolean | Always | Staff only | WAVE | Defaults to `true` |
| `started_at` | Date | Optional | Staff only | WAVE | Known relationship start |
| `ended_at` | Date | Conditional | Staff only | WAVE | Required when the affiliation becomes inactive |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `ended_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Change audit |

### Affiliation rules

1. Only one active affiliation may exist for the same contact and office pair.
2. Ending an affiliation preserves every opportunity and interaction that used it.
3. A contact may move offices by ending the old affiliation and creating or activating the new one.
4. An affiliation cannot be deleted while referenced.
5. An affiliation used by an `active` or `paused` opportunity may end only after staff links a replacement at the same office or closes or archives the opportunity.
6. If the ending affiliation is primary, staff must identify the replacement primary contact before operational work can continue.
7. The canonical contact-affiliation service rejects a duplicate active contact-and-office pair. If a person returns after an earlier affiliation ended, it creates a new active affiliation and retains the ended row as history.

### Canonical contact-affiliation write boundary

W-063 adds an additional person to an existing office, or links an existing canonical person to an additional office, through `create_or_affiliate_ma_contact`. It requires an actor and an active office beneath a non-archived firm. With `p_existing_contact_id`, it affiliates that active canonical contact and rejects contact profile fields; without it, it creates one named person from the supplied name fields. The staff action treats those modes as mutually exclusive: a new-person submission rejects every non-empty or non-string existing-contact ID value, and existing-person mode requires exactly one non-empty string UUID with no repeated contact-ID entries and no non-empty or repeated person-identity entries. `p_contact_job_title` belongs to the affiliation in either mode. The service returns `contact_id` and `affiliation_id`, rejects an already-active pair, and never creates or mutates `ma_source_contacts`, `opportunity_source_contacts` or a recurrent legacy sync record.

## 5. Opportunity

**Purpose:** one acquisition opportunity sourced through exactly one operating office.

**Target table:** `opportunities`, evolved additively from the current table.

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable internal identity |
| `reference` | Text | Always | Staff and repreneur when visible | WAVE | Unique Re-New reference |
| `status` | `draft`, `active`, `paused`, `archived`, `closed` | Always | Role appropriate | WAVE | Defaults to `draft`; leaving draft activates validity rules |
| `source_office_id` | UUID | Valid opportunity | Staff only | WAVE | Exactly one source office |
| `location` | Text | Repreneur visible | Role appropriate | WAVE | Reader-facing location |
| `geography_node_id` | UUID | Optional | Staff only | WAVE | Canonical W-039 matching-geography identity; never the workbook `Geo_code` |
| `geography_confidence` | `confirmed`, `review` | Conditional | Staff only | WAVE | Required when imported geography needs review |
| `sector` | Controlled label | Repreneur visible | Role appropriate | WAVE | Reader-facing canonical sector |
| `sector_confidence` | `confirmed`, `review` | Conditional | Staff only | WAVE | Required when imported sector needs review |
| `description` | Text | Valid opportunity | Staff only | WAVE | Full internal opportunity description |
| `revenue_meur` | Numeric | Optional | Role appropriate | WAVE | Revenue in millions of euros; missing remains `null` |
| `ebitda_keur` | Numeric | Optional | Role appropriate | WAVE | EBITDA in thousands of euros; missing remains `null` |
| `headcount` | Integer | Optional | Role appropriate | WAVE | Exact headcount when known |
| `headcount_range` | Controlled text | Optional | Role appropriate | WAVE | Range when exact headcount is not known |
| `date_added` | Date | Optional | Staff only | WAVE | Source-reported or staff-entered opportunity date; it is not the WAVE creation timestamp |
| `date_added_precision` | `day`, `month` | Conditional | Staff only | WAVE | Required when `date_added` is present; preserves whether the source supplied a full calendar date or only month and year |
| `public_title` | Text | Repreneur visible | Repreneur when visible | WAVE | Anonymized reader-facing title |
| `teaser_summary` | Text | Repreneur visible | Repreneur when visible | WAVE | Approved anonymized summary |
| `internal_notes` | Text | Optional | Staff only | WAVE | Operational notes; never exposed |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit; `created_at` is when the WAVE record was created |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Last change audit |
| `archived_by`, `archived_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when archived |

### Opportunity rules

1. A draft may be incomplete.
2. An opportunity may leave `draft` only when it has a source office, description, at least one named contact, exactly one primary contact and a usable email for that primary contact.
3. Every active opportunity contact must use an active affiliation with the opportunity's source office.
4. Repreneur disclosure is a separate downstream decision. It additionally requires location, sector, public title, teaser summary, the relevant match or staff assignment, and the existing confidentiality gates.
5. Source firm, source office and named source contact remain staff only except for pursuit-scoped disclosure after both pursuit-specific signed copies remain valid, a Gate 2 pass is recorded and staff explicitly approves disclosure. Relationship history, source-review evidence, notes and audit metadata remain staff only at every stage.
6. Missing financial values remain `null`. Matching may apply a zero-equivalent only inside scoring and must flag incomplete inputs.
7. The source name shown in staff views is derived through the office and firm relationship. It is not stored as a second source relationship.
8. A positioned repreneur is represented by the existing match and pursuit objects, never by free text on the opportunity.
9. If an `active` or `paused` opportunity loses its usable primary contact email, WAVE blocks further operational mutations. Staff must correct the email, select another primary contact or close or archive the opportunity.
10. Closing or archiving an opportunity preserves its historical source office and contact links even when those contacts later move or become inactive. Canonical opportunity links capture contact snapshots at the time of linking; the migration 072/075 snapshots remain immutable compatibility evidence.
11. Staff create and edit use the atomic office-context services only. They do not write `source_id`, `source_label`, `opportunity_source_contacts`, `repreneur_exposure`, an origin channel or a separate source-contact relationship.
12. The atomic intake service cannot reopen a `closed` or `archived` opportunity. Reopening is a separate explicit workflow with its own audit and approval rules.
13. `date_added` and `date_added_precision` are both null when no source date is known. A known full calendar date uses precision `day`.
14. A source value containing only month and year is stored technically as the first day of that month with precision `month`. The artificial day must never be displayed, exported, described as an event day or used for day-level age or service-level reasoning.
15. A shared Acme provisional source context may be assigned only by staff. The stored fact is the existing canonical `source_office_id` link to Acme's office; “Source review required” is computed and is not a parallel stored review status. Acme may support `draft`, `active` and `paused` work while staff resolves the real source, but it cannot be used to close or archive an opportunity or to satisfy `cutover-ready` or `cutover-complete` treatment. Acme is never renamed into an actual intermediary; resolution changes the opportunity to the real office and retains the Acme assignment and reason in immutable correction evidence.
16. A blank source-workbook platform title never clears a non-blank WAVE `public_title`. The approved W-010 workbook contains 109 blank title cells, but preservation of existing WAVE values left only 20 newly created Draft/staff-only opportunities without a live public title. Those 20 require staff-authored anonymized titles before repreneur disclosure; the source count and the live action queue must not be conflated.
17. Colin's 2026-07-29 confirmation makes the workbook's positioned-repreneur list current source evidence, not automatic identity authority. A row is linked only when its label resolves to one unique canonical repreneur. Ambiguous or absent identities remain unlinked with staff review evidence; no new profile is invented and no opportunity stores the label as free text.
18. W-074 provides a staff-only CSV export with one row per opportunity. It contains exactly `ref_mandat`, `pipeline_status`, `date_added`, `sector`, `region`, `revenue_eur_m`, `ebitda_eur_k`, `calculated_margin`, `headcount`, `anonymized_description`, `source_firm_contact` and `internal_notes`. `pipeline_status` is WAVE's existing derived opportunity journey. The export omits Opportunity tags and Repreneur Journey stage: neither can have one reliable value in one Opportunity row. The export is generated through a server-side staff action, is not an API route or repreneur projection, does not include source email or phone details, and protects spreadsheet cells from formula execution. `anonymized_description` is the approved `teaser_summary`; source identity resolves from the canonical office and firm first, then from the legacy firm plus its retained primary-contact snapshot, and otherwise remains blank. Free-text `source_label` is never exported. Historical canonical identity retains its contact snapshot when an affiliation is inactive. Month-precision source dates remain month-only in the CSV. The download includes a UTF-8 BOM for Excel. Opportunity and match reads use a fixed request-time boundary plus ID keyset pagination, and match queries use bounded Opportunity-ID chunks, so response caps and concurrent inserts or deletes cannot cause offset drift or duplicate rows.

### Atomic intake write boundary

W-063 and W-020 save opportunity source context, contact selection, description, target status and optional intake fields through the audited `save_opportunity_office_context` and `create_opportunity_with_office_context` RPCs. Their final parameter is `p_opportunity_fields JSONB`, which accepts exactly:

`sector`, `activity`, `location`, `revenue_meur`, `ebitda_keur`, `headcount`, `headcount_range`, `date_added`, `public_title`, `teaser_summary`, and `internal_notes`.

An omitted key preserves the existing value; an explicit JSON `null` clears it. Numeric, integer and date values are parsed inside the same transaction, so a cast or validation failure rolls back source, contact, status and field changes together. The payload rejects unsupported keys and must never accept `source_id`, `source_label`, `source_office_id`, `repreneur_exposure`, `origin_channel`, `imported_from` or `imported_at`. Existing pre-076 `source_id` and `source_label` remain read-compatibility evidence only; the services neither populate nor reconcile them. Active and paused validity is defined by `source_office_id`.

Migration 076 explicitly revokes and drops any intermediate seven-argument opportunity save/create RPC overloads before it defines the final JSONB signatures. A rerun therefore cannot leave a granted pre-allowlist write path behind.

W-010 extended the cutover write boundary so `date_added` and `date_added_precision` were validated and activated together for the approved workbook. Later staff intake or correction must continue to write or clear that pair atomically; no ordinary caller may normalize a month-only value through the earlier date-only allowlist.

### W-065 staff source-review boundary

W-065 is a staff-only application boundary over the live W-064 evidence model. Opportunity detail and staff lists compute `Source review required` from the fixed provisional office plus unresolved append-only assignment evidence; the application returns only that boolean and never a provisional context ID, event, reason, actor, timestamp, or prior/current source snapshot. Staff resolves the review only through `resolve_acme_provisional_source`, supplying a different canonical office, active affiliations at that office, exactly one primary affiliation, and a reason. The RPC reuses `save_opportunity_office_context` inside the same transaction, retains immutable before/after evidence, preserves the opportunity UUID and history, serializes against an active source-email send, and blocks `closed` and `archived` records. The application adds no source-review field, schema migration, browser-role write path, repreneur projection, notification, export, or email action.

## 6. Opportunity contact

**Purpose:** links an opportunity to a contact through the exact office affiliation relevant to that opportunity.

**Target table:** `opportunity_ma_contacts`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable relationship identity |
| `opportunity_id` | UUID | Always | Staff only | WAVE | One opportunity |
| `affiliation_id` | UUID | Always | Staff only | WAVE | Exact contact and office relationship |
| `contact_name_snapshot`, `contact_email_snapshot`, `contact_phone_snapshot` | Text | System | Staff only | WAVE | Immutable contact attribution captured when the link is first created |
| `is_primary` | Boolean | Always | Staff only | WAVE | Exactly one active link is primary for a valid opportunity |
| `is_active` | Boolean | Always | Staff only | WAVE | Defaults to `true` |
| `linked_by`, `linked_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `removed_by`, `removed_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when the link becomes inactive |

### Opportunity contact rules

1. The affiliation office must equal the opportunity source office.
2. A valid opportunity has one or more active contact links and exactly one primary.
3. The primary contact must be named and have a usable email.
4. Removing a contact link ends it. Historical attribution is preserved.
5. No role taxonomy beyond primary versus additional is introduced in version 1.

## 7. Interaction

**Purpose:** records the M&A relationship history before, during or after a specific opportunity.

**Target table:** `ma_interactions`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable interaction identity |
| `office_id` | UUID | Always | Staff only | WAVE | Exact operating office context |
| `affiliation_id` | UUID | Optional | Staff only | WAVE | Contact and office relationship when a person is involved |
| `opportunity_id` | UUID | Optional | Staff only | WAVE | Related opportunity; not required |
| `channel` | `call`, `email`, `meeting`, `document`, `other` | Always | Staff only | WAVE | Interaction type |
| `direction` | `inbound`, `outbound` | Conditional | Staff only | WAVE | Required for email and call; optional for other channels |
| `occurred_at` | Timestamp | Always | Staff only | WAVE | When the interaction happened |
| `owner_staff_user_id` | Staff ID | Always | Staff only | WAVE | Staff member responsible for the interaction |
| `owner_verification_state` | `provisional`, `verified` | Always | Staff only | WAVE | Migrated rows start `provisional` and visibly require the assigned owner to verify them; verification is an append-only staff action |
| `owner_verified_by`, `owner_verified_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required only after the owner has verified their provisional assignment |
| `title` | Text | Optional | Staff only | WAVE | Short label or email subject |
| `summary` | Text | Conditional | Staff only | WAVE | Required unless at least one attachment or stored email body provides the evidence |
| `outcome` | Text | Optional | Staff only | WAVE | Result of the interaction |
| `next_action` | Text | Optional | Staff only | WAVE | Concrete follow-up |
| `next_action_due_at` | Timestamp | Conditional | Staff only | WAVE | Required when a dated next action is committed |
| `template_key` | Text | Conditional | Staff only | WAVE | Required only for an email created from a WAVE template |
| `recipient_email_snapshot` | Email | Conditional | Staff only | WAVE | Required for an outbound email; preserves what was actually used |
| `body_markdown` | Text | Optional | Staff only | WAVE | Stored email body or structured notes |
| `delivery_status` | `pending`, `sent`, `failed` | Conditional | Staff only | WAVE | Required for email delivery attempts |
| `client_operation_key` | UUID | Conditional | Staff only | WAVE | Stable browser/server operation identity for a new outbound email; reused after an HTTP response loss |
| `provider_idempotency_key` | Text | Conditional | Staff only | WAVE | Required for an email delivery attempt; the canonical interaction UUID is the provider idempotency key for new sends |
| `provider_request_fingerprint` | SHA-256 hex | Conditional | Staff only | WAVE | Required for a pending email and binds the exact sender, recipient, subject, HTML and text replay payload without duplicating that content |
| `provider_message_id` | Text | Conditional | Staff only | WAVE | Required when the provider explicitly accepts an email |
| `delivery_error` | Text | Conditional | Staff only | WAVE | Required when email delivery fails |
| `sent_at` | Timestamp | Conditional | Staff only | WAVE | Required when an email is sent |
| `delivery_finalized_at` | Timestamp | Conditional | Staff only | WAVE | Required when a pending email is explicitly finalized as sent or failed |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Correction audit |

### Interaction rules

1. An interaction always belongs to an office.
2. A contact is optional. When present, its affiliation must belong to the same office.
3. An opportunity is optional. When present, its source office must equal the interaction office and it must not have `Source review required`; staff resolves an Acme provisional source before creating immutable opportunity-linked interaction history.
4. An interaction can exist before an opportunity.
5. Interactions are staff only and remain in chronological history.
6. A sent email preserves recipient, subject and body evidence even if the contact later changes email.
7. Corrections are audited. Interactions are not silently overwritten or hard deleted.
8. The four migrated historical email rows retain their legacy UUIDs, exact current source/office/contact/opportunity/recipient evidence and content evidence. Their owner is Bertrand's unique staff `app_user_roles.user_id`, marked `provisional` until Bertrand confirms it through the audited service-only verification action.
9. A new workflow email is persisted as `pending` through the narrow `begin_ma_interaction_email_send` service before the provider call. Its stable client operation key survives an HTTP response loss, its interaction UUID is the provider idempotency key, and its SHA-256 request fingerprint binds the exact provider payload. An explicit provider response is finalized once as `sent` with provider message ID or `failed` with error evidence through `finalize_ma_interaction_email_send`.
10. A thrown, provider `application_error`, provider internal error, conflicting idempotency response, unknown error or response without a provider message ID remains `pending`; it is never guessed to be sent or failed. The reservation may then be released because the linked pending interaction independently blocks a source-office change.
11. Reconciliation replays only the identical provider request with the same interaction and provider idempotency key, following the provider's cached-response contract. The existing send control reuses the client operation key across browser retries and reloads, while the server also deduplicates an identical opportunity/request fingerprint. Safe replay is limited to 23 hours; an older unresolved attempt remains pending for manual reconciliation and cannot create a new send. A conclusively finalized `failed` response is terminal for its operation key, so the browser clears that key and an unchanged retry creates a new provider attempt; pending and response-loss cases retain their original key.
12. Pending, sent and failed transitions are retained in append-only `ma_interaction_delivery_events`. Direct service-role table writes are revoked; new email sends and owner verification use only the narrow audited services.
13. An opportunity source office cannot change while its external-email reservation is active or when that change would invalidate linked interaction history.
14. New workflow email sends write only `ma_interactions` and their delivery events. `ma_source_interactions` is not a dual-write target after W-062.
15. A staff-recorded call, email, meeting, document or other activity uses the audited `create_ma_relationship_interaction` service. It may exist without an opportunity or contact, but an optional contact must be an active affiliation at the selected office and an optional opportunity must currently use that office.
16. A manually recorded email is evidence of communication that occurred outside WAVE. It records summary/body evidence and direction but leaves provider delivery fields empty; it never sends mail or asserts provider delivery. A manually recorded outbound email also requires a valid recipient email snapshot. Only the WAVE provider-send services may set delivery state, provider idempotency, provider message ID or delivery error.
17. New staff-recorded activity is owned and verified by its current staff actor at creation. The four migrated rows remain provisional until their assigned owner verifies them through the existing append-only service.
18. When staff links an interaction to an opportunity, the service locks that opportunity before validating its source office or source-review state. This serializes with provisional-source assignment and resolution: one transaction revalidates or rejects, so no committed interaction can retain an office that no longer matches its opportunity.

## 8. Interaction attachment

**Purpose:** stores a document received, sent or discussed in an interaction that may exist without an opportunity.

**Target table:** `ma_interaction_attachments`

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable attachment identity |
| `interaction_id` | UUID | Always | Staff only | WAVE | Parent interaction |
| `title` | Text | Always | Staff only | WAVE | Human-readable label |
| `storage_bucket` | Text | Always | Staff only | WAVE | Private storage bucket |
| `storage_path` | Text | Always | Staff only | WAVE | Private object path |
| `file_name` | Text | Always | Staff only | WAVE | Original display name |
| `mime_type` | Text | Optional | Staff only | WAVE | File content type |
| `size_bytes` | Integer | Optional | Staff only | WAVE | File size |
| `uploaded_by`, `uploaded_at` | Staff ID, timestamp | System | Staff only | WAVE | Upload audit |

### Attachment rules

1. Interaction attachments are staff only.
2. Linking an interaction to an opportunity does not expose its attachment to a repreneur.
3. A file becomes an opportunity document only through an explicit staff action and the opportunity document visibility rules.

## 9. Opportunity document

**Purpose:** stores deal documents associated with an opportunity and their controlled visibility.

**Target table:** `opportunity_documents`, retaining the current table.

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable document identity |
| `opportunity_id` | UUID | Always | Staff only | WAVE | Parent opportunity |
| `title` | Text | Always | Role appropriate | WAVE | Human-readable title |
| `document_type` | `source_teaser`, `teaser`, `deal_book`, `nda`, `external_analysis`, `other` | Always | Role appropriate | WAVE | `source_teaser` is the retained original evidence; `teaser` is a separately controlled repreneur-facing document |
| `visibility` | `staff_only`, `approved_for_repreneur` | Always | Role appropriate | WAVE | Defaults to `staff_only`; existing confidentiality gates still apply |
| `storage_bucket` | Text | Always | Staff only | WAVE | Private storage bucket |
| `storage_path` | Text | Conditional | Staff only | WAVE | Required unless an external URL is used |
| `external_url` | URL | Conditional | Staff only | WAVE | Required unless a storage path is used |
| `file_name`, `mime_type`, `size_bytes` | Text, text, integer | Optional | Staff only | WAVE | File metadata |
| `uploaded_by`, `uploaded_at` | Staff ID, timestamp | System | Staff only | WAVE | Upload audit |
| `repreneur_approved_by`, `repreneur_approved_at` | Staff ID, timestamp | Conditional | Staff only | WAVE | Required when visibility becomes `approved_for_repreneur` |
| `updated_at` | Timestamp | System | Staff only | WAVE | Last metadata change |

### Opportunity document rules

1. A document defaults to `staff_only`.
2. `approved_for_repreneur` requires a recorded approving staff member and timestamp.
3. Delivery to a repreneur additionally requires the existing signed or explicitly waived NDA evidence. Visibility alone is never sufficient.
4. Browser roles never receive direct database or storage access to staff-only source and document records. Approved delivery uses the existing server-side confidentiality path.
5. A `source_teaser` preserves the original file separately from `opportunities.teaser_summary` and any later repreneur-facing `teaser`. It is permanently `staff_only`, cannot transition to `approved_for_repreneur`, and is retained as source evidence rather than overwritten by an anonymized or edited derivative.
6. A `source_teaser` and `deal_book` (labelled **Information memorandum (IM)** in WAVE) are PDF-only staff uploads. Both are constrained at database level to `staff_only`; the generic document control cannot approve either for repreneur access, and a later pursuit-specific grant is the only disclosure authority.
7. Source teasers and IMs are retained records. A correction creates a new document row and never overwrites or deletes an earlier version. Canonical NDA artifact rows remain subject to their stricter immutable version rules below.
8. Staff view or download a private document only through the server-side opportunity document route after a staff authorization check. The route creates a short-lived private storage URL; it does not grant browser storage access.

### Canonical NDA artifact versions

**Purpose:** distinguishes and retains the documents used by the NDA lifecycle without treating upload as staff validation or access authority.

**Target table:** `opportunity_nda_artifacts`, introduced by migration 082.

| Attribute | Type or values | Requiredness | Visibility | Source of truth | Meaning and validation |
| --- | --- | --- | --- | --- | --- |
| `id` | UUID | System | Staff only | WAVE | Stable artifact-version identity |
| `opportunity_id` | UUID | Always | Staff only | WAVE | Parent opportunity for every artifact |
| `match_id` | UUID | Conditional | Staff only | WAVE | Null for the blank template; required for either signed pursuit copy |
| `document_id` | UUID | Always | Staff only | WAVE | Unique retained `nda` document with `staff_only` visibility |
| `artifact_role` | `blank_template`, `renew_signed_copy`, `repreneur_signed_copy` | Always | Staff only | WAVE | Distinguishes the three documents; roles are never inferred from legacy status |
| `version_number` | Positive integer | System | Staff only | WAVE | Monotonic within opportunity/role for the blank template and pursuit/role for signed copies |
| `content_sha256` | Lowercase SHA-256 digest | Always | Staff only | WAVE | Fingerprint of the retained PDF bytes recorded with this immutable version |
| `supersedes_artifact_id` | UUID | Conditional | Staff only | WAVE | Required after version 1 and points to the immediately preceding retained version |
| `recorded_by`, `recorded_at` | Staff identity, timestamp | System | Staff only | WAVE | Append-only registration evidence |

1. Staff may register one new version only by uploading a PDF to private storage. Every version receives a unique, non-overwritable object path and a SHA-256 fingerprint; external references cannot become canonical artifacts.
2. The blank template is opportunity-scoped. Re-New-signed and repreneur-signed copies are pursuit-scoped and their pursuit must belong to the same opportunity.
3. Artifact rows and their linked document rows are immutable and cannot be deleted. A correction is a new version linked through `supersedes_artifact_id`; all versions survive decline, handoff, closure and reopen.
4. Browser roles have no direct table access. Staff reads and writes pass through staff-authenticated server boundaries; the registration service is the only write capability granted to the service role.
5. Migration 082 performs no legacy backfill. `opportunity_matches.nda_status`, `nda_document_id` and related timestamps remain compatibility fields and never become canonical artifact evidence by inference. A legacy signed or waived label missing its required evidence fails closed when a later workflow would otherwise mutate that match; the workflow must not fabricate evidence, clear the label or expose the database constraint.
6. Registering any artifact does not validate signer, opportunity or pursuit validity beyond structural linkage; pass Gate 1 or Gate 2; disclose source identity; change document visibility; unlock a memo; or send E4, E6 or E7. Those effects require their separate successor controls and evidence.

## Cross-entity invariants

These rules are part of the contract and should be enforced in the database wherever practical:

1. Every non-archived firm has one or more active offices. A firm may have at most one synthetic default office. Once a real active office is known, that default is preserved only for historical attribution and cannot be selected for new or changed opportunity source contexts.
2. Contacts reach offices only through affiliations.
3. Opportunities and interactions always anchor to an office.
4. An opportunity contact links through an affiliation belonging to the opportunity source office.
5. A valid opportunity has at least one active contact and exactly one primary contact.
6. The primary contact of a valid opportunity is named and has a usable email.
7. An interaction's optional contact and opportunity must belong to the interaction office.
8. Referenced firms, offices, contacts and relationships are archived or end-dated, never hard deleted.
9. Every staff mutation records actor and timestamp.
10. Source relationships, interactions, audit metadata and internal notes are staff only, except for the tightly gated source-identity disclosure defined in the authority matrix below.
11. Excel identifiers never remain in live firm, office, contact or opportunity records.
12. A staff-only draft may have no source office or contacts. Moving to `active` or `paused` happens through the atomic office-context service and requires the full valid-opportunity rules. Activation never broadens repreneur disclosure; the legacy exposure field stays `staff_only` for new records and draft transitions until the old portal reads are removed.
13. An active or paused opportunity requires `source_office_id`; it does not require a legacy `source_id`.
14. Every migration 076 child foreign key that needs a standalone lookup has a full, leftmost index; a partial business index does not substitute for a parent-delete or update check.

## Repreneur visibility contract

| Data | Staff | Repreneur |
| --- | --- | --- |
| Firm, office and named contact identities | Yes | Only for an active pursuit after both valid pursuit-specific signed copies, a recorded Gate 2 pass and an explicit staff disclosure approval; access is revoked on NDA expiry, staff revocation or pursuit closure |
| Firm, office and contact notes | Yes | Never |
| Interaction history, source-review evidence and audit metadata | Yes | Never |
| Opportunity internal description and notes | Yes | Never |
| Opportunity public title, teaser, sector, location and approved metrics | Yes | Only when the opportunity visibility and confidentiality gates allow it |
| Original source teaser document | Yes | Never |
| Opportunity documents | Yes | Only when explicitly approved and the NDA gate allows it |
| Cutover mappings and issues | Yes | Never |

No API, export, notification, download or UI surface may expose staff-only source information to a repreneur. The one exception is the approved source firm, office and named contact disclosure in the table above; it must be server-side, purpose-limited to that active pursuit and revoked immediately when any listed condition ceases to hold.

## Lifecycle action and evidence authority matrix

This is the authoritative W-001 operating contract for supported lifecycle actions. It defines business authority without adding a second workflow, a parallel status field or a speculative interface. “Staff” means an authenticated Re-New staff member acting through the applicable staff-only boundary; “repreneur” means the positioned repreneur through the existing portal path. Every “immutable event” below is append-only evidence: it retains actor, timestamp, object IDs, prior and resulting state where relevant, and the decision or evidence reference. Existing record fields remain the source of truth; dashboard labels are computed from those fields and the referenced evidence.

| Action | Initiating actor and preconditions | Stored facts vs computed labels | Evidence and staff validation | Resulting visibility | Retention and immutable audit event |
| --- | --- | --- | --- | --- | --- |
| Assign provisional Acme source context | Staff; opportunity is `draft`, `active` or `paused`; Acme firm, office and named contact use the canonical office/contact chain | Store the existing canonical `source_office_id` link to Acme's office and canonical contacts; “Source review required” is computed, never stored as a parallel review status | Staff records why the real source is unavailable; no repreneur action can validate it | Staff only | Append the Acme assignment and reason as immutable evidence; retain it after later resolution |
| Resolve or correct provisional source | Staff; opportunity is not `closed` or `archived`; real canonical office and valid contacts are known | Replace only the canonical source office/contact links; “Source review required” clears only when the recorded resolution passes validation | Staff validates office and contact affiliation through the existing atomic office-context boundary | Staff only | Retain the prior Acme/other source, assignment reason, new source, actor and time in immutable correction evidence; never recreate the opportunity |
| Change source office | Staff; opportunity is not `closed` or `archived`; replacement office and contacts satisfy the existing office-context rules | Store the changed canonical links; source name remains derived through office to firm, never duplicated | Staff validates the active affiliation, primary-contact and email rules when the opportunity is `active` or `paused` | Staff only | Retain before/after office and contact snapshots; append immutable correction event |
| Mutual-interest validation | Repreneur records their own response; staff records and validates the intermediary/counterparty response with reliable evidence for the same match/pursuit | Store each party's existing response and evidence reference; “Mutual interest” is computed only from the validated response pair | Only the validated response pair creates a distinct mutual-interest-validation immutable event; only that event may trigger E4 | Staff only until the existing downstream disclosure gates permit otherwise | Retain both responses, evidence and the distinct validation event |
| E4 — qualification and blank-NDA request | System/staff; E4 fires once for each distinct mutual-interest-validation event | Store the E4 transition, delivery result and idempotency reference scoped to that validation event; “E4 sent” is computed | A retry of the same validation event deduplicates. A later distinct validation creates its own E4 and qualification request; it requests the opportunity-level blank NDA only if absent at that later event. Delivery evidence and idempotency are mandatory. | Staff only | Retain each validation and delivery result; append E4 transition event without duplicate requests for the same validation event |
| Intermediary qualification | Staff/intermediary; E4 requested it for the positioned repreneur and source office/contact are known or explicitly provisional | Store qualification decision, subject repreneur and evidence reference in the existing relationship workflow; “Qualified for this repreneur” is computed | Staff validates the operating basis; unresolved Acme status remains visible to staff | Staff only | Retain decision, basis and actor; append qualification event |
| Blank NDA handling | Staff/intermediary; E4 requests it only when the opportunity does not already hold a valid opportunity-level blank NDA | Store a `blank_template` artifact version linked to its staff-only NDA document; “Blank NDA available” remains unearned until the successor validation control records validity | Upload proves only role and opportunity linkage. Staff validation of document type and validity remains a separate successor action. | Staff only | Retain every artifact version. Blank-NDA reuse never reuses intermediary qualification or Gate 1 staff access approval. |
| Gate 1 | Staff; the intermediary qualification for that repreneur is validated and a valid opportunity-level blank NDA exists | Store Gate 1 access-validation decision, actor, time and evidence reference; “Gate 1 passed” is computed | Staff validation of access is mandatory. Blank-NDA reuse never reuses qualification or staff approval. | Staff only | Retain decision and evidence; append Gate 1 event |
| E6 — repreneur NDA-ready notice | Staff/system; staff Gate 1 passed for the active pursuit | Store E6 delivery evidence, idempotency reference and time; “NDA ready to sign” is computed | Send E6 to the repreneur after Gate 1, stating that the NDA is ready to sign. E6 does not create or validate either pursuit-specific signed copy. | Repreneur sees the NDA-ready request only through the existing confidentiality path; source identity remains staff only | Retain delivery result and idempotency evidence; append E6 event |
| Re-New-signed pursuit copy | Staff; the pursuit-specific NDA copy is prepared after the approved E6 path | Store a pursuit-scoped `renew_signed_copy` artifact version; signer and validation facts remain successor evidence; “Re-New copy validated” is not earned by upload | Upload proves only role and pursuit linkage. Staff validation of signer, pursuit specificity and validity remains a separate successor action. | Staff only | Retain every artifact version; the successor validation control appends its distinct outcome |
| Repreneur-signed pursuit copy | Repreneur submits through the existing confidentiality path after E6 | Store a pursuit-scoped `repreneur_signed_copy` artifact version when received by staff; signer and validation facts remain successor evidence; “Repreneur copy validated” is not earned by upload | Upload proves only role and pursuit linkage. Staff validation of signer, pursuit specificity and validity remains a separate successor action. | Staff only; upload never satisfies Gate 2 or disclosure approval | Retain every artifact version; the successor validation control appends its distinct outcome |
| Gate 2 | Staff; the pursuit is active and both pursuit-specific signed copies have been validated | Store Gate 2 decision, actor, time and evidence reference; “Gate 2 passed” is computed | Staff validates both copies and their linkage. Gate 2 requires two validated pursuit-specific signed copies. | Staff only; Gate 2 alone does not disclose source identity | Retain decision and evidence; append Gate 2 event |
| Source identity disclosure approval | Staff; pursuit is active, both pursuit-specific signed copies remain valid, a `Gate 2 passed` event is recorded, and staff approval is explicit | Store explicit staff approval, scope and time; “Source identity visible” is computed from approval plus live signed copies, recorded Gate 2 and pursuit status | Staff validation is mandatory; no inferred approval is allowed | Repreneur may see only source firm, office and named contact for that pursuit | Retain approval and scope; append disclosure-approval event |
| Expiry or revocation of source disclosure | System detects NDA expiry or pursuit closure, or staff revokes; a prior disclosure approval exists | Store expiry/revocation or closure fact; “Source identity visible” becomes false immediately | Staff validates manual revocation; system enforces expiry/closure | Source identity is removed from repreneur surfaces; audit/history stay staff only | Retain cause, actor where applicable and time; append disclosure-revocation event |
| E7 — intermediary copies and memo request | Staff/system; both pursuit-specific signed copies exist and an already recorded `Gate 2 passed` event remains valid | Store E7 delivery evidence, both-copy references and memo-request reference; “E7 sent” is computed | E7 sends to the intermediary, transmits or references both signed pursuit copies, and requests the information memo. Delivery evidence and idempotency are mandatory. | Staff only unless a separately approved item is repreneur-visible | Retain delivery/reference evidence; append E7 transition event |
| Memo upload | Staff; opportunity and pursuit are correctly linked | Store the existing memo document metadata and staff-only default visibility; “Memo uploaded” is computed | Staff validates file type, linkage and confidentiality classification | Staff only by default | Retain document metadata and upload evidence; append memo-upload event |
| Memo approval for repreneur | Staff; memo exists and the existing document and NDA gates pass | Store approver, time and approved document visibility; “Memo available” is computed | Staff validation is mandatory; document visibility alone is insufficient | Repreneur sees only the approved memo through the server-side path | Retain approval and delivery evidence; append memo-approval event |
| E8 — memo-enabled final workflow step | Staff/system; staff Gate 2 passed and an actual approved memo is linked to the pursuit | Store the existing E8 state/evidence reference; “E8 complete” is computed | E8 requires both a passed staff Gate 2 and an actual approved memo; neither condition alone may fire E8. Staff validates the memo approval and completion evidence. | Role-appropriate; it does not widen source access by itself | Retain evidence; append E8 transition event |
| Repreneur interest or decline | Repreneur; an active, repreneur-visible portal deal is either staff-proposed, previously declined, or currently unassigned/positioned with another repreneur | Store or reuse only the existing `opportunity_matches` pair with `status = interested`, selected decline reason and optional context; “Interested” or “Declined” is computed | The atomic service rejects inactive or staff-only deals and the repreneur's own active pursuit; another repreneur's active pursuit remains unchanged. Staff validates the resulting interest signal in the existing workflow. No source data is added to the response. | Repreneur sees own response; staff sees response and analysis | Retain response and context under existing record retention. A repeated interest reuses the pair and notification idempotency evidence; it creates no active pursuit, public waitlist, lifecycle state or confidentiality change. |
| Staff-recorded external decision | Staff; external outcome has a reliable source or delivery reference | Store decision, effective time, source/evidence reference and actor; summary labels are computed | Staff validation is mandatory | Staff only unless an existing role-specific workflow exposes its consequence | Retain evidence and decision; append external-decision event |
| Pause opportunity or pursuit | Staff; a valid operational reason is recorded | Store existing paused status and reason/evidence reference; “Paused” is computed | Staff validation is mandatory for externally consequential pauses | Staff only; existing repreneur surface follows its separate visibility rule | Retain reason and prior state; append pause event |
| Close opportunity | Staff; no unresolved provisional Acme source context and existing opportunity-closure prerequisites pass | Store existing opportunity closed status, reason, actor and time; “Closed” is computed | Staff validation is mandatory; an Acme-linked opportunity cannot close | Staff only | Preserve historical source/contact links and evidence; append opportunity-closure event |
| Close pursuit | Staff; existing pursuit-closure prerequisites pass; an unresolved Acme source does not block this action | Store existing pursuit closed status, reason, actor and time; “Pursuit closed” is computed | Staff validation is mandatory; closure immediately revokes any source-identity disclosure | Staff only; source identity is removed immediately | Retain pursuit closure reason, prior disclosure scope and revocation evidence; append pursuit-closure event |
| Reopen opportunity or pursuit | Staff; separately approved audited reopen workflow and documented reason exist | Store reopened state only through that explicit workflow; “Reopened” is computed | Staff validation and explicit approval are mandatory; generic intake cannot reopen | Staff only until all normal visibility gates are re-earned | Preserve the closed state and reason; append reopen event |
| Archive opportunity | Staff; existing archive rules pass and no unresolved provisional Acme source context remains | Store existing archive status, actor and time; “Archived” is computed | Staff validation is mandatory; an Acme-linked opportunity cannot archive | Staff only; any source disclosure is revoked | Preserve historical source/contact links and evidence; append archive event |
| Cutover-ready or cutover-complete treatment | Staff/system only; all W-010 evidence gates pass and no unresolved provisional Acme source context remains | Store only the existing cutover manifest, approvals and activation facts; readiness/completion labels are computed | Required W-010 staff, reconciliation and activation validation applies | Staff only | Retain sanitized manifest and immutable approval digest; Acme exception remains a blocker and is audited |

### Authority and implementation boundaries

1. This matrix is the approved business authority for W-001. It does not itself create a new table, status, document type, portal surface, migration or bypass around existing atomic write and confidentiality boundaries.
2. Required means the action must not proceed without the stated fact or evidence. Conditional means it is required only when its stated condition applies. Optional context never substitutes for a required gate.
3. Staff owns every source assignment, correction, office change, disclosure approval, Gate 1/Gate 2 decision, external decision, pause, closure, archive and reopen approval. A repreneur may initiate only their own interest/decline and signed-copy submission through existing portal flows.
4. The shared Acme firm is a provisional operational source, not test data and not a future name for an actual intermediary. It may support active work while review is unresolved, but it cannot become permanent closed, archived or cutover-complete history.
5. Source firm, office and named contact are staff-only before the exact disclosure conditions above. Source-review metadata, correction evidence, audit metadata and M&A relationship history are always staff-only.
6. W-001 requires no data migration: it canonicalizes authority and acceptance criteria. A future implementation must reuse an existing audited evidence path or, if none exists, add an additive migration before that implementation release. It must document the mapping here and update its migration, API, role projection and tests; it must not invent parallel fields.
7. W-001 has no standalone roadmap entry because it is an internal authority contract, not a new live user capability. Roadmap communication belongs to a later verified user-facing release that implements a matrix-governed capability.

## Source workbook mapping

The cutover mapper uses the workbook structure as input. The workbook does not define the WAVE architecture.

### Post-cutover authority and approved source interpretations

W-010 switched production authority to WAVE on 2026-07-28. Colin's approved workbook and his 2026-07-29 Slack answers remain read-only source evidence for reconciliation; they are not a recurring synchronization feed and cannot overwrite later staff changes in WAVE.

For the approved snapshot, `Secteur_code` and `Geo_code` take precedence over the adjacent free-text label and confidence columns. Exactly one recognized code that resolves to exactly one approved mapping produces a `confirmed` reconciliation outcome, even when the adjacent label differs or the confidence cell is not `OK`; those cells do not by themselves create a conflict. A blank, malformed, multiple, unknown or non-resolving code produces `review` and is never guessed. These are source-vocabulary aliases retained in the reconciliation/version evidence only: WAVE persists its canonical sector label and geography-node identity, not the workbook code.

#### Sector source-code map

| `Secteur_code` | Canonical WAVE sector |
| --- | --- |
| `AGR` | Agroalimentaire |
| `INM` | Industrie manufacturière |
| `INL` | Industrie lourde |
| `PHA` | Industrie pharmaceutique & Dispositifs médicaux |
| `SAN` | Services de santé |
| `AUT` | Automobile & Mobilité |
| `TEX` | Textile, Luxe & Mode |
| `COM` | Commerce, Négoce & Distribution |
| `BTP` | BTP & Construction |
| `SRB` | Services aux entreprises (B2B) |
| `SRC` | Services aux particuliers (B2C) |
| `TEC` | Tech & Digital |
| `ENV` | Environnement & Énergie |
| `HOT` | Hôtellerie, Restauration & Loisirs |
| `TRA` | Transport & Logistique |
| `ZZZ` | Autre |

The workbook's 12 qualified values `ZZZ (EDUCATION-FORMATION)` and `ZZZ (PRODUITS DE CONSOMMATION ET SERVICES)` use the `ZZZ` rule. WAVE stores `Autre` as the canonical sector and retains the parenthesized qualifier only in the staff-only per-row reconciliation evidence; it does not write the qualifier to `activity`, create another opportunity field or invent a narrower approved sector.

#### Geography source-code map

| `Geo_code` | Approved meaning | `Geo_code` | Approved meaning |
| --- | --- | --- | --- |
| `FR` | France | `DE` | Allemagne |
| `BE` | Belgique | `ES` | Espagne |
| `IT` | Italie | `LU` | Luxembourg |
| `MC` | Monaco | `NL` | Pays-Bas |
| `PT` | Portugal | `GB` | Royaume-Uni |
| `CH` | Suisse | `IDF` | Île-de-France |
| `NE` | Nord-Est | `GO` | Grand-Ouest |
| `SO` | Sud-Ouest | `SE` | Sud-Est |
| `OM` | Outre-Mer | `AU` | Auvergne-Rhône-Alpes |
| `NA` | Nouvelle-Aquitaine | `OC` | Occitanie |
| `PA` | Provence-Alpes-Côte d'Azur | `COR` | Corse |
| `BR` | Bretagne | `NO` | Normandie |
| `PL` | Pays de la Loire | `CVL` | Centre-Val de Loire |
| `HDF` | Hauts-de-France | `GE` | Grand Est |
| `BFR` | Bourgogne-Franche-Comté | `DOM` | DOM-TOM |

The approved workbook uses `BFC` on four Bourgogne-Franche-Comté rows while Colin's supplied map names that geography `BFR`. `BFC` is an accepted source compatibility alias of canonical `BFR`; it is not a second geography node and does not change the opportunity reference. W-039 preserves the literal `opportunities.location` display value and resolves the source code to a stable geography node. The map records source meaning for foreign countries but does not by itself activate foreign-country matching.

### Acceptance contract for post-cutover follow-up

The W-071 opportunity-reconciliation release is complete only when:

1. A read-only preflight accounts for all 148 approved source rows and reports each `Secteur_code`, `Geo_code`, title and positioned-repreneur decision before any write.
2. All 148 sector rows resolve through the map above, including the 12 qualified `ZZZ (...)` values; the qualifier remains staff-only and no narrower sector is invented.
3. All 148 geography rows resolve through the map above, including the four `BFC` aliases; `opportunities.location` remains byte-for-byte unchanged and foreign-country matching remains inactive.
4. The release separately reports 109 blank source title cells and the 20 live newly created Draft/staff-only title gaps. It never clears a non-blank WAVE title and never exposes a titleless opportunity.
5. The 26 positioned-repreneur labels reconcile to 20 already linked unique identities plus six explicit review outcomes unless current canonical identity evidence supports a different exact result. Ambiguous or absent identities remain unlinked.
6. Because WAVE became authoritative at cutover, a source-derived correction may write only when the current WAVE field still matches its retained cutover state or staff explicitly approves the divergence. A later WAVE edit always wins over stale workbook evidence.
7. A transactional rehearsal, rollback proof, post-write aggregate comparison, staff browser QA and repreneur confidentiality QA pass before production closure.

The W-072 purpose-aware email-suppression release is complete only when:

1. Exactly the 18 named W-010 contacts with retained source evidence receive structured campaign suppression; the excluded nameless source row does not create a person.
2. Suppressed contacts are absent from campaign and bulk audiences, and the final send boundary rejects a direct-address campaign attempt.
3. A synthetic, actively linked opportunity contact can receive an allowlisted NDA request through the operational path, while the same contact cannot receive a non-allowlisted or unlinked message.
4. The send evidence records contact, opportunity, purpose, actor, idempotency and final delivery outcome without weakening the existing source-review, role or provider-ambiguity controls.
5. Setting, changing and removing suppression creates immutable actor, time and reason evidence; browser roles cannot bypass the service boundary and repreneur projections expose no suppression state.
6. Focused tests, migration rehearsal, full lint/build checks and staff-role browser QA pass. No real contact receives a test message.

Migration 083 is the live W-072 implementation. It adds the person-level
suppression state and current reason to `ma_contacts`, plus immutable
`ma_contact_email_policy_events`. Exactly four machine-readable purposes exist:
campaign, general relationship, opportunity general and opportunity NDA
request. The application derives the purpose from the selected workflow;
neither the browser nor an email address can supply an arbitrary purpose. The
service-only audience check and final authorization both require canonical
contact identity. Every opportunity purpose requires an active
`opportunity_ma_contacts` link through an active affiliation. A suppressed
person is authorized only for `opportunity_nda_request`; that exception records
the same client operation key used by the canonical interaction delivery
ledger. Generic, manual and test send paths also perform a normalized
direct-address check and fail closed when any canonical person using that
address is suppressed, including after archival; their recipient selector
removes those addresses before staff can choose them. Suppression changes are
blocked while the existing opportunity email reservation is active, so policy
cannot change between the final check and provider delivery.
The migration flushes the platform's existing deferred contact-integrity
checks after the structured backfill and before installing the policy trigger.
Its disposable rehearsal includes the same deferred-trigger condition so the
production DDL ordering remains covered.

Production release evidence on 2026-07-30: migration 083 backfilled exactly 18
suppressed contacts and 18 immutable source events while retaining all 18
original W-010 notes. Read-only verification found six active linked NDA
exceptions, zero linked general-message permissions, forced RLS, no browser
read/change privilege and zero non-backfill policy events. Application
deployment `dpl_3oLejSgvXARqTRpsCucHF6ks1xKd` serves build `10.4845fe4`.
Staff browser QA verified the contacts directory, required-reason control,
general-message block, NDA-only exception and 390-pixel layout without saving
or sending. Repreneur QA redirected the staff route to `/portal/deals` and
exposed no policy state. Final verification retained 18 suppressions, zero
removals, zero live exceptions and zero active reservations.

### One-time cutover rules

1. Before the completed 2026-07-28 switch, Excel remained operationally authoritative and WAVE import rows remained controlled cutover data. After the switch, WAVE owns every correction and future activity; the workbook is read-only evidence.
2. There is one production cutover import. Before approval, a revised workbook may replace the pending stage rows in the same run; it does not create a recurring sync. Once approved, a revision must use the controlled supersession path, which retains the sanitized manifest but purges every temporary row and issue before closing that run.
3. Source rows and temporary mappings are staged outside the live domain tables in `ma_cutover_runs`, `ma_cutover_stage_rows` and `ma_cutover_stage_issues`. Missing or conflicting information is never invented. Every staged firm, office, contact and affiliation has an explicit reviewed resolution: `create`, or `reuse` with its reviewed canonical WAVE ID. A matching name, email or office never auto-reuses a live record.
4. An incomplete opportunity remains an import exception until it has a source office, description, named primary contact and usable primary email.
   Its full selected affiliation set is retained, every selected affiliation must belong to that source office, and the primary affiliation must be one of the selected affiliations.
5. Duplicate candidates are reviewed before activation. Missing financial values remain `null`.
6. Approval is refused while any blocker is unresolved. A service-role-only, security-invoker activation locks the approved run, all staged rows and all issues, recomputes its database-owned immutable approval digest, compares it with the stored and supplied values, requires zero unresolved blockers, creates a dependency-closed canonical firm, office, contact, affiliation and opportunity set, verifies the W-061 operational-validity rules, records aggregate results, then purges temporary rows and issues in the same transaction. Any error rolls back and leaves staging intact.
7. After row counts and relationships reconcile and Ivan approves the migration, temporary rows and every source workbook ID are deleted. The same temporary evidence is purged when a run is superseded. Live records retain only WAVE IDs.
8. Keep a cutover manifest with a required lowercase SHA-256 raw-content source hash, a non-identifying `sha256:<64 lowercase hex>` source fingerprint, execution and approval times, responsible staff member, sanitized aggregate record totals, allowlisted review decisions and an immutable approval digest. PostgreSQL recomputes that digest from the ordered staged rows and issues plus the source hash/fingerprint, reconciliation and review decisions; a caller-supplied value can only be compared, never define the approval. The manifest retains no raw workbook bytes, file names, workbook IDs or Excel identifiers. It is migration evidence, not another business entity or recurring import system.
9. Before replacing any live test opportunity or match, create an immutable backup and a separate replacement manifest containing its exact WAVE ID, object type and count. Only manifest-confirmed test records may be replaced or deleted. An ambiguous or real record blocks the run.
10. Preserve raw source date text, parsed `date_added`, `date_added_precision` and the parsing decision in temporary staging and bind them into the approval digest. Reconcile source, `day`, `month`, null and parse-failure counts before activation. The 144 known month/year-only values are valid non-blocking inputs when represented with precision `month`; a precision mismatch is a blocker.
11. Activation requires Colin's final-source and freeze confirmation, zero unresolved blockers, an attached replacement manifest and a passing staff workflow smoke test. Ivan's standing approval recorded on W-010 applies only when all four conditions are evidenced; otherwise the run stops.
12. A cell containing several email addresses is never imported as one address:
   1. If the addresses belong to one named person, staff verifies one usable primary email. Other addresses remain in the cutover resolution note unless a future contact-method model is approved.
   2. If the addresses belong to different people, split them into separate contacts.
   3. If ownership is unclear or an address is malformed, keep the row as an exception.

### W-020 cutover-rehearsal boundary

Migration 078 is a live but empty cutover foundation, not an import launch. It adds staff-only staging and a service-role-only activation primitive; no browser role receives table or function access. The `/opportunities/import` route is staff-gated and displays a deterministic in-repository synthetic rehearsal only. It accepts no workbook, file, pasted CSV/TSV/JSON rows or other production input, has no direct database write, and exposes no activation server action.

The approval digest is owned and recomputed by PostgreSQL with `pgcrypto` SHA-256 over a canonical, ordered serialization of the manifest, every staged row and every staged issue. It includes the algorithm-tagged source fingerprint, exact lowercase raw-content SHA-256 source hash, sanitized reconciliation summary and structured review decisions; the stored and activation-supplied digests must match that recomputation. An issue resolution timestamp is serialized as UTC-stable epoch microseconds, never a session-time-zone-dependent timestamp string. `review_decisions.approved_opportunity_fields` is the only optional-field authorization and may contain only `sector`, `activity`, `location`, `revenue_meur`, `ebitda_keur`, `headcount`, `headcount_range`, `date_added`, `public_title`, `teaser_summary`, and `internal_notes`. Each field must be both explicitly staged and approved. A missing metric or date remains `null`; an invalid supplied metric or date is a blocker, and approval as well as activation rejects unresolved blockers.

That paragraph describes the production-verified W-020 foundation. W-010 subsequently incorporated derived `date_added_precision`, raw date parsing decisions and the exact test-data replacement manifest into the database-owned digest and activation checks before the approved production activation.

The source fingerprint must be exactly `sha256:<64 lowercase hexadecimal characters>` and must be computed before staging from a non-retained provenance representation; a literal filename, workbook ID or source identifier is invalid. The source hash is the separate raw-content SHA-256 checksum. Stage temporary IDs and relationship keys are bounded tokens; locators are bounded flat objects with only source workbook/sheet/row/key fields; and payloads are bounded flat objects whose keys are allowlisted by entity type. This prevents raw workbook blobs, arbitrary nested JSON and unbounded identifiers from being parked in staging. A stage issue that names a row uses the same-run composite foreign key, so it cannot point at a row belonging to another run; a null row reference remains valid for a run-level issue. The retained manifest keeps only the fingerprint/hash, actor and time fields, sanitized aggregate reconciliation, allowlisted review decisions, immutable digest and sanitized aggregate result. Stage locators, normalized payloads, temporary IDs and issues are temporary evidence only and are purged after activation or controlled supersession.

Service role is trusted to create, revise and review pre-approval staging. A run must start open with no approval, activation or supersession evidence; service role cannot delete a run manifest, transition a run into `activating` or `activated`, or purge approved staging through the browser-facing/PostgREST path. Those lifecycle changes require the transaction-local activation guard created by the security-invoker activation function. The `pg_temp` guard is an application boundary for PostgREST callers, not a barrier to a principal that can execute arbitrary raw SQL with service-role database credentials and create a matching temporary table; raw SQL credential governance is outside this W-020 control. Pre-approval stage rows may be deleted and replaced for a revised workbook. An approved run is immutable; `supersede_ma_cutover_run` is the separate controlled close path that purges its temporary evidence, records a supersession actor and time, and retains the sanitized immutable manifest.

Gate 2 must execute migration 078 in a disposable Supabase-compatible PostgreSQL database before release. It must prove `extensions.digest('ma-cutover-gate2', 'sha256')` is available; calculate a digest with the same resolved issue under at least UTC and Europe/Rome session time zones and prove equality; reject a filename-like source fingerprint; reject a same-run mismatch between an issue and stage row while accepting a null stage-row reference; exercise digest mismatch and direct lifecycle/delete rejections; confirm approval rejects an unresolved blocker; confirm a pre-approval row can be replaced; and confirm activation/supersession purge only temporary stage rows and issues. It must also run a concurrent stage-mutation and supersession attempt to demonstrate the existing shared row-lock order serializes safely without deadlock or a partial purge; this remains a runtime check rather than an unproven static lock redesign.

Staged geography retains only its source label and an explicit `confirmed`, `review` or `null` decision. WAVE does not infer a geography code in this scope. The existing `opportunities.location` text may be written only when both the manifest and that staged value explicitly approve it; otherwise it remains `null`. Cutover never makes an opportunity repreneur-visible.

Every staged office also declares the boolean `isSyntheticDefault`. `true` means the W-061 synthetic fallback only: its staged name must equal the firm name and the firm must have no active real office. It is never a generic preferred office. An unknown office at a firm with real offices remains a review blocker until staff identifies the actual office or explicitly resolves the exception.

### Firm and office rows

| Source meaning | WAVE target | Rule |
| --- | --- | --- |
| Firm and office worksheet, column A | Temporary source row ID | Maps each source row during cutover only; delete after approval |
| Firm and office worksheet, parent ID column | Temporary parent mapping | Resolves the source row to its parent firm; delete after approval |
| Firm and office worksheet, level column | Cutover classification | Distinguishes firm and office rows; do not retain it as a second hierarchy |
| Firm or office name | `ma_firms.name` or `ma_offices.name` | Parent and level columns determine the split during staging |
| `isSyntheticDefault` | `ma_offices.is_default` | Required explicit boolean; `true` only for an unknown-office fallback named after the firm, and never where an active real office exists |
| Duplicate candidate | Staged `create` or `reuse` resolution | A reviewer binds a reuse to the canonical ID; matching text alone never merges records |
| Optional network label | `ma_firms.network_label` | Informational only |
| Firm category | `ma_firms.category` | Optional controlled value |
| Region and geography confidence | `ma_offices.region_codes`, `geography_confidence` | Review non-confirmed values |
| Website | Firm or office website | Use the most specific valid level |
| Discovery source, evidence link and date | Firm provenance fields | Optional; never a cutover blocker |

### Contact rows

| Source meaning | WAVE target | Rule |
| --- | --- | --- |
| Contacts worksheet, column A | Temporary source office ID | Maps to `office_id` during cutover only; delete after approval |
| First and last name | `ma_contacts` | At least one name component required |
| Job title | Affiliation `job_title` | Office-specific |
| Managed offices | Additional affiliations | Split and validate each office |
| Duplicate candidate | Staged `create` or `reuse` resolution | A reviewer binds a reuse to the canonical ID; matching name or email alone never merges a person |
| Email, phone and LinkedIn | `ma_contacts` | Email is not globally unique; apply the multi-email exception rules above |
| Unsubscribe or do-not-email marker | `ma_contacts.campaign_email_suppressed` plus immutable change evidence | Set campaign suppression for the 18 named flagged contacts. Preserve the imported note until structured backfill and final-send enforcement are verified. Do not apply the marker to opportunity-specific operational email authorization |
| Repeated firm website and region | Derived from office | Do not duplicate on the contact |

### Opportunity rows

| Source meaning | WAVE target | Rule |
| --- | --- | --- |
| Mandate reference | `opportunities.reference` | Required and unique |
| Opportunities worksheet, column B | Temporary source office ID | Maps to `source_office_id`; required before activation and deleted after cutover |
| Source name | Validation evidence | Do not retain a duplicate source relationship |
| Location and source geography label | `opportunities.location` plus `geography_node_id` | Preserve the literal display value. Resolve a valid `Geo_code` through the approved map; accept workbook `BFC` only as an alias of canonical `BFR`. Retain the source alias only in reconciliation evidence. Blank, unknown or conflicting codes remain review exceptions |
| Sector | `opportunities.sector` | Resolve valid `Secteur_code` values to the approved canonical label. Qualified `ZZZ (...)` values map to `Autre`; retain the qualifier only in the staff-only per-row reconciliation evidence and do not write `activity` or persist a second taxonomy |
| Description | `opportunities.description` | Required before activation |
| Revenue, EBITDA, headcount and range | Opportunity metrics | Write only when explicitly staged and approved; missing remains `null`, while an invalid supplied value blocks activation |
| Date added | `opportunities.date_added`, `opportunities.date_added_precision` | A full date maps to precision `day`; month/year maps to the first of that month plus precision `month`. Both values must be staged, digest-bound and activated together; missing remains `null`, while invalid or mismatched precision blocks activation |
| Platform title and teaser | `opportunities.public_title`, `teaser_summary` | A non-blank approved source value may be written; a blank source cell never clears an existing WAVE value. A title does not itself make an opportunity repreneur-visible |
| Positioned repreneur | Existing match or pursuit | Colin confirmed the source list is current, but WAVE links only a unique canonical identity. Ambiguous or absent people remain unlinked with review evidence; never store the label as free text |
| Associated contact email | Temporary contact matching evidence | Convert to an affiliation and opportunity contact; do not retain as the relationship |
| Notes | `opportunities.internal_notes` | Staff only; write only when explicitly staged and approved |

## Current implementation reconciliation

Verified against the live Supabase schema through migration 082 and the W-010 production activation. Migrations 076 to 082 are live. Production contains the canonical firm, office, contact, affiliation, opportunity-contact, interaction and NDA-artifact foundations; the legacy M&A objects are read-only compatibility evidence.

Gate 2 executed the final 076 to 078 sequence on 2026-07-26 in a disposable Supabase-compatible project whose six-table pre-076 M&A baseline was compared with the live schema catalog before any synthetic row was added. Runtime verification covered fail-closed invalid legacy data, current and historical contact bridging, email-only legacy retention, canonical and cutover privileges, lifecycle and digest rejection, two-contact activation with one primary, UTC/Rome digest equality, normalized-firm concurrency, stage-mutation and supersession serialization, transactional rollback and temporary-evidence purge. Gate 2 exposed and corrected an invalid legacy-affiliation backfill join in migration 076 and ambiguous activation-local identifiers in migration 078.

The 2026-07-28 W-010 activation reconciled all 148 approved opportunity references: 111 existing records were updated in place and 37 were created as Draft/staff-only. It retained existing UUIDs, lifecycle states, public titles, teasers, matches, documents and interactions; created or reconciled 229 firms, 431 offices, 575 named contacts, 603 active affiliations and 211 active opportunity-contact links; and purged temporary rows and issues atomically. Live verification found zero cross-office link violations. Twenty high-confidence positioned-repreneur labels became Draft matches, six ambiguous or absent identities remained unlinked, 18 named suppressed contacts retained a warning note, and 20 new Draft/staff-only opportunities remained without a live public title. WAVE is authoritative after this activation.

Migration 082 was applied to production on 2026-07-27 before application commit `d9bee7b` was deployed as Vercel deployment `dpl_DGYZPx2XGVLyJ2PFd1C1USDmg9fy`. Aggregate verification found the artifact table, enum, registration function, forced RLS, two artifact-table guards and linked-document guard present; browser roles had no access, the service role had read plus registration-service access but no direct write grant, and artifact, scope, document, digest, storage-path, pursuit, version-chain and legacy-promotion counts were all zero. No legacy NDA link was backfilled. Staff desktop and mobile QA showed the three retained PDF roles and compatibility warning; the repreneur persona was redirected to `/portal/deals` on both viewports, and no file was uploaded or operational record changed during release QA.

### Reproducible verification

Run `scripts/verify-ma-data-model-schema.sql` through the configured read-only Supabase connection against production project `iiuqcdnmxhtyispnykgf` before changing this section. The script performs these checks:

1. Read `information_schema.columns` for legacy and target M&A objects, including `ma_firms`, `ma_offices`, `ma_contacts`, `ma_contact_office_affiliations`, `opportunity_ma_contacts`, `ma_sources`, `ma_source_contacts`, `opportunity_source_contacts`, `opportunity_documents` and `opportunity_nda_artifacts`.
2. Read `pg_constraint` for their primary, foreign-key, unique and check constraints.
3. Read `pg_indexes` for their unique and partial indexes.
4. Compare the result with checked-in migrations, TypeScript types and this target contract.
5. Record the verification date above only after all four checks.

| Current live and checked-in object | Current behavior | Target disposition | Status |
| --- | --- | --- | --- |
| `ma_sources` | Interim firm-level source record. Embedded contact fields are deprecated compatibility fields after migration 072 | Retain as a read-compatibility bridge for existing records only; do not create it as a condition of new opportunity activation | Live, service-role read-only compatibility bridge |
| `ma_firms`, `ma_offices` | Canonical firm and operating-office model live since migration 076 | Backfilled one synthetic default office per legacy source and preserve `ma_sources` only as compatibility evidence | Live and production-verified |
| `ma_contacts`, `ma_contact_office_affiliations`, `ma_contact_email_policy_events` | Canonical people and current/historical office affiliations live since migration 076. W-010 retained 18 named do-not-email markers as staff notes only | Migration 083 adds person-level campaign suppression, immutable change/exception evidence and service-only audience/final-send authorization. It backfills only the exact 18 retained W-010 markers and leaves the original notes intact | W-072 live and production-verified on 2026-07-30 |
| `opportunity_ma_contacts` | Canonical office-affiliation opportunity links live since migration 076 | Snapshot contact attribution and retain `opportunity_source_contacts` for existing history | Live and production-verified |
| `ma_cutover_runs`, `ma_cutover_stage_rows`, `ma_cutover_stage_issues` | Service-role-only one-time cutover boundary used by W-010; the approved run is retained and temporary rows/issues were purged after activation | Retain only the constrained manifest evidence. Do not reuse the boundary as a recurring import or synchronization path | W-010 production activation complete; WAVE is authoritative |
| `ma_provisional_source_contexts`, `ma_provisional_source_review_events`, `ma_source_email_send_reservations` | Migration 079 provisions exactly one shared Acme Co. / Acme Paris context with Bertrand's existing canonical contact, plus immutable assignment/resolution snapshots, database guards on the complete fixed identity chain, and a content-free two-minute external-send reservation | Keep Acme as provisional operational context only. Compute review-required from canonical source office plus unresolved append-only evidence; block opportunity close/archive, existing external intermediary email, and cutover approval/activation until resolution. The email action performs the required review RPC, then reserves the opportunity row across context load, canonical pending evidence, provider delivery and finalization so a concurrent assignment/resolution cannot change the source between check and send. Explicit success or failure releases the reservation after finalization; an ambiguous provider outcome remains pending and blocks retry for reconciliation. The fixed Bertrand guard checks the supplied display name and independently derives the effective display name from normalized first/last-name components, so it remains authoritative for display-only writes and regardless of migration 076 trigger firing order. Acme assignment and cutover readiness share one transaction lock; approved/activating runs block a new assignment, while an activated historical run does not permanently disable later ordinary Acme use. W-065 provides a staff-only banner, list badge/filter and resolver form that uses only the existing service-only primitive and projects only a computed boolean. | W-064 and W-065 live and production-verified on 2026-07-27; zero browser-role source-review exposure |
| `opportunities.date_added_precision` | W-010 stored all 148 source dates with month precision and retained the parsing decision in the cutover evidence | Preserve month precision through display, export and any later correction; never present the technical first day as a source event day | Live and production-verified for W-010 |
| W-010 test-data replacement manifest | The W-010 release retained exact backup and replacement evidence before the controlled production switch | Keep the evidence immutable; do not treat it as authority for future deletions | W-010 production activation complete |
| `ma_source_networks` | Migration 074 created an optional grouping object for legacy firms | Keep it as read-only compatibility grouping. It cannot own workflow, scoring, reporting, contacts or opportunities; canonical firms use optional `network_label` | Legacy read-only compatibility bridge; canonical `network_label` live |
| `ma_source_contacts` | Migration 072 supports several contacts per firm-level source; migration 075 allows a contact record to move between sources | Retain as read-only legacy evidence; canonical identity plus office affiliations own new relationships | Live, service-role read-only compatibility bridge |
| `ma_source_contact_moves` | Migration 075 keeps append-only old and new source and contact details | Preserve the audit while canonical office affiliation history owns current relationships | Live, service-role read-only compatibility evidence; W-062 still owns interaction history |
| `opportunities.source_id` | Nullable firm-level compatibility bridge | Migration 076 retired the live-source requirement in favour of `source_office_id`. Existing pre-076 values remain compatibility evidence, but canonical services do not populate or reconcile them. The atomic service enforces source office, description, named primary contact and usable email for `active` and `paused` opportunities | Canonical `source_office_id` live and production-verified |
| `opportunity_source_contacts` | Migrations 072 and 075 support several contacts, at most one primary, source consistency and immutable contact snapshots after moves | Preserve as immutable compatibility history while `opportunity_ma_contacts` links through office affiliations and snapshots future links | Live, service-role read-only compatibility bridge |
| `ma_source_interactions` | Four legacy email rows, retained after W-062 only as service-role read-only evidence | No new writes; canonical `ma_interactions` is office required with optional affiliation and opportunity | W-062 live; migration 080 reconciled all four rows |
| `ma_interactions`, `ma_interaction_owner_verification_events`, `ma_interaction_delivery_events`, `ma_interaction_legacy_migration_manifest` | Migration 080 provides staff-only canonical history, append-only owner and delivery evidence, controlled begin/finalize/owner-verification services, and content-free before/after digests; migration 081 adds the narrow audited service for manual staff activity and allows evidence-only email records with no provider delivery fields; direct service-role table mutation remains denied | W-066 provides create/read timeline, filters and owner verification; attachments and general editing remain deferred | W-062 and W-066 live and production-verified |
| `opportunity_documents` | Migration 073 adds staff approval evidence, NDA evidence checks and service-role-only browser access | Retain the current confidentiality wall and keep opportunity documents separate from staff-only relationship attachments | Implemented and live verified |
| `opportunity_nda_artifacts` | Migration 082 retains immutable, versioned blank-template, Re-New-signed and repreneur-signed PDF evidence behind a service-only registration boundary | Keep artifact registration separate from Gate 1, Gate 2, source disclosure and lifecycle communications; validate those effects through their successor controls | W-043 live and production-verified; zero release-time artifact rows and no legacy promotion |

### Current field disposition

| Current field or group | Target disposition |
| --- | --- |
| `opportunities.activity` | Compatibility display only for existing data. It remains an allowlisted atomic intake field until useful meaning is merged into canonical sector or description, then remove |
| `opportunities.date_added` | Retain as the optional source-reported or staff-entered business date; add `date_added_precision` and never expose a technical first-of-month value as an exact source date |
| `opportunities.source_label` | Compatibility display only for pre-076 records. Canonical source-context saves never write it; staff displays derive the label through canonical joins before this duplicate is removed |
| `opportunities.imported_from`, `opportunities.imported_at` | Replace with the one-time cutover manifest and remove from live opportunity records after migration |
| `ma_sources.contact_name`, `contact_email`, `contact_phone` | Deprecated compatibility fields. Read them only for migration fallback, then remove after the office backfill and compatibility period |
| `ma_sources.network_id`, `ma_source_networks` | Interim grouping only. Collapse to optional `ma_firms.network_label` if the target contract remains unchanged |
| `ma_source_contacts.source_id`, `opportunity_source_contacts.source_id` | Interim firm-level relationships. Replace with office affiliations and office-anchored opportunity contacts in W-061 |
| `opportunity_source_contacts.contact_name_snapshot`, `contact_email_snapshot`, `contact_phone_snapshot` | Preserve as historical attribution when migrating the opportunity-contact relationship |
| `ma_source_interactions.*` | Retain every legacy row and field as service-role read-only compatibility evidence; no post-W-062 writer may target it |
| `ma_interactions.template_key`, `channel`, `direction` | Retain optional generated-email provenance and enforce direction for email and call |
| `ma_interactions.affiliation_id` | Canonical optional contact link; it must belong to the interaction office |
| `ma_interactions.recipient_email_snapshot`, `title`, `body_markdown` | Preserve outbound recipient, subject and body evidence independently of later contact changes |
| `ma_interactions.delivery_status`, `client_operation_key`, `provider_idempotency_key`, `provider_request_fingerprint`, `provider_message_id`, `delivery_error`, `sent_at`, `delivery_finalized_at` | Null for a manually recorded email, which records communication evidence without sending or claiming provider delivery. For a WAVE provider-delivery attempt, persist pending evidence before delivery, bind browser retries and the exact request, use the interaction UUID as provider idempotency key, and preserve explicit sent or failed finalization evidence; an ambiguous provider outcome remains pending and only the identical same-key request can replay within 23 hours |
| `ma_interactions.owner_staff_user_id`, `owner_verification_state` | Owner uses `app_user_roles.user_id` text; imported ownership is provisional until self-verified in immutable staff evidence |
| `opportunity_documents.repreneur_approved_by`, `repreneur_approved_at` | Retain as required disclosure evidence when a document is approved for repreneur access |
| `opportunity_nda_artifacts.*` | Retain all versions as immutable staff-only evidence. Never infer a canonical artifact from legacy match NDA fields or use artifact presence alone as gate, disclosure or delivery authority |
| `opportunities.repreneur_exposure` | Legacy compatibility field only. Do not expose it as a W-061 intake, import or target disclosure control. The atomic service writes `staff_only` for new records and draft transitions solely to prevent old portal reads from publishing them; it preserves existing visible active records. Visibility remains a separate match, staff-assignment and confidentiality decision |
| `opportunities.origin_channel` or any sourcing-channel field | Not a W-061 target and not an import mapping. Do not add one without a new approved operating use case |
| Cutover geography label and decision | Preserve the literal `opportunities.location` display value. Post-cutover reconciliation maps valid `Geo_code` through the approved source map into `geography_node_id`; `BFC` is a source alias of `BFR`. The source code remains mapping evidence only. Blank, unknown or conflicting codes remain explicit review exceptions |

The live model is now office-centred. The pre-076 firm-level source, contact and contact-move objects remain read-only compatibility evidence alongside the confidentiality wall; they are not a second write model. Do not roll back current history or confidentiality controls.

### W-063 staff intake reconciliation

W-063 must route new firm identity creation through `create_ma_firm_with_default_office`, new or additional contact relationships through `create_or_affiliate_ma_contact`, and new opportunity creation or updates through the atomic opportunity RPCs above. In the same integrated release it must retire or guard legacy direct mutations of `ma_sources`, `ma_source_contacts`, `opportunity_source_contacts` and firm-level opportunity source fields that could diverge from canonical offices and affiliations. The legacy tables are a one-way compatibility bridge and cutover evidence during transition, not a recurrent synchronization mechanism.

The W-063 database primitives are live. The matching application release is complete only after the production build and staff/repreneur browser paths are verified against them.

1. Staff create and edit forms load the `staff_ma_office_intake_projection`, select one canonical operating office and select one or more active office affiliations with exactly one primary affiliation.
2. Draft creation requires only a mandate reference. `active` and `paused` saves are delegated to `create_opportunity_with_office_context` or `save_opportunity_office_context`; the database owns the lifecycle validation and atomic link replacement.
3. Staff can create a new firm, its first office and first contact through `create_ma_firm_with_default_office`, then add another office contact through `create_or_affiliate_ma_contact`. The legacy Firm and Contacts directory routes redirect to intake and their server mutations are guarded.
4. Staff detail, Find, dashboard freshness, analytics and M&A email recipient selection prefer `source_office → firm` and `opportunity_ma_contacts → affiliation → contact`. Dashboard freshness renders canonical `Firm · Office` context and uses `source_label` only when the canonical relationship is absent. `ma_sources`, `ma_source_contacts` and `opportunity_source_contacts` are fallback reads for historical, unmigrated records only.
5. The current staff intake UI neither accepts nor displays repreneur exposure or an origin channel. Preparing a public title or teaser does not publish a deal. Current repreneur projections exclude firm, office, contact and affiliation data pending a separately implemented W-001-governed release; this implementation state is not the permanent disclosure policy.
6. Closed and archived opportunities remain read-only in intake. The previous generic reopen route is disabled pending a separately approved, audited canonical reopen workflow.
7. Migration 077 makes the legacy directory and opportunity-contact bridge objects read-only for the service role and retires `move_ma_source_contact`. Historical reads remain available, but no table or RPC mutation grant survives on those legacy bridge objects.
8. Release 076 and 077 inside one brief write-free maintenance window, deploy the W-063 application, verify canonical and legacy privileges, then reopen staff writes. Without that window, apply the database changes first so any old writer fails closed. Never rerun migrations 072 to 075 after 077 because they grant the retired bridge privileges.

## Change protocol

### What triggers an update

Update this document when any change affects:

1. An entity, attribute, type or allowed value.
2. Requiredness or lifecycle validation.
3. Cardinality, ownership, archival or deletion behavior.
4. Staff or repreneur visibility.
5. Import mapping, exception handling or data retention.
6. The implemented status of a target rule.

Ordinary corrections to record values do not change this contract.

### Required sequence

1. Update this contract before or with the implementation.
2. Record the business reason in the change log.
3. Update the migration, TypeScript types, importer, application validation, role-specific projections, display, exports and tests together.
4. Keep the migration additive until the new structure is live and backfilled.
5. Verify the released schema and role behavior.
6. Update the implementation reconciliation table only after verification.

### Approval

Ivan approves changes to requiredness, relationships, visibility and retention. The Dev team may update implementation status and technical names when the approved business meaning does not change. Bertrand and Colin provide operating evidence when an exception could justify a model change.

### Versioning

| Change | Version |
| --- | --- |
| Wording, examples or implementation status only | Patch |
| New optional field or backward-compatible rule | Minor |
| Changed relationship, requiredness, visibility or retention | Major |

Do not create a parallel M&A data model document. Link to this file instead.

## Change log

| Date | Version | Change | PDR or implementation reference |
| --- | --- | --- | --- |
| 2026-08-07 | 4.2.3 | Added W-078's staff-only WAVE AI next-action advisory projection. The server sends OpenAI only derived opportunity status, source-review, profile-completeness, date-precision and freshness buckets, match and active-pursuit counts, readiness, interaction unknowns, as-of time and the existing eligible action identifiers. It adds no M&A field, relationship, visibility rule, mutation or schema change. A staff member separately completes an existing deterministic source-review or profile-save action; the HMAC-linked ledger outcome is evidence only and a ledger failure cannot roll back that action. | W-078 implementation |
| 2026-08-07 | 4.2.2 | Added W-074's staff-only, server-authorized one-row-per-opportunity CSV export. It carries the approved operational fields, uses WAVE's derived Opportunity journey as `pipeline_status`, omits tags and Repreneur Journey stage, preserves month-only dates and retained canonical or legacy historical source identity without exporting `source_label`, calculates margin only from present revenue and EBITDA, emits no source email or phone, uses snapshot-bounded keyset reads and bounded match chunks past backend caps, uses formula-safe CSV cells and adds a UTF-8 BOM for Excel. No schema, repreneur projection or API route was added. | W-074 implementation |
| 2026-07-30 | 4.2.1 | Hardened migration 084 after rollback-only production proof found a retained legacy signed label without its required timestamp. Interest now fails closed before mutating an incomplete signed or waived legacy match, leaving confidentiality history unchanged and avoiding a raw constraint failure; the disposable rehearsal mirrors the production `NOT VALID` evidence constraints. | W-067 and migration 084 production-compatibility correction |
| 2026-07-30 | 4.2.0 | Added the checked-in W-067 candidate and migration 084: every active repreneur-visible deal can record one self-interest signal through the existing `opportunity_matches` pair. The atomic service rejects inactive, staff-only and self-active-pursuit cases; it preserves another repreneur's active pursuit, avoids reinterpreting ordinary historical interest, and retains notification retry/idempotency. No active pursuit, queue, lifecycle, disclosure or confidentiality state is created. | W-067 and migration 084 |
| 2026-07-30 | 4.1.0 | Released W-072 through migration 083 and application build `10.4845fe4`: exactly 18 imported contacts are suppressed with retained source notes and immutable backfill evidence; all six active linked NDA cases satisfy the narrow exception while linked general messages remain blocked. Staff desktop/mobile and repreneur-denial QA passed without a policy change or email send; final evidence contains zero live exceptions, removals or active reservations. | W-072 production release |
| 2026-07-30 | 4.0.2 | Made migration 083 compatible with the existing deferred contact-integrity trigger by installing its check constraint before the backfill and flushing queued integrity checks before later contact DDL; the disposable rehearsal now mirrors that production condition. No production object survived the rejected first attempt. | W-072 migration-order correction |
| 2026-07-30 | 4.0.1 | Added the checked-in W-072 implementation candidate: exact 18-person structured backfill with retained source notes, person-level suppression across affiliations, immutable staff change evidence, four machine-readable purposes with no generic bypass, an audited linked-opportunity NDA exception, final send authorization tied to the canonical interaction operation key, staff warnings and controlled removal. Migration 083 remains unapplied to production. | W-072 and migration 083 |
| 2026-07-30 | 4.0 | Recorded W-010's completed production activation and Colin's post-cutover operating decisions. Source `Secteur_code` and `Geo_code` now drive a bounded one-time reconciliation into canonical WAVE sector labels and geography nodes without becoming permanent source-code fields; qualified `ZZZ (...)` and `BFC` compatibility are explicit; the 109 source-title blanks are distinguished from the 20 live Draft title tasks; positioned repreneurs require unique canonical identities; and person-level campaign suppression blocks campaign/general outreach while permitting only audited, allowlisted opportunity-specific operational messages beginning with NDA requests. These new reconciliation and suppression rules are approved target behavior, not live implementation. | W-010, W-017, W-039, W-060, W-071 and W-072 |
| 2026-08-07 | 4.1 | W-089 implementation candidate: added explicit `source_teaser` support, private staff document delivery, PDF-only retained source-teaser/IM intake, database staff-only invariants for both types, no generic repreneur approval, and retained correction-by-new-document behavior. Pursuit-specific disclosure remains a separate successor control. | W-089 |
| 2026-07-28 | 3.0 | Approved the original source teaser as a separate retained `source_teaser` document that is permanently staff-only, cannot be promoted for repreneur access, and never replaces the anonymized summary or a separately controlled repreneur-facing teaser; implementation remains required | W-069 |
| 2026-07-27 | 2.5.1 | Applied migration 082 and released application commit `d9bee7b` through Vercel deployment `dpl_DGYZPx2XGVLyJ2PFd1C1USDmg9fy`. Production has the expected forced-RLS table, enum, registration service and immutability guards; browser access and direct service writes are denied, all release integrity counts are zero, no legacy NDA link was promoted and no artifact was created during release. Staff desktop/mobile QA showed all three retained roles and compatibility separation; repreneur desktop/mobile access redirected to `/portal/deals`, with no upload, email or operational mutation. | W-043 production release; migration 082 |
| 2026-07-27 | 2.5 | Added the checked-in W-043 implementation candidate: immutable, versioned staff-only blank-template, Re-New-signed and repreneur-signed NDA artifacts; private PDF-only registration with unique non-overwriting object paths and SHA-256 evidence; retained linked documents; no legacy promotion; and explicit separation from Gate 1, Gate 2, source disclosure and E4/E6/E7. Migration 082 is not applied to production. | W-043 foundation; migration 082 |
| 2026-07-27 | 2.4 | Applied migration 081 and released the staff Relationships workspace at application commit `bc08195` through Vercel deployment `dpl_hWUtoyFHcpe7em7PDmv2M73KEQQM`. Production retained four exact canonical legacy interactions, four provisional owners, zero manual, pending, delivery or owner-verification events, zero evidence-digest mismatches and zero interaction/opportunity office mismatches. Staff desktop and mobile QA showed the canonical timeline, all five manual activity types, valid outbound-recipient evidence and inbound recipient clearing without submitting a record; the repreneur persona redirected to `/portal/deals`. Browser/direct table access remains denied and no email was sent. | W-066 production release; migration 081 |
| 2026-07-27 | 2.3 | Tightened the checked-in W-066 candidate before release: an unresolved Acme provisional-source opportunity cannot receive immutable linked interaction history, linked creation locks and revalidates the opportunity alongside source assignment/resolution, manual outbound evidence requires a valid email address, and timeline contact filtering uses canonical contact identity across affiliations. Unlinked office-level activity remains available. Migration 081 remains unapplied to production. | W-066 implementation candidate; migration 081 |
| 2026-07-27 | 2.2 | Added the checked-in W-066 implementation candidate: a staff-only Relationships workspace with one canonical chronological interaction timeline, office/contact/opportunity filters, create/read capture before an opportunity exists, existing opportunity history reading that same canonical ledger, and self-only audited verification for provisional migrated owners. Migration 081 adds only a narrow service for manual staff activity and permits an evidence-only manual email with no provider delivery fields; it never sends email. Attachments and general interaction editing remain deferred. This migration is not applied to production. | W-066 implementation candidate; migration 081 |
| 2026-07-27 | 2.1.5 | Applied migration 080 to production and verified four legacy, manifest, canonical and migrated-delivery rows with preserved UUIDs and zero evidence-digest mismatches. All four interactions retain their source, office, contact, recipient and email evidence with Bertrand marked as provisional owner; no pending delivery or verification events were introduced. Browser roles have no canonical or legacy access, direct service-role table writes are denied, and only the audited owner-verification and delivery begin/finalize services remain. Application commit `e7bef56` is live as Vercel deployment `dpl_64EoSczWjY6heT4dSXMGP4r7yRNg`; staff desktop/mobile QA showed the migrated history and “Owner to verify” labels, repreneur route access redirected to the portal, and no email was sent. | W-062 production release; migration 080 |
| 2026-07-27 | 2.1.4 | Added the checked-in W-062 implementation candidate: additive office-anchored `ma_interactions`, same-office and parent-office database enforcement, a fail-closed four-row UUID-preserving legacy migration with content-free SHA-256 before/after evidence, provisional Bertrand ownership, append-only owner and provider-delivery evidence, and narrow begin/finalize services that persist a pending attempt before provider delivery and deny direct service-role table mutation. Browser response loss reuses a stable operation key; transport and provider ambiguity remains pending; and only the identical SHA-256-bound request may replay with the same provider key inside the 23-hour safety window. Confirmed failures rotate the browser operation key so a repaired unchanged request can make one new safe attempt. Attachments and general interaction create/edit UI remain deferred to W-066. This migration is not applied to production. | W-062 implementation candidate; migration 080 |
| 2026-07-27 | 2.1.3 | Added the W-065 staff-only source-review application boundary: computed review boolean on staff detail and lists, staff badge/filter, and correction through the existing W-064 resolver with canonical real-office affiliations, primary contact, reason, immutable evidence and no UUID recreation. No migration, repreneur projection, email path or roadmap entry is introduced. | W-065 implementation candidate |
| 2026-07-27 | 2.1.2 | Applied migration 079 to production and verified the single Acme Co. / Acme Paris context, reuse of Bertrand's canonical contact, null unavailable office details, empty assignment/review/reservation state, 11 enabled guards, RLS on all three new tables and no browser-role exposure. No opportunity was assigned and no email was sent. | W-064 production release |
| 2026-07-27 | 2.1.1 | Corrected the migration 079 Bertrand contact guard to derive the effective normalized display name from first/last-name components instead of depending on migration 076's later-named BEFORE trigger. The production-shaped rehearsal now proves service-role UPDATE cannot rename the fixed contact and INSERT cannot normalize into a Bertrand name collision. | W-064 and migration 079 |
| 2026-07-27 | 2.1 | Added the checked-in W-064 Acme provisional-source foundation: deterministic Acme Co. / Acme Paris provisioning with the existing Bertrand canonical contact, fixed-chain identity guards, append-only assignment and resolution evidence, computed review-required, service-only assignment/resolution primitives, deferred opportunity guards, serialized cutover readiness, and fail-closed protection on the existing external intermediary email action. A content-free short-lived send reservation closes the review-check-to-Resend race by blocking concurrent source assignment/resolution until delivery and logging finish. The checked-in disposable runner proves service-role deferred commits, clean rerun, identity collisions, committed email reservation behavior and the assignment-versus-cutover race. No staff review UI, repreneur projection or new email route is included. | W-064 and migration 079 |
| 2026-07-27 | 2.0 | Added the authoritative W-001 action-and-evidence matrix: staff/repreneur authority, per-validation E4 idempotency, exact E4/E6/E7/E8 and Gate 1/Gate 2 sequencing, pursuit-scoped source disclosure, distinct opportunity/pursuit closure rules, lifecycle evidence/retention rules, and the shared Acme provisional-source correction and cutover-blocking rule. This documentation release introduces no migration or new user-facing capability. | W-001; W-021 decision; future Acme and W-010 implementation cards |
| 2026-07-26 | 1.6 | Approved explicit day/month precision for opportunity dates, backup-first replacement of test opportunities and matches, and evidence-gated standing activation authority; implementation remains required before the real workbook is staged | W-010 |
| 2026-07-26 | 1.5.7 | Recorded the production application and verification of migrations 076 to 078, including the explicit correction of one invalid test opportunity to a staff-only draft while preserving its match records; no real workbook was imported | W-061, W-063 and W-020 production release |
| 2026-07-26 | 1.5.6 | Recorded disposable-database Gate 2 and corrected two runtime-only SQL defects found there: the migration-076 legacy affiliation backfill join and migration-078 activation identifier ambiguity; approved relationships, requiredness, visibility and retention are unchanged | W-061, W-063 and W-020 release verification |
| 2026-07-26 | 1.5.5 | Hardened W-063 against repeated or non-string contact FormData values so neither contact mode can silently select, create or affiliate an ambiguous identity | W-063 corrective follow-up |
| 2026-07-26 | 1.5.4 | Hardened the W-063 staff action against conflicting new-contact and existing-contact inputs, and made canonical-contact lookup failure invalidate stale selector data with an accessible retry state | W-063 corrective follow-up |
| 2026-07-26 | 1.5.3 | Closed the W-063 staff-intake gap: staff can select an active canonical person by contact identity to create an additional office affiliation, without submitting new person fields; current-office active affiliations are excluded and the canonical service remains the duplicate-pair backstop | W-063 corrective implementation |
| 2026-07-26 | 1.5.2 | Hardened W-020 re-review gaps: UTC-stable digest timestamp serialization, same-run issue foreign-key integrity, non-identifying algorithm-tagged retained fingerprints, and explicit Gate 2 timezone, raw-SQL-boundary and concurrency checks | W-020 and migration 078 |
| 2026-07-26 | 1.5.1 | Hardened the unapplied W-020 cutover boundary: PostgreSQL-owned SHA-256 approval digest, serialized approval/stage lifecycle, blocker gate before approval, bounded and allowlisted temporary evidence, guarded activation, and controlled supersession purge with retained sanitized manifest | W-020 and migration 078 |
| 2026-07-26 | 1.5 | Added the checked-in, unapplied W-020 one-time cutover rehearsal contract: explicit create/reuse resolution, digest-bound activation, manifest-controlled optional opportunity fields, transactional activation and purge, synthetic-only staff route, explicit geography/location decisions, and no browser import or activation path | W-020 and migration 078 |
| 2026-07-26 | 1.4.4 | Added explicit post-release service-role privilege and ownership evidence plus the fail-closed 076/077 deployment sequence | W-063 release verification and migrations 076 to 077 |
| 2026-07-26 | 1.4.3 | Completed the W-063 dashboard freshness canonical read: firm and office context now precede `source_label`, which remains a historical fallback only | W-063 and migration 076 release candidate |
| 2026-07-26 | 1.4.2 | Retired database-granted mutations on the legacy M&A directory, network, contact-move and opportunity-contact bridge while retaining service-role historical reads | W-063 and migration 077 |
| 2026-07-26 | 1.4.1 | Reconciled W-063 canonical staff intake with the approved target contract: atomic office-context create/edit, multiple office contacts, lifecycle activation invariants, staff-only disclosure firewall, canonical staff reads and guarded legacy directory writes | W-063 and migration 076 release candidate |
| 2026-07-26 | 1.4 | Serialized canonical firm intake by normalized name and rejected exact duplicate firm identities before creation | W-061 and migration 076 |
| 2026-07-26 | 1.3 | Added full leftmost child-FK indexes and explicit intermediate-RPC overload retirement to keep the unapplied W-061 migration performant and rerunnable without a granted bypass | W-061 and migration 076 |
| 2026-07-26 | 1.2 | Hardened the unapplied W-061 foundation with complete child-FK indexes, firm-archive protection, canonical firm/contact identity creation and affiliation, active/paused office-source validity, synthetic-default enforcement, allowlisted atomic opportunity intake fields, and the W-063 integrated-release routing dependency | W-061 and migration 076 |
| 2026-07-26 | 1.1 | Added the checked-in, unapplied W-061 office identity foundation: firm, office, contact affiliation and canonical opportunity-contact bridge; transactional draft/activation service; staff-only intake projection; historical contact-move bridge; and explicit retirement of static exposure and sourcing-channel target behavior | W-061 and migration 076 |
| 2026-07-26 | 1.0 | Created the approved office-centred target contract, field dictionary, cutover mapping and maintenance rules; reconciled it with the interim implementation | W-061, W-062 and migrations 072 to 075 |
