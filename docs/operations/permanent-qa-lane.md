# Permanent QA lane operations

Owner: Re-New engineering
Acceptance owner: quality_tester
Business cost authority: Ivan

## Fixed resources

- Supabase: exactly one persistent Micro branch under production project `iiuqcdnmxhtyispnykgf`; no production data clone and no PR ownership.
- Vercel: existing protected project `renew-overnight-validation-20260820`, Preview target, stable protected `qa` branch alias, no production/custom domain.
- GitHub: environment `qa-pilot` (name retained), permanent pointer branch `qa`, required check `P1-P3 protected pilot`.
- No premium runner, additional project, email plan or external service is part of this lane.

## Cost

Supabase management readback on 2026-08-22 quoted Micro branch compute at USD 0.01344/hour, or USD 9.6768 for 30 days. Branch egress and storage remain usage exposure and are not assumed to be protected by Spend Cap. The branch must remain empty except during serialized synthetic journeys; monthly review must verify one non-default branch only, Micro compute, zero customer/Auth/Storage object rows and no unexplained usage.

## Candidate operation

1. A trusted workflow validates that the supplied branch and exact 40-character SHA are the current head of a same-repository branch.
2. The workflow creates `P1-P3 protected pilot` on that exact SHA, holds global concurrency `renew-permanent-qa`, and moves only the remote `qa` pointer with an exact force-with-lease.
3. It waits for Vercel's Preview deployment of that SHA, then verifies the stable alias, project, target, protection and deployed non-secret QA contract.
4. The schema prerequisite verifies artifact checksums and the live catalog fingerprint. Matching candidates perform no DDL. Mismatches may synchronize only an empty, non-production branch with no active lease and must match the candidate fingerprint afterward.
5. The browser job acquires the database lease, safely recovers only expired manifest-owned residue, runs P1–P3, performs exact-ID plus run-label cleanup, verifies zero residue, and releases the lease.
6. The check is completed on the candidate SHA. A failed schema, journey, cleanup or release remains a failed required check.

Candidate SHA, branch, run ID, fixture prefix and stable QA origin are runtime data, not rotating secrets. The workflow runs from the trusted repository and rejects forks/foreign repositories.

## Daily health

`.github/workflows/qa-daily-health.yml` runs once daily without Playwright or an LLM and can also be started manually for initial acceptance. It verifies the protected site, exact deployed candidate, provider identities, live structure fingerprint, empty baseline, stale cleanup recovery and lease acquire/heartbeat/release. It never applies schema DDL. The release lane refuses to start unless the latest completed daily health run succeeded within the previous 26 hours.

## Recovery and blocked state

`qa_control.lease` stores one owner hash, run ID, candidate SHA, heartbeat/expiry, candidate structure fingerprint, exact server-side manifest and singleton snapshots. An active foreign lease cannot be recovered. An expired lease must first be claimed by a distinct recovery owner; cleanup is limited to its persisted IDs/objects and exact run labels. Unlabelled or ambiguous rows are release blockers and must not be deleted automatically.

A failed or mismatched schema synchronization writes `qa_control.schema_state.blocked_reason`. Browser fixtures are forbidden while this is set. Recovery requires an empty-branch readback, deterministic synchronization and exact fingerprint match; it is not a production rollback mechanism.

## Email boundary

Protected QA deployments set `QA_MAIL_MODE=allowlist`, use the designated test sender, and permit only `delivered@resend.dev` plus the run-labelled `delivered+TEST-…@resend.dev` form. The shared adapter checks sender, To, Cc and Bcc, then returns a deterministic simulated acceptance without calling Resend. Password reset and portal invitation use the same adapter and configured QA sender. Any customer, staff or production sender/recipient is denied, and protected QA sends no provider email.

## Monthly review and break glass

Monthly readback must record branch inventory, branch persistence/health, quoted compute rate, alias inventory, GitHub/Vercel protected-value names and update timestamps, last daily health, zero baseline and no production/custom routing. Never record secret values.

Only an external QA-provider outage may be proposed for break glass. A failing product test is not an outage. Any temporary required-check change requires Ivan's explicit approval, a green Verify check, targeted substitute evidence, written reason, and immediate restoration/readback. This repository contains no automatic bypass.

## 2026-08-22 credential incident

A local implementation transcript exposed values from a QA-only Vercel environment pull. No value is reproduced here. The response treated all durable QA-only values from that pull as compromised: temporary environment files were searched by filename only, the validation project's automation bypass was replaced and the prior provider entry revoked, GitHub's encrypted bypass value was replaced, Vercel Authentication was enabled for Preview deployments, QA-only Better Auth and cron secrets were regenerated, the QA Resend credential was replaced with an inert non-delivering value, and obsolete pilot branch environment entries were removed. Provider and GitHub readbacks recorded names, counts, protection status and update timestamps only. Permanent Supabase branch credentials remain a provisioning prerequisite and must be created fresh rather than copied from any prior environment.
