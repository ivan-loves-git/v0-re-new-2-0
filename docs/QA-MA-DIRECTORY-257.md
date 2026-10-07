# Staff M&A directory — reusable QA

The original release evidence is on [PR #193](https://github.com/ivan-loves-git/v0-re-new-2-0/pull/193).
The [approved retrospective follow-up](https://github.com/re-new-team/renew-governance/issues/260#issuecomment-6042072891)
owns the tooling below. The original build-phase evidence is retained further down;
its historical authority statements do not override current direct authorization.

## Reusable database proof

`pnpm qa:ma-directory --help` describes the command. Set only `MA_QA_DATABASE_URL`
from the approved credential source; the command never falls back to application
credentials or prints connection values/row contents. Its default is read-only
schema inspection against a disposable loopback database named `directory`.
Live reads require an explicit `--target live`. No command creates production
records or changes the product's business rules.

For separately authorized manual UI QA, choose a fresh UUID and name every owned
firm/person `QA 257 <uuid> <label>`. An office beneath that owned firm may keep its
ordinary name; an office added beneath an existing firm must carry the run tag.
Create/correct through the application's real controls. Contact corrections are
inline in the Contacts list; there is no contact-detail URL to invent.

```sh
pnpm qa:ma-directory capture --run-id <uuid> --manifest-file .qa-run/ma-manifest.json
pnpm qa:ma-directory verify --manifest-file .qa-run/ma-manifest.json
pnpm qa:ma-directory preflight --manifest-file .qa-run/ma-manifest.json
pnpm qa:ma-directory cleanup --manifest-file .qa-run/ma-manifest.json
pnpm qa:ma-directory verify-cleanup --manifest-file .qa-run/ma-manifest.json
```

Add `--target live` to every command for an authorized live target. Live preflight
and cleanup additionally require `MA_QA_ALLOW_LIVE_CLEANUP=1` and an explicit
`--approval-ref` pointing to the applicable #257/#260 approval. Those arguments
record treatment; they do not grant authority. This tooling follow-up itself
needs no live writes. Use disposable PostgreSQL for its mutation proof.

Capture uses current canonical tables and returns only owned IDs/fingerprints.
For partial failed journeys, `capture --owned-file <json>` accepts the exact
`{runId, firms, offices, contacts}` arrays instead of discovering by tag.
Manifests are private local files created once (0700 directory / 0600 file), not
overwritten or published. Verification rejects schema/identity/row drift.
Cleanup locks owned rows, discovers every inbound FK including cross-schema and
cascading references, blocks all unowned references, deletes exact IDs in FK
order, forces deferred constraints, and compares complete retained-row digests
including email logs. Cleanup requires an already authorized superuser/BYPASSRLS
database role so visibility policies cannot hide references; it grants no rights.
Preflight rolls back: `rehearsalRemaining: 0` is simulated,
not a cleanup claim. Only committed cleanup and fresh `verify-cleanup` report
actual zero residue. Keep the manifest until that final readback is complete.

`bash scripts/rehearse-ma-directory.sh` proves the public command against a fresh
production-shaped local PostgreSQL cluster, including an external cascading
history relation, identity drift, rollback persistence and final zero residue.
The protected product journey reuses the same owned-graph cleanup.

## Protected browser proof and bounded inspection

Ordinary PR/main Opening readiness runs prove M&A first, then the full existing
suite. A manual run can select `journey=ma-directory` for only that protected
journey; it is focused evidence, not full-suite acceptance. Existing disposable
runner, loopback, real-auth/rate-limit, fictional-mail and teardown guards remain.

Read the snapshot file emitted by the browser CLI, rather than requesting the
whole page inline:

```sh
pnpm agent:snapshot <snapshot.yml>
pnpm agent:snapshot <snapshot.yml> --ref e123
```

The default returns file metadata only. An exact single reference selects its
subtree, emits at most 60 lines / 8 KiB including JSON, marks truncation, and
omits credential-labelled controls and their nested values. Missing/ambiguous
references fail with no page output. Use deliberately fictional QA content for
shareable screenshots and keep unneeded browser artifacts local and ephemeral.

## Original candidate evidence — historical build phase

Authority: [Product Change #257](https://github.com/re-new-team/renew-governance/issues/257),
[Ticket #260](https://github.com/re-new-team/renew-governance/issues/260), closed
Decisions [#258](https://github.com/re-new-team/renew-governance/issues/258) /
[#259](https://github.com/re-new-team/renew-governance/issues/259).
Baseline: `a03227a50b0acef02e948663d5bfd83f4e5498d0`.
This is build/review evidence; no merge or production/data/outbound authority.

The behavioral action tests mock only session/header/role/database/cache system
boundaries. They exercise the application's actual staff guard and create/correct
actions. Each new rule was introduced after its failing behavioral case. The
database rehearsal runs the sanitized full public schema, current W-130/W-157
services, retained synthetic incomplete rows and the exact additive candidate
migration in a fresh local PostgreSQL cluster; it uses no project credentials.
It destroys the cluster on exit. The browser fixture runs actual Next,
Supabase and Better Auth at the exact candidate on GitHub's disposable stack,
with synthetic profiles and the existing fictional mail sink.

| Acceptance | Evidence seam |
| --- | --- |
| AC-01–AC-03 | `ma-directory-creation.test.ts`; PostgreSQL standalone/optional-contact graph and atomic invalid-field rejection; actual Firms creation/readback in `ma-directory.spec.ts` |
| AC-04–AC-06 | Actions and PostgreSQL named/located office; email/phone-only contact, missing name/channel, malformed supplied email and unavailable office; actual global/local contact controls |
| AC-07–AC-09 | Actions and PostgreSQL incomplete office/contact correction and narrow notes save; full before/after retained-row comparison; parent edit leaves children untouched; actual mobile error/input recovery and completion |
| AC-10 | Actual role guard tests for unauthenticated/unassigned create/correct/notes requests; database function grants; actual repreneur route rejection |
| AC-11 | Independent PostgreSQL transactions synchronized on an observed held fence for normalized firm/office duplicates; sole-current-office reuse veto |
| AC-12 | Normalized email advisory action/read and distinct persisted people; retained ended affiliations, primary/source links and immutable snapshots |
| AC-13 | Released opportunity validity service rejects phone-only primary; typed correction preserves Active/Paused primary email guard |
| AC-14 | Actor/time readback; actual induced database errors after earlier graph/affiliation writes leave no partial state; fresh browser reload/readback |
| AC-15 | Actual desktop/mobile Firms/Contacts/detail controls, named selected context, keyboard submission, visible field feedback, input recovery and viewport overflow assertion; synthetic screenshots |
| AC-16 | Pre-migration retained-row JSON equality, incomplete rows remain readable, synthetic flag/selection rules survive completion; no candidate data update/backfill |
| AC-17 | PostgreSQL email log remains empty; actual browser email-log count and retained suppression rows remain unchanged; existing opportunity/source/email regression suites |

Run `bash scripts/rehearse-ma-directory.sh`, scoped action regressions, then the
normal `pnpm verify` and conditional `pnpm data-model:check`. The protected
`Opening readiness fixture` includes `e2e/opening-readiness/ma-directory.spec.ts`
and publishes only deliberately synthetic M&A screenshots. Final exact-head
check/review links and any limitations are recorded on #260 and the draft PR;
this file does not claim an unrun check or live release.

Local candidate results on 7 October 2026: lint has zero errors (296 repository
warnings), typecheck passed, all 351 test files passed (2,217 passed / one existing
skip), and the production build passed with the same fictional environment
values as `Verify`. The complete disposable PostgreSQL rehearsal passed,
including observed independent-session duplicate races and primary-email guards.
The data-model checker passed. The advisory design checker reports an existing
decorative-edge finding at `components/reui/data-grid/data-grid-table.tsx:1817`,
outside this change; no visual-policy exception is claimed for the new controls.
Protected browser/CI results remain pending until their exact-head evidence is
linked on #260 and the draft PR.
