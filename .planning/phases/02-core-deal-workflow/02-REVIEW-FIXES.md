---
gsd_type: review_remediation
phase: "02-core-deal-workflow"
created_at: "2026-05-17"
source: "02-REVIEWS.md"
status: complete
---

# Phase 02 Review Fixes

## GSD Classification

| Review item | Decision | Reason |
| --- | --- | --- |
| Verify active-pursuit lock is a partial unique index | Done | `scripts/048_opportunity_active_pursuit_lock.sql` uses `UNIQUE (opportunity_id) WHERE status = 'active_pursuit'`. |
| Normalize repreneur and role email matching | Fixed now | Clear low-risk code fix; reduces login mismatch risk. |
| Document role precedence | Fixed now | Required by downstream routing and portal authorization. |
| Document full `opportunity_matches.status` state machine | Fixed now | Required before adding stage tracking, NDA, and document visibility. |
| Redirect legacy `/my-opportunities` URLs | Fixed now | Clear compatibility fix for old bookmarks and links. |
| Make response/recommendation tables safer on narrow screens | Fixed now | Already identified by UI review; low risk and improves usability. |
| Add pending states to staff review actions | Fixed now | Prevents unclear double-submit behavior in the staff review queue. |
| Add `responded_at` or full response audit trail | Deferred | Better handled by the next stage/timeline plan, where response history can become part of the deal activity model. |
| Draft 02-06 and 02-07 | Deferred | Still required before Phase 02 is declared complete; this pass only remediates the review findings that can be safely fixed now. |

## Code Changes Made

- `lib/access-control.ts`: uses case-insensitive email lookup for `app_user_roles` and `repreneurs`, then confirms exact normalized equality in code.
- `lib/actions/repreneur-opportunities.ts`: uses the same case-insensitive profile lookup for portal deal access.
- `middleware.ts`: redirects old `/my-opportunities` URLs to `/portal/deals` before the staff layout can intercept repreneur users.
- `app/(dashboard)/my-opportunities/page.tsx`: redirects old list URL to `/portal/deals`.
- `app/(dashboard)/my-opportunities/[matchId]/page.tsx`: redirects old detail URL to `/portal/deals/:matchId`.
- `components/opportunities/opportunity-response-review-table.tsx`: keeps staff review actions stable while a submit is pending.
- `components/opportunities/opportunity-matches-panel.tsx`: protects wide recommendation data on smaller screens.
- `components/opportunities/repreneur-opportunity-list.tsx`: improves the repreneur card metric layout on narrow screens.

## Remaining Scope

The review correctly flags that Phase 02 is not complete until the next plans cover:

- stage tracking from active pursuit through later deal stages
- NDA/document status visibility on the relevant pursuit
- a proper activity or timeline model if we want durable response history beyond the current latest-state workflow

## Executive Summary

This pass fixed the review findings that were specific, safe, and useful immediately. The most important outcome is that Phase 02 now has explicit rules for state transitions and user access, so the next deal-stage and NDA work has a stable base.

I did not add a rushed audit-trail column because that belongs in the upcoming stage/timeline work. That keeps the June scope tight while still acknowledging the missing product behavior.
