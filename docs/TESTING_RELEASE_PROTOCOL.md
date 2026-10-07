# How we build and release

Application-specific checks and release requirements. Ivan selects the Matt stage under the [7 October manual-workflow decision](https://github.com/re-new-team/renew-governance/blob/main/docs/adr/2026-10-07-ivan-led-matt-workflow.md); this document does not orchestrate stages. [Decision #233](https://github.com/re-new-team/renew-governance/issues/233) retains the established quality gates.

## Authority and ownership

Read the owning Product Change, applicable Decisions and the Ticket when one exists before execution. [Decision #70](https://github.com/re-new-team/renew-governance/issues/70) owns the full autonomous Ready contract. Exact direct Codex authority can instead authorize bounded scope; record its action boundaries on the existing card. A build-only instruction stops at a reviewed candidate. Merge, production, live-data treatment and outbound actions require their corresponding authority. A narrower issue or current Codex instruction wins.

Pause only the affected lane for a material unresolved choice or source conflict, scope expansion, unspecified confidentiality/security/legal/payment/external-side-effect or live-data treatment, unapproved destructive action, unsafe verification/rollback, a verification failure requiring a product/risk choice, unavailable authority or an invalid candidate. Routine mechanics within recorded authority proceed without another approval.

Use an isolated clean branch/worktree from a recorded current baseline and preserve unrelated work. Do not overwrite or race another writer on shared files, contracts or data. Resolve concrete overlap before editing; integrate and release shared changes serially. Reconcile unexplained changes or a moving main before integration and rerun affected checks. No separate Sprint supervisor, wave plan, fixed worker model, quota reading or cross-chat polling is required. Use the selected Matt skill's collaborators and session settings.

## Implement and review

1. When Ivan selects `implement`, use the authorized bounded Product Change specification or selected unblocked Ticket. Do not create Tickets or run another top-level skill automatically. Apply the actual installed Matt method, including its nested steps.
2. Use Matt `tdd` where a behavioral seam is practical: reproduce the invariant through the highest existing public seam, then one red-green slice at a time. Run focused tests/typecheck during work; full verification once at the end. Replace brittle implementation-string assertions when touching their behavior, rather than rewriting the entire suite.
3. Freeze the candidate SHA and read its originating specification. Apply Matt `code-review`: parallel, independent **Standards** and **Spec** axes, grounded in changed ranges and actual contracts/callers. Extra domain review is conditional on a named risk. Resolve findings in a batch; re-review changed evidence and retain valid unchanged evidence.
4. Use `pnpm verify` (lint, typecheck, tests, build) as the one final local verification satisfying both Matt and Re-New; do not add another full local pass for the same unchanged candidate. Reuse valid component results and rerun only for changed code, relevant environment differences, failed checks or explicitly required proof. Documentation-only edits need source/reference review. Changed UI additionally needs desktop/mobile browser proof. M&A contract changes use the conditional checker in AGENTS; design checks remain advisory.
5. Publish a PR linked to the owning Product Change or Ticket within the requested scope. Required `Verify` must pass on that exact candidate. Honor additional proof explicitly required by the governing Ticket; preserve supplemental checks as separate evidence.

Behavior tests live in `lib/**/__tests__/` following the existing style. Test observable behavior rather than workflow source text, package-script strings or config JSON. Database/concurrency fixtures stay disposable; production-writing QA requires its exact authorized treatment.

## CI and local limits

`Verify` is the only branch-protection required check on main. The existing workflow verifies pull-request candidates, main pushes and explicit manual runs. Superseded candidates are cancelled within their own event/ref group. The [opening fixture #93](https://github.com/re-new-team/renew-governance/issues/93) remains scoped proof, not a universal new gate.

An unavailable local port, external-font access or known Turbopack sandbox failure is environment evidence. Record that limit; reuse completed lint/typecheck/tests for unchanged code. Repeat a same-host build only after a relevant environment change. Full exact-candidate CI build is still required.

Use the existing read-only `pnpm agent:pr-status --pr <number> [--json] [--repo owner/repo]` when a classified snapshot is useful. It reports exact head, independently observed live base, comparison, required and supplemental identities, and drift/unknown states. Exit 0 means complete collection, not a passing candidate; exit 1 is partial/stale/unavailable, exit 2 invalid input. Review the reported evidence rather than treating exit status as permission.

For waiting, use one existing required-check watcher (for example `gh pr checks <number> --required --watch`) plus the explicitly Ticket-required checks. Keep the candidate pinned; classify supplemental failures and retain their evidence instead of silently waiving them. Superseded/cancelled/missing proof is not success. Avoid rebuilding temporary all-check watchers or release finalizers; use the existing helper and structured tracker/provider APIs for the release actions.

## Integrate and prove

When release is explicitly requested within existing authority, recheck current main and the reviewed candidate, then serially merge the exact verified PR. A Matt skill finishing does not start release automatically. Refresh/reverify a changed baseline before merge. Let Vercel deploy the merged main commit; establish exact merged SHA → deployment → production alias before claiming a release. Exercise changed behavior with approved personas/disposable fixtures, including permissions, persistence, side effects and cleanup where relevant. Screenshots show appearance, not release proof. For tooling-only changes, prove the published tooling/workflow behavior; there is no useful product screenshot.

Perform migrations, backfills, customer messages and other external effects only under their separately recorded treatment. If live proof fails, leave affected delivery in Review and record the failure; resolve routine defects within scope, escalating only a product/risk choice. A scoped code revert is the normal rollback; record additional data treatment when relevant.

When a Ticket exists, close it after its accepted scope is proven. Close the Product Change only after its distinct outcome is complete; a child's copied summary or passing checks cannot close a factual pilot/calibration gate. The [routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md#keep-one-readable-delivery-record) owns readable card summaries, screenshots and pending closeout. Remove only clean task-owned worktrees and preserve unrelated state.

## Communication and follow-up

The routing adapter owns Slack timing and receipts: after live proof and parent closure, one concise Product Change update only under #70 standing communication authority without a narrower exclusion, or exact explicit send authority. A failed/uncertain post stays a discoverable closeout action; it neither changes product truth nor permits a blind resend. Founder summaries are prepared only when Ivan requests them. No quota readings or automatic process reports are required by direct Matt calls.

Process comparisons are separate, user-requested read-only work using existing evidence. The former automatic [#232 comparison](https://github.com/re-new-team/renew-governance/issues/232) is not a delivery duty. Preserve its history and Ivan's explicitly scheduled follow-ups; do not generate new measurement, reporting or coordination work.

Local intake fixture mode: `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` in `.env.local` plus server restart shows dummy-data Autofill on `/intake-v2`; it defaults false and remains off in production. Credentials follow AGENTS' confidentiality boundary.
