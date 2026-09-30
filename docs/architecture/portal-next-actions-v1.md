# Portal next actions, v1

Authority: [Product Change #114](https://github.com/re-new-team/renew-governance/issues/114), [Decision #128](https://github.com/re-new-team/renew-governance/issues/128), and [Ticket #132](https://github.com/re-new-team/renew-governance/issues/132). This is a read-only presentation of currently authorized facts. It adds no lifecycle state, task record, reminder, priority, inferred due date, or write path.

## Read boundary

`readPortalNextActions` requires the current PortalAccess owner before constructing a service client. Staff preview requires staff access and a verified actor-bound, current selected-owner workspace token before the new query. The existing owner/preview opportunity readers supply only Active, same-namespace visible matches and public-safe titles. Discovery-only rows are excluded. A source owner or namespace mismatch makes the whole projection unavailable. The new External Pursuit query selects only `id,title,next_action,responsible_party,due_at,stage,deletion_status` for that owner and active deletion state; it does not use the staff board RPC or read notes, contacts, source details, or cross-owner rows. Any incomplete read yields “unavailable,” not an empty list of supposedly completed actions.

The panel sits above the default `/portal/pursuits` workspace and remains visible in its External view. The selected-owner staff preview uses the same narrow projection with workspace-scoped links. `/portal/deals` is a discovery entry, so there is no second mount there. Every link opens an existing route, which rechecks current owner, namespace, gate and resource authorization at use time.

## Shared portal foundation (#241 / Ticket #243)

[Product Change #241](https://github.com/re-new-team/renew-governance/issues/241) and [Ticket #243](https://github.com/re-new-team/renew-governance/issues/243) approve the application-only foundation before redesign. Deals, Profile and Pursuits use the same complete customer compositions in the real portal and selected-owner staff preview: headings, acquisition-project guidance, sorting, Re-New/External navigation and FR/EN interface copy. Deal detail retains the existing shared pursuit workspace. The staff dashboard shell, owner selector, identity banner and attributed assistance remain outside that customer composition. [Decision #183](https://github.com/re-new-team/renew-governance/issues/183) continues to own permissions: preview never records personal Viewed/Reviewed, certification, account preferences or feedback submission. Those personal capabilities are explicitly unavailable; existing approved staff assistance remains attributed to the staff actor.

| Selected screen | Required read |
| --- | --- |
| Deals | Canonical full Deal Flow, including automatic-matching completeness, DEMO classification and the selected sort |
| Profile | Owner-safe profile and owned matches; customer account preference state only in the actual portal |
| Re-New Pursuits | Owned matches, action indicators and the existing cross-space next-actions projection |
| External Pursuits | Exact-owner External board and attachments, plus narrow owned matches required by the cross-space next-actions panel; no live Deal Flow inventory |
| Deal detail | Exact authorized match-or-opportunity and a separate owned-match sidebar, current pursuit projection and permitted attributed staff controls |

A stale explicit staff workspace is rejected before any selected-screen data load. Preview guidance, sort, deal, return and resource links retain the selected owner/workspace. Navigation reads never stand in for login, personal evidence or permission grants. The panel still shows all currently authorized Re-New and External action types in either Pursuits view: selected-screen loading does not silently hide cross-space guidance.

Duplicate safe pursuit projections share React server `cache` within one render request, keyed by exact owner and match; role access is resolved before using that read. The External screen supplies its already-read exact-owner follow-up fields and the Re-New screen supplies its already-read indicators to the panel, avoiding duplicate queries without serializing private board fields. Geography already loaded for a selected detail is reused for its criteria comparison. There is no persistent, cross-request or cross-user data/permission cache. Mutation handlers and NDA/IM download routes remain independent fresh authorization boundaries, including selected-owner generation and current grant checks.

Navigation shows a translated accessible loading status through transitions/route fallbacks. Only deliberate link hover or focus initiates prefetch; there is no blanket data warm-up. A selected tab remains controlled by committed server content, and pending status does not prove content completion. Readiness evidence records click feedback separately from complete-screen rendering, production-like fresh/repeat desktop/mobile distributions, environment and any unachieved target (repeat about 1 second, typical content below 2 seconds). No timing improvement is asserted from unit tests.

The candidate `vercel.json` places server functions in `fra1`, nearer the verified database region `eu-central-2` than the observed baseline `iad1`. This is an application-wide backend placement change, including API, server actions and cron functions, not a portal-only setting. It adds no cache, authentication, data, provider-plan or permission change. Deployment and timing proof remain separately owned; the region setting by itself proves no latency gain. Application rollback restores the previous composition/readers and removes the explicit region to restore the project's prior configured placement. Existing cron schedules and build-ignore behavior are preserved.

Acceptance traces: `portal-foundation-screens.test.ts` exercises complete rendering, guidance, personal-only availability and FR/EN fallback; `staff-portal-preview-page.test.ts` exercises selected-screen loads, committed route content, metadata/sort and stale workspace denial; `staff-portal-preview-demo-count.test.ts` exercises canonical safe read adapters, owned-history/namespace eligibility and staff denial; `portal-next-actions-reader.test.ts` exercises reused safe projections, cross-space guidance and owner mismatch. Existing pursuit, language, selection, confidentiality and personal-review regressions remain required. Standards/Spec review, exact-candidate `pnpm verify`, desktop/mobile read-only QA, actual region and timing evidence belong to #243. A verified draft candidate remains Review until separately authorized release and exact live proof.

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
