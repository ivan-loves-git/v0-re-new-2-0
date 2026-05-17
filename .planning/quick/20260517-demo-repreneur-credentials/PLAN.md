---
gsd_type: quick_plan
status: complete
created_at: "2026-05-17T09:18:36Z"
completed_at: "2026-05-17T09:18:36Z"
---

# Demo Repreneur Credentials and Access Guard

## Goal

Create a credible demo repreneur login for `myworkmail4@gmail.com`, make it useful for live portal testing, and close the access loophole where a deleted repreneur could keep a stale portal login role.

## Scope

- Create or reset a Better Auth login for `myworkmail4@gmail.com`.
- Link that login to one credible demo repreneur profile.
- Assign the login the `repreneur` app role.
- Attach proposed demo opportunities so `/portal/deals` is populated.
- Ensure `/portal/*` is available only to users with both a repreneur role and a linked repreneur profile.
- When staff delete a repreneur, remove their repreneur role and active sessions.

## Out Of Scope

- Full staff-side "Invite to portal" button.
- Production email invite flow.
- Repreneur self-service password management beyond the existing auth pages.

## Implementation Notes

- The demo account uses the existing same-project Supabase test setup approved by Ivan.
- The password was generated as a temporary test credential and copied to the local clipboard, not committed or saved in project files.
- Deleting a repreneur keeps the Better Auth user record for audit/history, but removes the repreneur app role and active sessions so the portal is no longer reachable.

## Verification

- Database verification must confirm one auth user, one repreneur role, one linked repreneur profile, at least three visible opportunity matches, and one completed leadership assessment.
- Browser/auth verification must confirm the demo user lands on `/portal/deals`.
- Staff users must remain routed to `/dashboard`.
- Unlinked users must not gain staff or portal access by default.

## Executive Summary

We are creating one realistic test repreneur account so Ivan can see the external portal as the right kind of user, not as staff. The demo profile is linked to the user email and has enough scores, strengths, and deal matches to make testing meaningful.

We are also tightening the access rule: being able to log in is not enough to see the repreneur portal. The user must still exist as a repreneur in the platform, so deleting a repreneur also removes their portal access.
