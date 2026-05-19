---
gsd_type: phase_decision
phase: "02-core-deal-workflow"
created_at: "2026-05-17"
source: "02-REVIEWS.md remediation"
---

# Phase 02 State and Access Rules

## Opportunity Match State Machine

`opportunity_matches.status` is the controlled workflow state for one repreneur against one opportunity.

| State | Meaning | Portal visibility | Primary owner |
| --- | --- | --- | --- |
| `draft` | Internal candidate match only. | Hidden. | Staff recommendation setup. |
| `shortlisted` | Staff is considering the match. | Hidden. | Staff recommendation setup. |
| `proposed` | Staff has exposed the anonymized deal. | Visible if the opportunity is active and not `staff_only`. | Staff proposal. |
| `interested` | Repreneur has said they are interested. | Visible unless another repreneur owns the active pursuit for the same opportunity. | Repreneur response, then staff review. |
| `declined` | Repreneur has said the deal is not a fit. | Visible as the recorded response while the deal remains otherwise visible. | Repreneur response. |
| `active_pursuit` | Staff has validated one repreneur as the active path. | Visible only to the active repreneur. | Staff validation. |
| `dropped` | Staff has dropped a previously active pursuit. | Hidden until staff reopens it. | Staff drop/reopen flow. |

Legal transitions for June V2:

| From | To | Trigger | Rule |
| --- | --- | --- | --- |
| `draft`, `shortlisted` | `proposed` | Staff saves a recommendation. | Only exposed when opportunity visibility allows repreneur access. |
| `proposed`, `interested`, `declined` | `interested` | Repreneur clicks interested. | Clears `reviewed_by` and `reviewed_at` so staff sees a fresh response. |
| `proposed`, `interested`, `declined` | `declined` | Repreneur clicks not a fit. | Clears `reviewed_by` and `reviewed_at` so staff sees a fresh response. |
| `interested` | `active_pursuit` | Staff validates pursuit. | Database partial unique index allows only one `active_pursuit` per opportunity. |
| `active_pursuit` | `dropped` | Staff drops pursuit. | The row is preserved; staff should not delete active pursuit history directly. |
| `dropped` | `interested` | Staff reopens pursuit. | Clears `reviewed_by` and `reviewed_at` so the reopened path returns to the review queue. |

Current intentional edge rules:

- Repreneur response actions are idempotent at the business level: clicking the same response again leaves the same final state and re-queues the latest response for staff review.
- A repreneur can change between `interested` and `declined` until staff validates an active pursuit.
- Once a match is `active_pursuit`, repreneur response actions are blocked.
- Other `interested` matches for the same opportunity stay stored while one repreneur owns `active_pursuit`, but they are hidden from those repreneurs until the active pursuit is dropped.
- `responded_at` and full response history are deferred to the next stage/timeline plan instead of being added as a rushed standalone field.

## Access Precedence

Identity resolution uses this order:

1. Authenticated user email is normalized by trimming and lowercasing.
2. `app_user_roles` is checked first, with case-insensitive email matching and `user_id` fallback.
3. `staff` roles always win over repreneur matches.
4. `repreneur` roles resolve the portal identity from `app_user_roles.repreneur_id` first, then fall back to email matching only for legacy repair compatibility.
5. A `repreneurs.email` match without an explicit `repreneur` role is not enough to enter the portal.

Conflict rule:

- If a user has a `staff` role and also matches a repreneur email, staff wins. Post-login routing sends them to `/dashboard_re`, and `/portal/*` sends them back to the staff dashboard.
- If a user has an explicit `repreneur` role linked to a repreneur record, they are routed to `/portal/deals`.
- If a user has neither a staff role nor a linked repreneur role, they are logged out rather than shown staff or portal data.

Staff portal-access rule:

- Staff manage repreneur portal access from the repreneur profile page.
- Enabling access creates or links the Better Auth user, assigns a `repreneur` role, links `app_user_roles.repreneur_id`, and sends a password setup/reset link.
- Resending access sends a fresh setup/reset link without changing the password.
- Disabling access removes the `repreneur` role and revokes active sessions for the linked user.
- Staff/admin browser checks are not evidence that the repreneur portal works. Repreneur portal releases require a separate production browser UAT with an actual repreneur login.

Legacy route rule:

- Old `/my-opportunities` URLs redirect to `/portal/deals`.
- Old `/my-opportunities/:matchId` URLs redirect to `/portal/deals/:matchId`.

## Executive Summary

Phase 02 now has one written source for the deal-match states and access precedence. This keeps later work from inventing different meanings for `interested`, `active_pursuit`, or staff/repreneur routing.

The rule is deliberately strict: staff decides when a deal becomes an active pursuit, staff controls who gets portal access, and explicit staff access wins over repreneur access.
