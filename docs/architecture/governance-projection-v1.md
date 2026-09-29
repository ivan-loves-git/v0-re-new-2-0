# Governance projection v1

## Founder reporting v2 build candidate — Ticket #212

**Status:** build candidate under [Decision #210](https://github.com/re-new-team/renew-governance/issues/210). The current v1 snapshot and manual refresh remain the production contract until separate publication authority. No live PDR refresh, founder access change, intake cutover, merge, or production data operation is authorized by this candidate.

The source is the private `re-new-team/renew-governance` Project and its accepted Strategy Registry. The registry is pinned to an exact repository commit. Issue and Project facts are observed at collection time, not frozen by that commit; the immutable snapshot records both the registry revision/commit and its true retrieval/snapshot times. The current pointer separately records `lastValidatedAt`, the source retrieval time of the last successful confirmed GitHub validation for that digest. A confirmed unchanged collection advances only this pointer time; it does not rewrite snapshot history or its `snapshotAt`. Preview and failure advance neither. The view is stale when `lastValidatedAt` is more than 24 hours old; it displays both validation and snapshot times. A rollback to an old retained snapshot uses that snapshot's old retrieval time and cannot claim a fresh GitHub check. The triggering Product Change's `Pending closeout` row records retry state. For an accepted strategy-only Decision with no Product Change, that Decision carries the pending refresh row. No watcher or second tracker is introduced.

### Delivery evidence source

GitHub `Issue.closedAt` is the closure time. An open or reopened Product Change has no current closure, regardless of historical snapshots or completed children. A closed Product Change is **completed scope** only when `closedAt` exists, its Project status is `Done`, and GitHub `stateReason` is `COMPLETED`; this does not imply production release. A closed `Cancelled / Superseded` Product Change is excluded from completed totals. Its exact cancellation or supersession reason is known only when the distinct, strictly parsed comment below says so; otherwise the disposition remains unknown. Missing closure date or reason stays unknown and appears in a separate unverified-closure count, out of completed and released totals. `updatedAt`, merged PRs, screenshots, child status, and static roadmap entries never establish closure or production release.

An optional, separate HTML comment in the *existing Product Change issue body* carries only reviewed reporting facts. It is independent of the `renew-governance` placement marker. The collector reads the body transiently, parses this one block with a strict field allowlist, and never stores the body or any comment text:

```yaml
<!-- renew-founder-reporting
schema: 1
release:
  state: verified
  commit: 0123456789abcdef0123456789abcdef01234567
  released_at: 2026-09-27T12:00:00.000Z
  verified_at: 2026-09-27T12:30:00.000Z
  proof_url: https://github.com/re-new-team/renew-governance/issues/123#issuecomment-456
summary:
  text: "The team can now see the approved outcome in WAVE."
  approval_url: https://github.com/re-new-team/renew-governance/issues/123#issuecomment-789
-->
```

`disposition` is optional and may be `cancelled` or `superseded` only for a closed Project `Cancelled / Superseded` item. It must be absent for `Done`. `release` is optional (unknown when absent). It may be `{state: not_released}` only after an explicit checked absence of production release, or the complete `verified` form above. `verified` requires the exact application `main` commit, deployment time, later live-verification time, and a durable proof comment on the same Product Change. The operator checks that the linked private proof records the production deployment serving that commit and the changed behavior working live before confirming apply; the collector validates the shape and same-card link, never promotes a PR/deployment/status/screenshot alone. A release recorded on a reopened Product Change remains a previous verified event and cannot count current completed scope. `summary` is optional and is shown only with a verified release. Its single-line, at most 240-character text needs an explicit Ivan approval comment linked on the same Product Change. The operator verifies the exact text and approval before apply; no automatic paraphrase or issue/comment prose fallback is allowed. The reporting block's canonical digest is its evidence revision; its source issue `updatedAt` and the snapshot digest provide further change provenance.

The v2 payload persists only the existing allowlisted strategy/issue fields plus Product Change closure time, disposition, nullable verified release fields, nullable approved summary and evidence revision. Decision, Ticket and Bug reporting events are not accepted. Raw bodies, comments, attachments, private discussions, account usage, client/operational records and unapproved copy never enter the payload. Historical v1 snapshots remain readable and retain unknown closure/release facts; v2 never relabels them as shipped. The reader validates either version and the digest before rendering. A versioned SQL update permits v2 writes while retaining immutable v1 history. Rollback reselects a prior validated compatible snapshot and reader without deleting history.

The v2 dry run lists only the Product Change, evidence revision, release state, and safe proof/approval links that need review. Before applying any block with `release`, the operator opens those same-card links, verifies the exact production commit and live proof or the explicit non-release, and checks that Ivan approved the exact safe summary if present. Apply requires both `--confirm <registry-revision>:<digest>` and `--evidence-checked <digest>` for that preview. The second confirmation records an intentional human evidence check; URL shape alone does not prove production delivery or copy approval. Neither preview nor apply is run against live data during this build stage.

### Founder view and roadmap

The protected view leads with accepted Goals, Outcome Milestones, and their registered KPI definitions. It shows current completed Product Change count once per parent, verified production-release count separately, and Ticket/Bug progress as child detail. Cancelled, superseded, open/reopened, unknown disposition and historical PDR Work Cards never inflate delivered totals. A release never proves milestone or KPI achievement; operational actuals remain unavailable until separately sourced and approved. The view states its last successful snapshot time and 24-hour stale state, and points to GitHub for current delivery decisions.

The current `/strategic-pdr` route is staff-only in code: `(dashboard)` and the page both use `requireStaffAccess`. Ivan confirmed on 27 September that founders already use WAVE staff accounts, so this candidate keeps the existing role and protected route; role tests must deny repreneur and unassigned access. Every active 24-hour screening and request-detail freshness check uses the same current-pointer validation time; snapshot time remains provenance. The static `/guide/roadmap` remains a historical narrative, not a second current delivery authority. Its current-status claim and automatic update duty must be replaced by this same projection before #212 release; any later editorial history update is only on Ivan's explicit request, owned by Codex, with no ongoing duplicate reporting obligation.

`re-new-team/renew-governance` is the authority. WAVE stores only the immutable, allowlisted snapshot created by `pnpm governance:refresh`; neither the browser nor ordinary WAVE/AI reads require a GitHub token.

Run the command without flags first. It pins `main` to an exact commit, validates the full accepted registry plus bounded issue facts against the persisted-reader contract, and prints a revision/digest confirmation. To write, run the exact printed confirmation with `--apply` and, when reporting evidence is present, `--evidence-checked <digest>` after checking its linked proof. Invalid GitHub data, GitHub outage, failed validation, or an optimistic-current conflict writes nothing and leaves the previously selected snapshot and validation time intact. A repeated identical confirmed apply does not create a new snapshot; it records the successful collection time on the current pointer.

The snapshot deliberately excludes GitHub issue bodies, comments, attachments, and all other prose. Future staff UI and WAVE AI call `readCurrentGovernanceProjection()` and receive either the same current snapshot revision or an explicit unavailable state; there is no PDR fallback.

Historic closed Done child records may be excluded only when they have no native Issue Type (`legacy_missing_issue_type`) or are a native Ticket/Bug directly parented by a closed non-Product-Change record (`legacy_non_product_change_parent`). Each exclusion must exactly reproduce its source title and URL, carry no governance marker fields, and cannot be a dependency of an active item. Every other unknown type fails the refresh; these generic exceptions never guess a type or placement.

Persisted data is limited to the accepted registry, bounded issue facts (number, title, type/state/status, timestamps, assignees, parent/dependency numbers, allowed Re-New platform pull-request references, approved placement, and the v2 Product Change reporting allowlist), plus the safe exclusion record. Issue bodies, discussion, attachments and other prose are never stored.

The repository tests exercise the projection contract and assert the migration's required security primitives, but they do not execute the SQL against PostgreSQL. Applying the migration to the production database remains its own explicitly authorised gate and must include a disposable or provider-backed SQL verification before any live snapshot is written.
