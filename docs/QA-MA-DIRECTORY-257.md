# Staff M&A directory — candidate evidence

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
