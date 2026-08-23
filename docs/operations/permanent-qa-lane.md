# Permanent QA lane operations

Owner: Re-New engineering
Acceptance owner: quality_tester
Business cost authority: Ivan

## Fixed resources

- Supabase: exactly one persistent Micro branch under production project `iiuqcdnmxhtyispnykgf`; no production data clone and no PR ownership.
- Vercel: existing protected project `renew-overnight-validation-20260820`, Preview target, provider-managed stable `qa` branch alias `renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app`, no production/custom domain. The manually assigned `renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app` alias is pinned and must be rejected.
- GitHub: environment `qa-pilot` (name retained), required check `P1-P3 protected pilot`. The historical `qa` git pointer is retired and must not be moved by the controller.
- No premium runner, additional project, email plan or external service is part of this lane.

## Cost

Supabase management readback on 2026-08-22 quoted Micro branch compute at USD 0.01344/hour, or USD 9.6768 for 30 days. Branch egress and storage remain usage exposure and are not assumed to be protected by Spend Cap. The branch must remain empty except during serialized synthetic journeys; monthly review must verify one non-default branch only, Micro compute, zero customer/Auth/Storage object rows and no unexplained usage.

## Candidate operation

1. A trusted `main` workflow admits a candidate only through explicit `repository_dispatch` (`qa_candidate`) or trusted `workflow_dispatch`. There is no `workflow_run` admission and ordinary push/PR events cannot start the lane.
2. Admission validates that the supplied branch and exact 40-character SHA are the current head of a same-repository open PR, the actor has write access, and the exact GitHub Actions `Verify` run is green. Identical-contract candidates are accepted on explicit admission. A database-changing candidate requires reviewed schema fields (`schema_reviewed=true`, `qa-schema-review-v1`, exact contract SHA-256).
3. The workflow creates `P1-P3 protected pilot` on that exact SHA and holds global concurrency `renew-permanent-qa`. It does not move any `qa` git pointer and does not request `contents: write`.
4. A dedicated `deploy-qa` job receives only `QA_VERCEL_TOKEN`, optional `QA_VERCEL_TEAM_ID`, and `VERCEL_AUTOMATION_BYPASS_SECRET`. It checks out the trusted controller only, never executes candidate application code, and never receives `DATABASE_URL` or Supabase service-role credentials. It creates exactly one Preview deployment in project `renew-overnight-validation-20260820` (`prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y`) for the admitted candidate branch and SHA, binds `meta.githubCommitSha` and the candidate ref, waits for `readyState=READY`, assigns the preserved stable alias, and uploads sanitized provider evidence containing deployment id, project, ref, SHA, target, READY state and alias readback.
5. Database and browser jobs consume that sanitized evidence artifact. They never receive `QA_VERCEL_TOKEN`. Only after identity proof do they verify the deployed non-secret QA contract, synchronize schema when required, acquire the lease, run P1–P3, clean up, and finalize the check.

Candidate SHA, branch, run ID, fixture prefix and stable QA origin are runtime data, not rotating secrets. The workflow runs from the trusted repository and rejects forks/foreign repositories.

## Validation deploy architecture (Route A)

Root cause of the Hobby quota burst: both the product project and the validation project were connected to the same high-churn GitHub repository, so many pushes created paired deployments. Moving a shared `qa` pointer compounded the problem.

Approved architecture:

1. Admit candidates only through explicit dispatch.
2. Deploy the admitted candidate branch and exact SHA directly through the Vercel Deployment API. Do not retain a branch-pointer deployment trigger.
3. Isolate the deploy credential in `deploy-qa`.
4. Keep database/browser jobs on sanitized provider evidence only.
5. Resolve daily-health expected SHA from the stable alias, not `origin/qa`.

### Corrected cutover order

1. Create and prove an expiring token scoped only to the QA validation project.
2. Migrate any `qa`-branch Preview environment values on the validation project to ordinary Preview scope.
3. Disable the old Golden Journeys workflow so no automatic or pointer-based lane can run during cutover.
4. Disconnect Git from the validation project only.
5. Verify the product project `v0-re-new-2-0` remains Git-connected.
6. Prove that the proposed `gitSource` API call still works after disconnection, or replace it with a supported source-upload deployment before enabling the lane.
7. Wait for provider capacity (do not guess a quota-reset minute; read the live provider response).
8. Merge the corrected controller through an explicitly documented bootstrap.
9. Re-enable the corrected Golden Journeys workflow.
10. Run QA daily health on current `main` and require success before ordinary Golden Journeys admission.
11. Run one exact-SHA Golden Journeys canary and protected P1–P3.
12. Prove one QA validation deployment and no additional product deployment caused by that admission.
13. Keep cumulative product PR #27 parked until the controller canary and daily health both pass.

Cutover proof required before declaring the repair done:

- Count validation-project deployments before and after one admitted candidate: exactly one new READY deployment for that SHA.
- Push an ordinary source-repository feature branch: zero new validation-project deployments.
- Confirm the stable alias still serves the admitted SHA and the deployed QA contract headers.
- Confirm product-project deploy count did not increase because of the QA admission.

Exact rollback:

1. Disable the corrected Golden Journeys workflow.
2. Stop using `QA_VERCEL_TOKEN` in the protected lane.
3. Reassign the preserved stable alias to the prior READY non-production deployment id recorded in sanitized provider evidence.
4. Only after a reviewed rollback decision, restore any prior temporary Git connection if explicitly required. Do not reconnect automatic Git as an unreviewed shortcut.

The prepared Deploy Hook `qa-protected-candidate` is not the selected cutover path. Hooks still require Git connection and do not by themselves stop duplicate automatic builds.

Live cutover and rollback evidence for Gate 2 is recorded in `docs/operations/qa-explicit-deploy-gate2-packet.md`. Do not request `PUBLISH_APPROVED` until that packet’s evidence table is filled after independent review and green required checks.

## Concurrency and supersession

This lane deliberately uses GitHub's latest-pending supersession with `cancel-in-progress: false`. One mutation run remains protected from cancellation, and at most one latest candidate waits. If A is running, B is pending and C arrives, C supersedes B; the superseded B remains blocked because it receives no successful P1–P3 check. C runs after A. If B is still intended, a rebase or push gives it a new exact candidate SHA and automatically re-enters it. The single concurrency group prevents any two candidates from deploying or seeding simultaneously.

Phase C2 must prove A running, B pending, C supersedes B, B remains blocked, C runs after A, and a refreshed B later runs. This is the accepted high-cadence behavior, not an unlimited queue.

## Daily health

`.github/workflows/qa-daily-health.yml` runs once daily without Playwright or an LLM and can also be started manually for initial acceptance. A first `resolve-sha` job uses only the protection-bypass secret to read the expected SHA from the stable alias. The later health job uses database secrets and that alias-derived SHA; it never reads `origin/qa` and never receives `QA_VERCEL_TOKEN`. It verifies the protected site, exact deployed candidate, provider identities, live structure fingerprint, empty baseline, stale cleanup recovery and lease acquire/heartbeat/release. It never applies schema DDL. Ordinary candidates require the latest completed daily health run to have succeeded on exact current `main` within the previous 26 hours. Only an exact reviewed schema transition may recover from an old-contract daily-health deadlock, after trusted candidate admission has verified the same-repository PR, candidate SHA, green Verify run, contract digest, `schema_reviewed=true` and `qa-schema-review-v1`. This recovery only permits the candidate to continue; it does not bypass provider identity, empty-branch and lease checks, schema synchronization, post-sync fingerprint equality, P1–P3, sanitization, cleanup or final check evaluation.

The v3 structure fingerprint uses canonical PostgreSQL `C` ordering for relation and function ACL members and policy roles, plus deterministic ordering of every inventory row, including quoted and mixed-case identities. Definitions from `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_functiondef`, `pg_get_triggerdef` and `pg_get_viewdef` remain bound to the deployed PostgreSQL major version; cross-major equality is not promised. Final publication requires equality across two independent clean-room reconstructions using the trusted Node algorithm. On mismatch, daily health fails closed and reports only the expected and actual SHA-256 fingerprints for the **P1–P3 protected release smoke** diagnostic record.

## Recovery and blocked state

`qa_control.lease` stores one owner hash, run ID, candidate SHA, heartbeat/expiry, candidate structure fingerprint, exact server-side manifest and singleton snapshots. An active foreign lease cannot be recovered. An expired lease must first be claimed by a distinct recovery owner; cleanup is limited to its persisted IDs/objects and exact run labels. Unlabelled or ambiguous rows are release blockers and must not be deleted automatically.

A failed or mismatched schema synchronization writes `qa_control.schema_state.blocked_reason`. Browser fixtures are forbidden while this is set. Recovery requires an empty-branch readback, deterministic synchronization and exact fingerprint match; it is not a production rollback mechanism.

## Provider evidence boundary

`supabase/qa-branch.json` is checked-in configuration, not live provider authority. Destructive synchronization safety comes from the exact protected QA ref, explicit production refusal, matching live DB/API/Storage identities, whole-branch emptiness, no active lease, transactional application, checksums and the post-sync structure fingerprint. Persistence, parent, with-data and branch-count are independent provider readbacks required for initial acceptance and monthly review; they are not inferred from this file. Supabase management credentials must not be added to GitHub.

## Validation-project credential transfer

Connecting the parent Supabase project through the generic Vercel Marketplace integration is not approved for this lane because it proposes synchronizing production-project credentials into the validation project. The installation flow was cancelled before project connection, and no variables were synced. Phase C2 uses an app-approved 1Password-based one-time transfer in which values never enter model or tool output, followed by branch-scoped Vercel and GitHub metadata readback. Protected QA uses simulated mail and must have no real Resend key.

## Email boundary

Protected QA deployments set `QA_MAIL_MODE=allowlist`, use the designated test sender, and permit only `delivered@resend.dev` plus the run-labelled `delivered+TEST-…@resend.dev` form. The shared adapter checks sender, To, Cc and Bcc, then returns a deterministic simulated acceptance without calling Resend. Password reset and portal invitation use the same adapter and configured QA sender. Any customer, staff or production sender/recipient is denied, and protected QA sends no provider email.

## Monthly review and break glass

Monthly readback must record branch inventory, branch persistence/health, quoted compute rate, alias inventory, GitHub/Vercel protected-value names and update timestamps, last daily health, zero baseline and no production/custom routing. Never record secret values.

Only an external QA-provider outage may be proposed for break glass. A failing product test is not an outage. Any temporary required-check change requires Ivan's explicit approval, a green Verify check, targeted substitute evidence, written reason, and immediate restoration/readback. This repository contains no automatic bypass.

## 2026-08-22 credential incident

A local implementation transcript exposed values from a QA-only Vercel environment pull. No value is reproduced here. The response treated all durable QA-only values from that pull as compromised: temporary environment files were searched by filename only, the validation project's automation bypass was replaced and the prior provider entry revoked, GitHub's encrypted bypass value was replaced, Vercel Authentication was enabled for Preview deployments, QA-only Better Auth and cron secrets were regenerated, the QA Resend credential was replaced with an inert non-delivering value, and obsolete pilot branch environment entries were removed. Provider and GitHub readbacks recorded names, counts, protection status and update timestamps only. Permanent Supabase branch credentials remain a provisioning prerequisite and must be created fresh rather than copied from any prior environment.
