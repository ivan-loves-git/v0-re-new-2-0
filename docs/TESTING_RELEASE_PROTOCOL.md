# How we build and release

Canonical application delivery procedure. [Decision #233](https://github.com/re-new-team/renew-governance/issues/233) removes duplicated procedure while retaining the existing gates.

## Authority and ownership

Read the owning Product Change, Ticket and Decisions before execution. [Decision #70](https://github.com/re-new-team/renew-governance/issues/70) owns the full autonomous Ready contract. Exact direct Codex authority can instead authorize bounded scope; record its action boundaries on the existing card. A build-only instruction stops at a reviewed candidate. Merge, production, live-data treatment and outbound actions require their corresponding authority. A narrower issue or current Codex instruction wins.

Pause only the affected lane for a material unresolved choice or source conflict, scope expansion, unspecified confidentiality/security/legal/payment/external-side-effect or live-data treatment, unapproved destructive action, unsafe verification/rollback, a verification failure requiring a product/risk choice, unavailable authority or an invalid candidate. Routine mechanics within recorded authority proceed without another approval.

One supervisor owns tracker state, integration and release. Default to one writer in an isolated clean branch/worktree from a recorded current main. At most two lanes may run when each has its own branch/worktree, Ticket, non-overlapping surfaces and independent verification, with no shared route, component, action, data model, migration, package/configuration, fixture, auth/visibility, integration or production-data surface. Read-only research/review may run alongside them. Shared risky work, integration, merges, production writes and closure remain serial. Reconcile unexplained changes or a moving main before integration and rerun affected checks.

## Implement and review

1. Claim one unblocked authorized Ticket and use its existing specification. Apply the installed Matt `implement` method.
2. Use Matt `tdd` where a behavioral seam is practical: reproduce the invariant through the highest existing public seam, then one red-green slice at a time. Run focused tests/typecheck during work; full verification once at the end. Replace brittle implementation-string assertions when touching their behavior, rather than rewriting the entire suite.
3. Freeze the candidate SHA and read its originating specification. Apply Matt `code-review`: parallel, independent **Standards** and **Spec** axes, grounded in changed ranges and actual contracts/callers. Extra domain review is conditional on a named risk. Resolve findings in a batch; re-review changed evidence and retain valid unchanged evidence.
4. Run `pnpm verify` (lint, typecheck, tests, build). Documentation-only edits need source/reference review. Changed UI additionally needs desktop/mobile browser proof. M&A contract changes use the conditional checker in AGENTS; design checks remain advisory.
5. Publish a PR linked to the Ticket. Required `Verify` must pass on that exact candidate. Honor additional proof explicitly required by the governing Ticket; preserve supplemental checks as separate evidence.

Behavior tests live in `lib/**/__tests__/` following the existing style. Test observable behavior rather than workflow source text, package-script strings or config JSON. Database/concurrency fixtures stay disposable; production-writing QA requires its exact authorized treatment.

## CI and local limits

`Verify` is the only branch-protection required check on main. The existing workflow verifies pull-request candidates, main pushes and explicit manual runs. Superseded candidates are cancelled within their own event/ref group. The [opening fixture #93](https://github.com/re-new-team/renew-governance/issues/93) remains scoped proof, not a universal new gate.

An unavailable local port, external-font access or known Turbopack sandbox failure is environment evidence. Record that limit; reuse completed lint/typecheck/tests for unchanged code. Repeat a same-host build only after a relevant environment change. Full exact-candidate CI build is still required.

Use the existing read-only `pnpm agent:pr-status --pr <number> [--json] [--repo owner/repo]` when a classified snapshot is useful. It reports exact head, independently observed live base, comparison, required and supplemental identities, and drift/unknown states. Exit 0 means complete collection, not a passing candidate; exit 1 is partial/stale/unavailable, exit 2 invalid input. Review the reported evidence rather than treating exit status as permission.

For waiting, use one existing required-check watcher (for example `gh pr checks <number> --required --watch`) plus the explicitly Ticket-required checks. Keep the candidate pinned; classify supplemental failures and retain their evidence instead of silently waiving them. Superseded/cancelled/missing proof is not success. Avoid rebuilding temporary all-check watchers or release finalizers; use the existing helper and structured tracker/provider APIs for the release actions.

## Integrate and prove

The supervisor rechecks current main and the reviewed candidate, then serially merges the exact verified PR. Refresh/reverify a changed baseline before merge. Let Vercel deploy the merged main commit; establish exact merged SHA → deployment → production alias before claiming a release. Exercise changed behavior with approved personas/disposable fixtures, including permissions, persistence, side effects and cleanup where relevant. Screenshots show appearance, not release proof. For tooling-only changes, prove the published tooling/workflow behavior; there is no useful product screenshot.

Perform migrations, backfills, customer messages and other external effects only under their separately recorded treatment. If live proof fails, leave affected delivery in Review and record the failure; resolve routine defects within scope, escalating only a product/risk choice. A scoped code revert is the normal rollback; record additional data treatment when relevant.

Close a Ticket after its accepted scope is proven. Close its parent only after the parent's distinct outcome is complete; a child's copied summary or passing checks cannot close a factual pilot/calibration gate. The [routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md#keep-one-readable-delivery-record) owns readable card summaries, screenshots and pending closeout. Remove only clean task-owned worktrees and preserve unrelated state.

## Communication and follow-up

The routing adapter owns Slack timing and receipts: after live proof and parent closure, one concise Product Change update only under #70 standing communication authority without a narrower exclusion, or exact explicit send authority. A failed/uncertain post stays a discoverable closeout action; it neither changes product truth nor permits a blind resend. Founder summaries are prepared only when Ivan requests them. Keep private quota readings and account identity in Codex.

During the [#232 comparison](https://github.com/re-new-team/renew-governance/issues/232), use the next three similar eligible cards' existing claim/start, review/PR, successful CI and exact-live timestamps. Record phase elapsed times and evidenced waiting causes on #232. Separate simple UI/bug work from email/database changes, preserve unknowns and overlapping CI runs, and make no causal speed/cost claim from unmatched work. No new instrumentation or reporting system is required.

Local intake fixture mode: `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` in `.env.local` plus server restart shows dummy-data Autofill on `/intake-v2`; it defaults false and remains off in production. Credentials follow AGENTS' confidentiality boundary.
