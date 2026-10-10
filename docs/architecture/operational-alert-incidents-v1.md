# Operational alert incidents

Approved technical follow-up to [Email Operations #247](https://github.com/re-new-team/renew-governance/issues/247), 10 October 2026. Ivan requested: “Yes. Fix the whole system with good sense.” This contract covers the existing shared critical-operation alert system, including webhook failures. It does not change business sending, templates, recipients, approvals or historical email facts.

## Operator behavior

- Notify the configured operator immediately on the first observed actionable failure. The identity is environment + operation + error category. A release is diagnostic metadata, not a new incident.
- While failures continue, send at most one reminder every 24 hours. Concurrent requests, server restarts and deployments share the same durable record.
- A daily authenticated check sends one factual quiet update after at least 24 hours without another observed failure. Say “No further failures observed”, with an observation time; do not claim that the underlying defect was repaired or that an unused workflow is healthy. A later failure opens a new episode.
- Preserve the existing six actionable categories and exclusions for expected authorization, validation and business rejections. A correctly signed business webhook whose receipt has not committed gets its existing retryable response. For its first five minutes this is non-alerting provider-pending work; older missing receipts and actual database read/write failures remain alertable.
- Technical alerts remain system mail to the configured operator only, without business CC, business-history rows or analytics. Do not replay or rewrite old events, manufacture business receipts, resend customer email, or identify technical mail using untrusted subject text.

## Durability and uncertainty

Atomic database claims choose notifications before provider I/O. Freeze their technical snapshot and operator envelope with an opaque provider idempotency key. Short claims prevent simultaneous dispatch; retries use the exact same payload/key only within a conservative 23-hour window from the first attempt. After that, an unresolved attempt is recorded as uncertain and is not automatically replayed. A separately due daily status summary is a new notification, not a replay of the uncertain message.

If the incident ledger itself is unavailable, send one generic monitoring-degraded warning per UTC day through provider idempotency. Its key and body must remain identical across requests and releases. This fallback cannot prove delivery, and no failure in alerting may create a recursive alert or change the already-completed product operation.

Use the existing daily-capable Vercel plan; no paid upgrade or high-frequency scheduler. The daily route is authenticated, bounded, and exclusively processes technical incidents. Freeze quiet notices as of their observation time; cancel obsolete unattempted quiet work when a new failure arrives.

## Data, access and rollout

Add private operational tables and service-role-only RPCs with RLS and no anonymous/authenticated grants. Store only technical codes, counts, timestamps, release, opaque notification/provider IDs and the configured operator envelope needed for exact retries. Never store customer IDs, raw webhook/provider errors, business content, clicked URLs, credentials or request payloads. Retain quiet/closed incident evidence for 90 days, with bounded housekeeping; keep unresolved incident state. No previous business data is migrated, updated or deleted.

Apply the additive migration before the code release. The previous code remains compatible with the added tables. Rollback is a scoped code revert that preserves incident evidence; do not drop the ledger or revert to the flood-prone notifier as a casual rollback. Fix forward if the new notifier fails; the bounded fallback preserves a basic operator warning.

## Acceptance

Use the existing scheduler/provider and signed-webhook seams plus the service-only RPC and authenticated daily route. Verify concurrent claims in a disposable database, release-independent deduplication, daily limits, frozen retries, stale leases, uncertain outcomes, quiet/reopening races, privacy and role denial. Real failures must remain visible; first callback races must still retry and later correlate. Complete the repository checks, independent Standards/Spec review, exact-candidate CI with the new database rehearsal, migration readback and exact deployed-revision/alias proof. Verification must not send customer email or create synthetic production failures.
