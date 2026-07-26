# WAVE M&A Data Model and Dictionary v1

## Contract status

| Item | Value |
| --- | --- |
| Status | Approved target contract |
| Implementation status | Migration 076 is checked in but not yet applied to production. Migration 078 is also checked in but not yet applied to production. The live database remains on the interim firm-level model. |
| Contract owner | Ivan Paudice, CTO and product owner |
| Implementation owner | Dev team |
| Business reviewers | Bertrand and Colin when a real operating case needs confirmation |
| PDR scope | W-061, M&A office and contact identity foundation; W-062, M&A relationship history; W-063, canonical staff opportunity intake |
| Last reviewed against live Supabase | 2026-07-26 |
| Last reviewed against source workbook | 2026-07-26, `CRM Re-New for Wave.xlsx` |

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

W-063 adds an additional person to an existing office, or links an existing canonical person to an additional office, through `create_or_affiliate_ma_contact`. It requires an actor and an active office beneath a non-archived firm. With `p_existing_contact_id`, it affiliates that active canonical contact and rejects contact profile fields; without it, it creates one named person from the supplied name fields. `p_contact_job_title` belongs to the affiliation in either mode. The service returns `contact_id` and `affiliation_id`, rejects an already-active pair, and never creates or mutates `ma_source_contacts`, `opportunity_source_contacts` or a recurrent legacy sync record.

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
| `geography_code` | Controlled code | Optional | Staff only | WAVE | Canonical matching geography |
| `geography_confidence` | `confirmed`, `review` | Conditional | Staff only | WAVE | Required when imported geography needs review |
| `sector` | Controlled label | Repreneur visible | Role appropriate | WAVE | Reader-facing canonical sector |
| `sector_code` | Controlled code | Optional | Staff only | WAVE | Canonical matching sector |
| `sector_confidence` | `confirmed`, `review` | Conditional | Staff only | WAVE | Required when imported sector needs review |
| `description` | Text | Valid opportunity | Staff only | WAVE | Full internal opportunity description |
| `revenue_meur` | Numeric | Optional | Role appropriate | WAVE | Revenue in millions of euros; missing remains `null` |
| `ebitda_keur` | Numeric | Optional | Role appropriate | WAVE | EBITDA in thousands of euros; missing remains `null` |
| `headcount` | Integer | Optional | Role appropriate | WAVE | Exact headcount when known |
| `headcount_range` | Controlled text | Optional | Role appropriate | WAVE | Range when exact headcount is not known |
| `date_added` | Date | Optional | Staff only | WAVE | Source-reported or staff-entered opportunity date; it is not the WAVE creation timestamp |
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
5. Source firm, source office, source contacts, relationship history and internal notes remain staff only at every stage.
6. Missing financial values remain `null`. Matching may apply a zero-equivalent only inside scoring and must flag incomplete inputs.
7. The source name shown in staff views is derived through the office and firm relationship. It is not stored as a second source relationship.
8. A positioned repreneur is represented by the existing match and pursuit objects, never by free text on the opportunity.
9. If an `active` or `paused` opportunity loses its usable primary contact email, WAVE blocks further operational mutations. Staff must correct the email, select another primary contact or close or archive the opportunity.
10. Closing or archiving an opportunity preserves its historical source office and contact links even when those contacts later move or become inactive. Canonical opportunity links capture contact snapshots at the time of linking; the migration 072/075 snapshots remain immutable compatibility evidence.
11. Staff create and edit use the atomic office-context services only. They do not write `source_id`, `source_label`, `opportunity_source_contacts`, `repreneur_exposure`, an origin channel or a separate source-contact relationship.
12. The atomic intake service cannot reopen a `closed` or `archived` opportunity. Reopening is a separate explicit workflow with its own audit and approval rules.

### Atomic intake write boundary

W-063 and W-020 save opportunity source context, contact selection, description, target status and optional intake fields through the audited `save_opportunity_office_context` and `create_opportunity_with_office_context` RPCs. Their final parameter is `p_opportunity_fields JSONB`, which accepts exactly:

`sector`, `activity`, `location`, `revenue_meur`, `ebitda_keur`, `headcount`, `headcount_range`, `date_added`, `public_title`, `teaser_summary`, and `internal_notes`.

An omitted key preserves the existing value; an explicit JSON `null` clears it. Numeric, integer and date values are parsed inside the same transaction, so a cast or validation failure rolls back source, contact, status and field changes together. The payload rejects unsupported keys and must never accept `source_id`, `source_label`, `source_office_id`, `repreneur_exposure`, `origin_channel`, `imported_from` or `imported_at`. Existing pre-076 `source_id` and `source_label` remain read-compatibility evidence only; the services neither populate nor reconcile them. Active and paused validity is defined by `source_office_id`.

Migration 076 explicitly revokes and drops any intermediate seven-argument opportunity save/create RPC overloads before it defines the final JSONB signatures. A rerun therefore cannot leave a granted pre-allowlist write path behind.

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
| `title` | Text | Optional | Staff only | WAVE | Short label or email subject |
| `summary` | Text | Conditional | Staff only | WAVE | Required unless at least one attachment or stored email body provides the evidence |
| `outcome` | Text | Optional | Staff only | WAVE | Result of the interaction |
| `next_action` | Text | Optional | Staff only | WAVE | Concrete follow-up |
| `next_action_due_at` | Timestamp | Conditional | Staff only | WAVE | Required when a dated next action is committed |
| `template_key` | Text | Conditional | Staff only | WAVE | Required only for an email created from a WAVE template |
| `recipient_email_snapshot` | Email | Conditional | Staff only | WAVE | Required for an outbound email; preserves what was actually used |
| `body_markdown` | Text | Optional | Staff only | WAVE | Stored email body or structured notes |
| `delivery_status` | `pending`, `sent`, `failed` | Conditional | Staff only | WAVE | Required for email delivery attempts |
| `delivery_error` | Text | Conditional | Staff only | WAVE | Required when email delivery fails |
| `sent_at` | Timestamp | Conditional | Staff only | WAVE | Required when an email is sent |
| `created_by`, `created_at` | Staff ID, timestamp | System | Staff only | WAVE | Creation audit |
| `updated_by`, `updated_at` | Staff ID, timestamp | System | Staff only | WAVE | Correction audit |

### Interaction rules

1. An interaction always belongs to an office.
2. A contact is optional. When present, its affiliation must belong to the same office.
3. An opportunity is optional. When present, its source office must equal the interaction office.
4. An interaction can exist before an opportunity.
5. Interactions are staff only and remain in chronological history.
6. A sent email preserves recipient, subject and body evidence even if the contact later changes email.
7. Corrections are audited. Interactions are not silently overwritten or hard deleted.

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
| `document_type` | `teaser`, `deal_book`, `nda`, `external_analysis`, `other` | Always | Role appropriate | WAVE | Controlled document category |
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
10. Source relationships, interactions and internal notes are staff only.
11. Excel identifiers never remain in live firm, office, contact or opportunity records.
12. A staff-only draft may have no source office or contacts. Moving to `active` or `paused` happens through the atomic office-context service and requires the full valid-opportunity rules. Activation never broadens repreneur disclosure; the legacy exposure field stays `staff_only` for new records and draft transitions until the old portal reads are removed.
13. An active or paused opportunity requires `source_office_id`; it does not require a legacy `source_id`.
14. Every migration 076 child foreign key that needs a standalone lookup has a full, leftmost index; a partial business index does not substitute for a parent-delete or update check.

## Repreneur visibility contract

| Data | Staff | Repreneur |
| --- | --- | --- |
| Firm, office and contact identities | Yes | Never |
| Firm, office and contact notes | Yes | Never |
| Interaction history and attachments | Yes | Never |
| Opportunity internal description and notes | Yes | Never |
| Opportunity public title, teaser, sector, location and approved metrics | Yes | Only when the opportunity visibility and confidentiality gates allow it |
| Opportunity documents | Yes | Only when explicitly approved and the NDA gate allows it |
| Cutover mappings and issues | Yes | Never |

No API, export, notification, download or UI surface may expose staff-only source information to a repreneur.

## Source workbook mapping

The cutover mapper uses the workbook structure as input. The workbook does not define the WAVE architecture.

### One-time cutover rules

1. Excel remains operationally authoritative until Ivan announces the production switch. WAVE data remains test data until then.
2. There is one production cutover import. A revised workbook before approval replaces the pending input; it does not create a recurring sync.
3. Source rows and temporary mappings are staged outside the live domain tables in `ma_cutover_runs`, `ma_cutover_stage_rows` and `ma_cutover_stage_issues`. Missing or conflicting information is never invented. Every staged firm, office, contact and affiliation has an explicit reviewed resolution: `create`, or `reuse` with its reviewed canonical WAVE ID. A matching name, email or office never auto-reuses a live record.
4. An incomplete opportunity remains an import exception until it has a source office, description, named primary contact and usable primary email.
   Its full selected affiliation set is retained, every selected affiliation must belong to that source office, and the primary affiliation must be one of the selected affiliations.
5. Duplicate candidates are reviewed before activation. Missing financial values remain `null`.
6. A service-role-only, security-invoker activation locks the approved run, receives and compares its immutable approval digest, requires zero unresolved blockers, creates a dependency-closed canonical firm, office, contact, affiliation and opportunity set, verifies the W-061 operational-validity rules, records aggregate results, then purges temporary rows and issues in the same transaction. Any error rolls back and leaves staging intact.
7. After row counts and relationships reconcile and Ivan approves the migration, temporary rows and every source workbook ID are deleted. Live records retain only WAVE IDs.
8. Keep a cutover manifest with a source hash or fingerprint, execution and approval times, responsible staff member, aggregate record totals, exception decisions and immutable approval digest. Its structured review decisions identify every optional opportunity field approved for this run. It retains no raw workbook bytes or Excel identifiers. The manifest is migration evidence, not another business entity or recurring import system.
9. A cell containing several email addresses is never imported as one address:
   1. If the addresses belong to one named person, staff verifies one usable primary email. Other addresses remain in the cutover resolution note unless a future contact-method model is approved.
   2. If the addresses belong to different people, split them into separate contacts.
   3. If ownership is unclear or an address is malformed, keep the row as an exception.

### W-020 cutover-rehearsal boundary

Migration 078 is an unapplied cutover foundation, not an import launch. It adds staff-only staging and a service-role-only activation primitive; no browser role receives table or function access. The `/opportunities/import` route is staff-gated and displays a deterministic in-repository synthetic rehearsal only. It accepts no workbook, file, pasted CSV/TSV/JSON rows or other production input, has no direct database write, and exposes no activation server action.

The approval digest binds the staged content and its structured `review_decisions`. `review_decisions.approved_opportunity_fields` is the only optional-field authorization and may contain only `sector`, `activity`, `location`, `revenue_meur`, `ebitda_keur`, `headcount`, `headcount_range`, `date_added`, `public_title`, `teaser_summary`, and `internal_notes`. Each field must be both explicitly staged and approved. A missing metric or date remains `null`; an invalid supplied metric or date is a blocker and activation rejects it until staff resolves the stage row.

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
| Repeated firm website and region | Derived from office | Do not duplicate on the contact |

### Opportunity rows

| Source meaning | WAVE target | Rule |
| --- | --- | --- |
| Mandate reference | `opportunities.reference` | Required and unique |
| Opportunities worksheet, column B | Temporary source office ID | Maps to `source_office_id`; required before activation and deleted after cutover |
| Source name | Validation evidence | Do not retain a duplicate source relationship |
| Location and source geography label | `opportunities.location` plus temporary geography decision | Write location only when the staged value and manifest both approve it; retain only source label plus `confirmed`, `review` or `null` during cutover; do not infer a code |
| Sector and activity | `opportunities.sector`, `activity` | Write only when explicitly staged and included in the approved manifest allowlist |
| Description | `opportunities.description` | Required before activation |
| Revenue, EBITDA, headcount and range | Opportunity metrics | Write only when explicitly staged and approved; missing remains `null`, while an invalid supplied value blocks activation |
| Date added | `opportunities.date_added` | Write only when explicitly staged and approved; missing remains `null`, while an invalid supplied date blocks activation; WAVE `created_at` records system creation |
| Platform title and teaser | `opportunities.public_title`, `teaser_summary` | Write only when explicitly staged and approved; this does not make it repreneur-visible |
| Positioned repreneur | Existing match or pursuit | Never store as free text on the opportunity |
| Associated contact email | Temporary contact matching evidence | Convert to an affiliation and opportunity contact; do not retain as the relationship |
| Notes | `opportunities.internal_notes` | Staff only; write only when explicitly staged and approved |

## Current implementation reconciliation

Verified against the live Supabase schema and checked-in migrations 072 to 075 on 2026-07-26. Migrations 076 and 078 are checked-in, unapplied release candidates; do not describe their target tables or cutover path as live until the production schema check runs after publication.

### Reproducible verification

Run `scripts/verify-ma-data-model-schema.sql` through the configured read-only Supabase connection against production project `iiuqcdnmxhtyispnykgf` before changing this section. The script performs these checks:

1. Read `information_schema.columns` for legacy and target M&A objects, including `ma_firms`, `ma_offices`, `ma_contacts`, `ma_contact_office_affiliations`, `opportunity_ma_contacts`, `ma_sources`, `ma_source_contacts`, `opportunity_source_contacts` and `opportunity_documents`.
2. Read `pg_constraint` for their primary, foreign-key, unique and check constraints.
3. Read `pg_indexes` for their unique and partial indexes.
4. Compare the result with checked-in migrations, TypeScript types and this target contract.
5. Record the verification date above only after all four checks.

| Current live and checked-in object | Current behavior | Target disposition | Status |
| --- | --- | --- | --- |
| `ma_sources` | Interim firm-level source record. Embedded contact fields are deprecated compatibility fields after migration 072 | Retain as a read-compatibility bridge for existing records only; do not create it as a condition of new opportunity activation | Legacy compatibility read only in the W-063 staff path; target foundation checked in, not live |
| `ma_firms`, `ma_offices` | Not present in the live baseline | Migration 076 creates the canonical firm and operating-office tables, backfills one synthetic default office per legacy source, and preserves `ma_sources` as the compatibility bridge | Checked in, not live |
| `ma_contacts`, `ma_contact_office_affiliations` | Not present in the live baseline | Migration 076 creates canonical people and current/historical office affiliations. A legacy email-only or phone-only row stays only in the bridge until staff supplies a name | Checked in, not live |
| `opportunity_ma_contacts` | Not present in the live baseline | Migration 076 links opportunities through affiliations, snapshots contact attribution, and retains `opportunity_source_contacts` for existing history | Checked in, not live |
| `ma_cutover_runs`, `ma_cutover_stage_rows`, `ma_cutover_stage_issues` | Not present in the live baseline | Migration 078 holds one-time, service-role-only staging rows and exceptions. The retained run manifest holds source fingerprint/hash, aggregate reconciliation, decisions, actor/times and immutable approval digest; temporary identifiers and rows are purged after successful activation | Checked in, not live |
| `ma_source_networks` | Migration 074 and current staff UI create an optional grouping object for firms | Freeze it as compatibility grouping only. It cannot own workflow, scoring, reporting, contacts or opportunities. Collapse it to optional firm `network_label` in W-061 unless a real operating use case is approved | Current divergence; resolve in W-061 |
| `ma_source_contacts` | Migration 072 supports several contacts per firm-level source; migration 075 allows a contact record to move between sources | Migrate to one contact identity plus one or more office affiliations | Legacy compatibility read only in the W-063 staff path; target gap remains until production cutover |
| `ma_source_contact_moves` | Migration 075 keeps append-only old and new source and contact details | Supersede with end-dated office affiliation history while preserving the audit | Implemented interim model; target gap, W-061 |
| `opportunities.source_id` | Nullable firm-level source bridge. Migration 073 requires it for new or updated `active` opportunities | Migration 076 retires that live-source requirement in favour of `source_office_id`. Existing pre-076 values remain compatibility evidence, but canonical services do not populate or reconcile them. The atomic service enforces source office, description, named primary contact and usable email for `active` and `paused` opportunities | Checked in, not live |
| `opportunity_source_contacts` | Migrations 072 and 075 support several contacts, at most one primary, source consistency and immutable contact snapshots after moves | Preserve as immutable compatibility history while `opportunity_ma_contacts` links through office affiliations and snapshots future links | Checked in, not live |
| `ma_source_interactions` | Opportunity remains required and history remains email-oriented. Migration 072 adds an optional contact link and preserves recipient evidence | Office required; contact and opportunity optional; support call, email, meeting and document | Partial contact linkage; target gap, W-062 |
| `opportunity_documents` | Migration 073 adds staff approval evidence, NDA evidence checks and service-role-only browser access | Retain the current confidentiality wall and keep opportunity documents separate from staff-only relationship attachments | Implemented and live verified |

### Current field disposition

| Current field or group | Target disposition |
| --- | --- |
| `opportunities.activity` | Compatibility display only for existing data. It remains an allowlisted atomic intake field until useful meaning is merged into canonical sector or description, then remove |
| `opportunities.date_added` | Retain as the optional source-reported or staff-entered business date; do not confuse it with `created_at` |
| `opportunities.source_label` | Compatibility display only for pre-076 records. Canonical source-context saves never write it; staff displays derive the label through canonical joins before this duplicate is removed |
| `opportunities.imported_from`, `opportunities.imported_at` | Replace with the one-time cutover manifest and remove from live opportunity records after migration |
| `ma_sources.contact_name`, `contact_email`, `contact_phone` | Deprecated compatibility fields. Read them only for migration fallback, then remove after the office backfill and compatibility period |
| `ma_sources.network_id`, `ma_source_networks` | Interim grouping only. Collapse to optional `ma_firms.network_label` if the target contract remains unchanged |
| `ma_source_contacts.source_id`, `opportunity_source_contacts.source_id` | Interim firm-level relationships. Replace with office affiliations and office-anchored opportunity contacts in W-061 |
| `opportunity_source_contacts.contact_name_snapshot`, `contact_email_snapshot`, `contact_phone_snapshot` | Preserve as historical attribution when migrating the opportunity-contact relationship |
| `ma_source_interactions.template_key` | Retain as optional template provenance for generated emails |
| `ma_source_interactions.channel`, `direction` | Retain and expand under the interaction contract |
| `ma_source_interactions.contact_id` | Interim contact link. Migrate to `affiliation_id` while preserving the contact and recipient snapshot |
| `ma_source_interactions.recipient_email`, `subject`, `body_markdown` | Map to recipient snapshot, title and body while preserving sent evidence |
| `ma_source_interactions.status`, `error_message`, `sent_at` | Map to delivery status, delivery error and sent timestamp |
| `opportunity_documents.repreneur_approved_by`, `repreneur_approved_at` | Retain as required disclosure evidence when a document is approved for repreneur access |
| `opportunities.repreneur_exposure` | Legacy compatibility field only. Do not expose it as a W-061 intake, import or target disclosure control. The atomic service writes `staff_only` for new records and draft transitions solely to prevent old portal reads from publishing them; it preserves existing visible active records. Visibility remains a separate match, staff-assignment and confidentiality decision |
| `opportunities.origin_channel` or any sourcing-channel field | Not a W-061 target and not an import mapping. Do not add one without a new approved operating use case |
| Cutover geography label and decision | Stay in temporary staging and aggregate manifest decisions. Do not infer a canonical geography code; write `opportunities.location` only when the approved manifest explicitly approves that text |

The live baseline represents the current flat firm-level source model, multiple contacts, network grouping, contact moves and confidentiality wall. Migration 076 is the additive W-061 release candidate from that interim implementation to the target firm, office and affiliation model. Do not roll back current history or confidentiality controls.

### W-063 staff intake reconciliation

W-063 must route new firm identity creation through `create_ma_firm_with_default_office`, new or additional contact relationships through `create_or_affiliate_ma_contact`, and new opportunity creation or updates through the atomic opportunity RPCs above. In the same integrated release it must retire or guard legacy direct mutations of `ma_sources`, `ma_source_contacts`, `opportunity_source_contacts` and firm-level opportunity source fields that could diverge from canonical offices and affiliations. The legacy tables are a one-way compatibility bridge and cutover evidence during transition, not a recurrent synchronization mechanism.

W-063 is checked in as an application release candidate and is not a statement about the live database until migration 076 and production browser verification are complete.

1. Staff create and edit forms load the `staff_ma_office_intake_projection`, select one canonical operating office and select one or more active office affiliations with exactly one primary affiliation.
2. Draft creation requires only a mandate reference. `active` and `paused` saves are delegated to `create_opportunity_with_office_context` or `save_opportunity_office_context`; the database owns the lifecycle validation and atomic link replacement.
3. Staff can create a new firm, its first office and first contact through `create_ma_firm_with_default_office`, then add another office contact through `create_or_affiliate_ma_contact`. The legacy Firm and Contacts directory routes redirect to intake and their server mutations are guarded.
4. Staff detail, Find, dashboard freshness, analytics and M&A email recipient selection prefer `source_office → firm` and `opportunity_ma_contacts → affiliation → contact`. Dashboard freshness renders canonical `Firm · Office` context and uses `source_label` only when the canonical relationship is absent. `ma_sources`, `ma_source_contacts` and `opportunity_source_contacts` are fallback reads for historical, unmigrated records only.
5. The staff intake UI neither accepts nor displays repreneur exposure or an origin channel. Preparing a public title or teaser does not publish a deal. Repreneur projections continue to exclude firm, office, contact and affiliation data.
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
3. Update the migration, TypeScript types, application validation and tests together.
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
