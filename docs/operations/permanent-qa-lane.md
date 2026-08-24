# Permanent QA lane operations

Owner: Re-New engineering
Acceptance owner: quality_tester
Business cost authority: Ivan

Status: **functional exact-candidate QA is runner-hosted.** The former Vercel deployment canary failed before it reached schema or browser work because the provider rejected it for billing. That provider condition must not block candidate functional QA. The permanent delivery and QA policy is `docs/TESTING_RELEASE_PROTOCOL.md`; this file is the technical runbook, not a second product tracker.

## Fixed resources

- Supabase: exactly one persistent Micro branch under production project `iiuqcdnmxhtyispnykgf`; no production data clone and no PR ownership.
- Vercel: the existing validation project and stable alias remain only for background deployment-health checks. They are not part of the functional candidate-QA path and a provider deployment failure cannot block that path.
- GitHub: environment `qa-pilot` (name retained), candidate check `P1-P3 protected pilot`. It is required evidence only for an exact Tier 3 candidate explicitly authorized by Ivan, not a universal branch-protection requirement. The historical `qa` git pointer is retired and must not be moved by the controller.
- No premium runner, additional project, email plan or external service is part of this lane.

## Cost

Supabase management readback on 2026-08-22 quoted Micro branch compute at USD 0.01344/hour, or USD 9.6768 for 30 days. Branch egress and storage remain usage exposure and are not assumed to be protected by Spend Cap. The branch must remain empty except during serialized synthetic journeys; monthly review must verify one non-default branch only, Micro compute, zero customer/Auth/Storage object rows and no unexplained usage.

## Candidate operation

1. A candidate remains `Tier 3 proposed — awaiting Ivan authorization` until Ivan explicitly authorizes its exact open-PR head SHA. Codex executes that authorization as a fresh owner-only manual dispatch; the run record is evidence, not a second approval. The trusted workflow rejects automatic and non-owner starts.
2. Admission validates that the supplied branch and exact 40-character SHA are the current head of a same-repository open PR and that its exact GitHub Actions `Verify` run is green. A changed head SHA requires fresh authorization. A database-changing candidate also requires its reviewed schema fields and exact contract digest.
3. The workflow checks out and builds that exact SHA once on an isolated GitHub runner. It serves it only through loopback HTTPS, using QA-only Supabase credentials and no production credentials, Vercel deployment token, public URL, or external email delivery.
4. Before schema synchronization, it uses the exact admitted candidate's verified cleanup code to recover only an expired manifest-bound QA lease; ambiguous or unmanifested residue fails closed. It then synchronizes only the QA database when required, verifies the empty baseline, acquires the QA lease, runs P1-P3 with synthetic fixtures, proves persistence and read-back, removes those fixtures, and proves the empty baseline again. The successful check is functional exact-candidate QA; it is not Vercel deployment or production proof.

Candidate SHA, branch, run ID and fixture prefix are runtime data, not rotating secrets. The workflow runs from the trusted repository and rejects non-owner dispatchers, forks, and foreign repositories. Tier 3 QA authorization does not authorize merge, production publication, or production-data mutation.

## Concurrency and supersession

This lane deliberately uses GitHub's latest-pending supersession with `cancel-in-progress: false`. One mutation run remains protected from cancellation, and at most one latest candidate waits. If A is running, B is pending and C is manually dispatched, C supersedes B; the superseded B remains blocked because it receives no successful P1-P3 check. C runs after A. If B is still intended, a rebase or push gives it a new exact candidate SHA that must be authorized and manually dispatched again. The single concurrency group prevents any two candidates from using QA data simultaneously.

This serialization behavior is part of the installed controller. It does not require recurring proof during ordinary product releases.

## Daily health

`.github/workflows/qa-daily-health.yml` is background deployment-health maintenance for the validation Vercel project. It is not candidate admission or Tier 3 product QA: it creates no candidate functional-QA run, synchronizes no schema, seeds no fixture, and runs no P1-P3 journey. A health failure is a deployment-provider fact to investigate, not a reason to block runner-hosted functional QA. It may verify the stable alias, provider identity, empty baseline, stale-cleanup recovery, and lease health without exposing values.

Functional candidate QA proves schema safety through exact versioned SQL-file checksums and the applied-file ledger, then through browser, permission, persistence/read-back, cleanup, and empty-baseline checks. It does not need a separate provider-rendered schema comparison.

## Recovery and blocked state

`qa_control.lease` records one owner, run ID, candidate SHA, heartbeat/expiry, exact server-side manifest, and singleton snapshots. An active foreign lease cannot be recovered. Before any schema synchronization, the controller uses the exact admitted candidate's verified cleanup implementation to claim an expired lease with a distinct recovery owner; cleanup is limited to its persisted IDs/objects and exact run labels. It then acquires and releases a fresh lease to prove the branch is available. Unlabelled, unmanifested or ambiguous residue is a release blocker and must not be deleted automatically.

A failed schema synchronization writes `qa_control.schema_state.blocked_reason`. Browser fixtures are forbidden while this is set. Recovery requires an empty-branch readback, transactional synchronization and an exact applied-file ledger; it is not a production rollback mechanism.

## QA evidence and credential boundary

`supabase/qa-branch.json` is checked-in configuration, not live provider authority. QA schema safety comes from the exact protected QA ref, explicit production refusal, matching live DB/API/Storage identities, whole-branch emptiness, no active lease, transactional application, SQL-file checksums, and the applied-file ledger. The runner receives only the QA credentials needed for the journey; production credentials and Vercel deployment credentials are excluded. Supabase management credentials must not be added to GitHub.

## Email boundary

Protected functional QA sets `QA_MAIL_MODE=allowlist`, uses the designated test sender, and permits only `delivered@resend.dev` plus the run-labelled `delivered+TEST-…@resend.dev` form. The shared adapter checks sender, To, Cc and Bcc, then returns a deterministic simulated acceptance without calling Resend. Password reset and portal invitation use the same adapter and configured QA sender. Any customer, staff or production sender/recipient is denied, and protected QA sends no provider email.

## Monthly review and break glass

Monthly readback must record branch inventory, branch persistence/health, quoted compute rate, GitHub protected-value names and update timestamps, last daily health, zero baseline and no production/custom routing. Never record secret values.

Only an external QA-provider outage may be proposed for break glass. A failing product test is not an outage. Any temporary required-check change requires Ivan's explicit approval, a green Verify check, targeted substitute evidence, written reason, and immediate restoration/readback. This repository contains no automatic bypass.

## 2026-08-22 credential incident

A local implementation transcript exposed values from a QA-only Vercel environment pull. No value is reproduced here. The response treated all durable QA-only values from that pull as compromised: temporary environment files were searched by filename only, the validation project's automation bypass was replaced and the prior provider entry revoked, GitHub's encrypted bypass value was replaced, Vercel Authentication was enabled for Preview deployments, QA-only Better Auth and cron secrets were regenerated, the QA Resend credential was replaced with an inert non-delivering value, and obsolete pilot branch environment entries were removed. Provider and GitHub readbacks recorded names, counts, protection status and update timestamps only. Permanent Supabase branch credentials remain a provisioning prerequisite and must be created fresh rather than copied from any prior environment.
