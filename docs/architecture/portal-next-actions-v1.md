# Portal next actions, v1

Authority: [Product Change #114](https://github.com/re-new-team/renew-governance/issues/114), [Decision #128](https://github.com/re-new-team/renew-governance/issues/128), and [Ticket #132](https://github.com/re-new-team/renew-governance/issues/132). This is a read-only presentation of currently authorized facts. It adds no lifecycle state, task record, reminder, priority, inferred due date, or write path.

## Read boundary

`readPortalNextActions` requires the current PortalAccess owner before constructing a service client. Staff preview requires staff access and a verified actor-bound, current selected-owner workspace token before the new query. The existing owner/preview opportunity readers supply only Active, same-namespace visible matches and public-safe titles. Discovery-only rows are excluded. A source owner or namespace mismatch makes the whole projection unavailable. The new External Pursuit query selects only `id,title,next_action,responsible_party,due_at,stage,deletion_status` for that owner and active deletion state; it does not use the staff board RPC or read notes, contacts, source details, or cross-owner rows. Any incomplete read yields “unavailable,” not an empty list of supposedly completed actions.

The panel sits above the default `/portal/pursuits` workspace and remains visible in its External view. The selected-owner staff preview uses the same narrow projection with workspace-scoped links. `/portal/deals` is a discovery entry, so there is no second mount there. Every link opens an existing route, which rechecks current owner, namespace, gate and resource authorization at use time.

## Current predicates

| Group | Display only when | Link |
| --- | --- | --- |
| Your actions: review recommendation | Current match is `proposed`; the authoritative action indicator says `respond`; response window is open. A historical null expiry stays unclocked. | Own matched deal |
| Your actions: sign and upload NDA | Current Active pursuit projection says `sign_nda` with `not_submitted` signed-copy state. That projection requires a ready notice, an actually authorized current template, enabled journey, Active match and opportunity, and no revocation. | Own matched deal |
| Your actions: External follow-up | Owner's undeleted, nonterminal dossier has both nonblank `next_action` and `responsible_party=owner`. `due_at` is shown only when recorded. | Own External Pursuits view |
| Waiting for Re-New: interest | Current match is `interested`, has a submitted-interest event, and has not been rejected. | Own matched deal |
| Waiting for Re-New: NDA | Current Active pursuit's signed copy is awaiting validation. | Own matched deal |
| Waiting for Re-New: External follow-up | Same paired, open dossier fact, with `responsible_party=staff`. | Own External Pursuits view |
| Available resources | Current NDA action authorizes the blank template; an active confidential grant authorizes the information memorandum. | Existing checked resource route |

`withdrawn`, expired, dropped, completed, deleted, blocked, revoked and unknown states never become tasks. Resource links do not count as obligations. External recorded `due_at` is a civil date, displayed without derived overdue status. Recommendation expiry is the existing timestamp, displayed without a new priority or clock. Text is an approved public deal title or the owner's saved External follow-up; source names, staff notes and contact fields never enter this projection.

## Verification trace

`lib/__tests__/portal-next-actions.test.ts` covers the strict current-state predicates, explicit 72-hour expiry versus null historical expiry, document grants/revocation, paired External facts, missing due dates, and terminal/deleted exclusions. `lib/__tests__/portal-next-actions-reader.test.ts` covers owner authorization, stale preview token, source-owner/namespace mismatch, exact minimal query, and serialization that omits private fields. The existing Pursuits entry and staff preview page tests verify the two mounts. Synthetic browser checks cover desktop/mobile layout and keyboard focus; no real owner or staff data is used for UI proof.
