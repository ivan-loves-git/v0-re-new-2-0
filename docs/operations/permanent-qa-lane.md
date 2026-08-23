# Permanent QA lane operations

Owner: Re-New engineering
Acceptance owner: quality_tester
Business cost authority: Ivan

## Fixed resources

- Supabase: exactly one persistent Micro branch under production project `iiuqcdnmxhtyispnykgf`; no production data clone and no PR ownership.
- Vercel: existing protected project `renew-overnight-validation-20260820`, Preview target, provider-managed stable `qa` branch alias `renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app`, no production/custom domain. The manually assigned `renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app` alias is pinned and must be rejected.
- GitHub: environment `qa-pilot` (name retained), permanent pointer branch `qa`, required check `P1-P3 protected pilot`.
- No premium runner, additional project, email plan or external service is part of this lane.

## Cost

Supabase management readback on 2026-08-22 quoted Micro branch compute at USD 0.01344/hour, or USD 9.6768 for 30 days. Branch egress and storage remain usage exposure and are not assumed to be protected by Spend Cap. The branch must remain empty except during serialized synthetic journeys; monthly review must verify one non-default branch only, Micro compute, zero customer/Auth/Storage object rows and no unexplained usage.

## Candidate operation

1. A trusted `main` workflow validates that the supplied branch and exact 40-character SHA are the current head of a same-repository PR, the actor has write access, and the exact GitHub Actions `Verify` run is green.
2. Automatic `workflow_run` admission requires `supabase/qa-contract.json` and every contract-listed SQL file to be byte-identical to trusted `main`. A database-changing candidate is refused automatically. Contract publication requires an explicit `qa-schema-review-v1` `repository_dispatch` carrying the exact candidate SHA and branch, the candidate contract SHA-256 and `schema_reviewed=true`; the trusted controller verifies the contract digest and every listed SQL checksum before any check, pointer, secret or DDL action.
3. The workflow creates `P1-P3 protected pilot` on that exact SHA, holds global concurrency `renew-permanent-qa`, and moves only the remote `qa` pointer with an exact force-with-lease. Irrelevant push, failed and skipped workflow events receive unique run-ID concurrency groups so they cannot supersede daily health or a valid candidate; latest-pending supersession remains unchanged among valid PR and repository-dispatch candidates.
4. It waits for Vercel's Preview deployment of that SHA, then verifies the stable alias, project, target, protection and deployed non-secret QA contract.
5. The schema prerequisite verifies artifact checksums and the live catalog fingerprint. Matching candidates perform no DDL. Mismatches may synchronize only an empty, non-production branch with no active lease and must match the candidate fingerprint afterward.
6. The browser job acquires the database lease, safely recovers only expired manifest-owned residue, runs P1–P3, performs exact-ID plus run-label cleanup, verifies zero residue, and releases the lease.
7. The check is completed on the candidate SHA. A failed schema, journey, cleanup or release remains a failed required check.

Candidate SHA, branch, run ID, fixture prefix and stable QA origin are runtime data, not rotating secrets. The workflow runs from the trusted repository and rejects forks/foreign repositories.

## Concurrency and supersession

This lane deliberately uses GitHub's latest-pending supersession with `cancel-in-progress: false`. One mutation run remains protected from cancellation, and at most one latest candidate waits. If A is running, B is pending and C arrives, C supersedes B; the superseded B remains blocked because it receives no successful P1–P3 check. C runs after A. If B is still intended, a rebase or push gives it a new exact candidate SHA and automatically re-enters it. The single concurrency group prevents any two candidates from deploying or seeding simultaneously.

Phase C2 must prove A running, B pending, C supersedes B, B remains blocked, C runs after A, and a refreshed B later runs. This is the accepted high-cadence behavior, not an unlimited queue.

## Daily health

`.github/workflows/qa-daily-health.yml` runs once daily without Playwright or an LLM and can also be started manually for initial acceptance. It verifies the protected site, exact deployed candidate, provider identities, live structure fingerprint, empty baseline, stale cleanup recovery and lease acquire/heartbeat/release. It never applies schema DDL. Ordinary candidates require the latest completed daily health run to have succeeded on exact current `main` within the previous 26 hours. Only an exact reviewed schema transition may recover from an old-contract daily-health deadlock, after trusted candidate admission has verified the same-repository PR, candidate SHA, green Verify run, contract digest, `schema_reviewed=true` and `qa-schema-review-v1`. This recovery only permits the candidate to continue; it does not bypass provider identity, empty-branch and lease checks, schema synchronization, post-sync fingerprint equality, P1–P3, sanitization, cleanup or final check evaluation.

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
