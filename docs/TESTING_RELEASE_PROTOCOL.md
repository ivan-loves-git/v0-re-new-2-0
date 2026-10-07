# How we build and release

Canonical application delivery procedure. [Decision #233](https://github.com/re-new-team/renew-governance/issues/233) removes duplicated procedure while retaining the existing gates.

## Authority and ownership

Read the owning Product Change or Ticket and relevant Decisions before execution. The [routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md) and the 7 October amendment to [Decision #70](https://github.com/re-new-team/renew-governance/issues/70) govern the Ivan-led workflow. They supersede the historical automatic execution and supervisor clauses. Exact direct Codex authority can authorize bounded scope; record its action boundaries on the existing card. A build-only instruction stops at a reviewed candidate. Merge, production, live-data treatment and outbound actions require their corresponding authority. A narrower issue or current Codex instruction wins.

Reuse Ivan's existing authorization across the same conversation and delivery chain, including subsequently approved technical follow-ups such as implementing its retrospective recommendations. An explicit authorization through release covers ordinary implementation, review, PR publication, verified merge, deployment, final verification and GitHub closeout; do not ask again merely because a skill finished or approval was not repeated in the latest turn. Record that reused authority on the existing card. An agent-authored build-only summary cannot override Ivan's instruction. The [accepted authorization-reuse amendment](https://github.com/re-new-team/renew-governance/blob/main/docs/adr/2026-10-07-ivan-led-matt-workflow.md#authorization-reuse-amendment--7-october-2026) governs this rule; explicit user holds and the exceptions below remain binding.

Pause only the affected lane for a material unresolved choice or source conflict, scope expansion, unspecified confidentiality/security/legal/payment/external-side-effect or live-data treatment, unapproved destructive action, unsafe verification/rollback, a verification failure requiring a product/risk choice, unavailable authority or an invalid candidate. Routine mechanics within recorded authority proceed without another approval.

Use an isolated clean branch/worktree from a recorded current main and preserve unrelated work. Do not race another writer on shared surfaces. Keep shared risky changes, integration, merges, production writes and closure serial. Reconcile unexplained changes or a moving main before integration and rerun affected checks. Delegation follows the invoked skill; this procedure imposes no fixed supervisor or additional worker duties.

## Implement and review

1. Use the authorized bounded Product Change specification or selected Ticket. Apply the installed Matt `implement` method; do not create or select Tickets automatically.
2. Use Matt `tdd` where a behavioral seam is practical: reproduce the invariant through the highest existing public seam, then one red-green slice at a time. Run focused tests/typecheck during work; full verification once at the end. Replace brittle implementation-string assertions when touching their behavior, rather than rewriting the entire suite.
3. Freeze the candidate SHA and read its originating specification. Apply Matt `code-review`: parallel, independent **Standards** and **Spec** axes, grounded in changed ranges and actual contracts/callers. Extra domain review is conditional on a named risk. Resolve findings in a batch; re-review changed evidence and retain valid unchanged evidence.
4. Run `pnpm verify` (production dependency audit, active-instruction check, lint, typecheck, tests, build). `pnpm security:audit` uses the same parser and policy locally and in CI: High/Critical findings block, as do unavailable or invalid audit results. Install the repository-local hooks with `pnpm hooks:install` to run this audit before push and check commit messages; the installer preserves an existing different hooks path. Documentation-only edits need source/reference review. Changed UI additionally needs desktop/mobile browser proof. M&A contract changes use the conditional checker in AGENTS; design checks remain advisory.
5. Publish a PR linked to the owning Product Change or Ticket. Required `Verify` must pass on that exact candidate. Honor additional proof explicitly required by its specification; preserve supplemental checks as separate evidence.

Behavior tests live in `lib/**/__tests__/` following the existing style. Test observable behavior rather than workflow source text, package-script strings or config JSON. Database/concurrency fixtures stay disposable; production-writing QA requires its exact authorized treatment.

For lifecycle-transition changes, exercise the relevant disposable database rehearsal before publishing and include the existing Opening readiness fixture on the exact review candidate. Positive fixture transitions use the canonical product operation; raw writes belong to explicit rejection probes. Opening's complete Supabase/browser fixture remains restricted to its protected disposable GitHub runner. If that stack is unavailable locally, record the limitation and obtain its exact-candidate CI proof before integration; do not weaken its environment guards to run it elsewhere.

A successful rollback-only database preflight must run `SET CONSTRAINTS ALL IMMEDIATE` after the fixture operations and before `ROLLBACK`. Rollback alone does not exercise deferred commit constraints. Opening's `preflight` command rehearses its setup this way before the persisted setup. Use the same constraint check for any separately authorized live QA preflight, without treating it as permission to persist data.

## CI and local limits

`Verify` is the only branch-protection required check on main. The existing workflow verifies pull-request candidates, main pushes and explicit manual runs. Superseded candidates are cancelled within their own event/ref group. The [opening fixture #93](https://github.com/re-new-team/renew-governance/issues/93) remains scoped proof, not a universal new gate.

An unavailable local port, external-font access or known Turbopack sandbox failure is environment evidence. Record that limit; reuse completed lint/typecheck/tests for unchanged code. Repeat a same-host build only after a relevant environment change. Full exact-candidate CI build is still required.

Use the existing read-only `pnpm agent:pr-status --pr <number> [--json] [--repo owner/repo]` when a classified snapshot is useful. It reports exact head, independently observed live base, comparison, required and supplemental identities, and drift/unknown states. Exit 0 means complete collection, not a passing candidate; exit 1 is partial/stale/unavailable, exit 2 invalid input. Review the reported evidence rather than treating exit status as permission.

For waiting, use one existing required-check watcher (for example `gh pr checks <number> --required --watch`) plus the explicitly Ticket-required checks. Keep the candidate pinned; classify supplemental failures and retain their evidence instead of silently waiving them. Superseded/cancelled/missing proof is not success. Avoid rebuilding temporary all-check watchers or release finalizers; use the existing helper and structured tracker/provider APIs for the release actions.

## Integrate and prove

Before an authorized release, recheck current main and the reviewed candidate, then serially merge the exact verified PR. Refresh/reverify a changed baseline before merge. Let Vercel deploy the merged main commit; establish exact merged SHA → deployment → production alias before claiming a release. Exercise changed behavior with approved personas/disposable fixtures, including permissions, persistence, side effects and cleanup where relevant. Screenshots show appearance, not release proof. For tooling-only changes, prove the published tooling/workflow behavior; there is no useful product screenshot.

Perform migrations, backfills, customer messages and other external effects only under their separately recorded treatment. If live proof fails, leave affected delivery in Review and record the failure; resolve routine defects within scope, escalating only a product/risk choice. A scoped code revert is the normal rollback; record additional data treatment when relevant.

Close a Ticket after its accepted scope is proven. Close its parent only after the parent's distinct outcome is complete; a child's copied summary or passing checks cannot close a factual pilot/calibration gate. The [routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md#keep-one-readable-delivery-record) owns readable card summaries, screenshots and pending closeout. Remove only clean task-owned worktrees and preserve unrelated state.

## Communication and follow-up

The routing adapter owns Slack timing and receipts: after live proof and parent closure, one concise Product Change update only under #70 standing communication authority without a narrower exclusion, or exact explicit send authority. A failed/uncertain post stays a discoverable closeout action; it neither changes product truth nor permits a blind resend. Founder summaries are prepared only when Ivan requests them. Keep private quota readings and account identity in Codex.

The historical [#232 comparison](https://github.com/re-new-team/renew-governance/issues/232) creates no duties in the current workflow. Reports and comparisons run only when explicitly requested, using the current routing adapter and existing evidence.

Local intake fixture mode: `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` in `.env.local` plus server restart shows dummy-data Autofill on `/intake-v2`; it defaults false and remains off in production. Credentials follow AGENTS' confidentiality boundary.
