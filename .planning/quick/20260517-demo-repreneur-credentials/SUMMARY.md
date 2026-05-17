---
gsd_type: quick_summary
status: complete
completed_at: "2026-05-17T09:18:36Z"
---

# Demo Repreneur Credentials and Access Guard Summary

## Completed

- Created/reset the Better Auth login for `myworkmail4@gmail.com`.
- Created/updated the linked demo repreneur profile with credible profile data, WHO/WHEN scores, Tier 2 scores, readiness milestones, and a completed demo leadership assessment.
- Assigned `myworkmail4@gmail.com` the `repreneur` app role.
- Linked three active demo opportunity matches so `/portal/deals` has realistic content.
- Updated portal routing so `/portal/*` requires both a repreneur role and a linked repreneur profile.
- Updated repreneur deletion so staff deletion removes the repreneur role and active sessions.

## Product Decision Captured

Repreneur credentials should belong to people who exist as repreneurs in the platform. If the repreneur is removed from the staff dashboard, portal access must be removed too.

## Deferred

The staff-side "Invite to portal" button should become a separate planned task. It should let staff provision access for an existing repreneur and eventually send a proper invite/reset email instead of manually seeding credentials.

## Verification

- Database check passed: one auth user, one `repreneur` role, one linked repreneur profile, three visible matches, and one completed leadership assessment.
- Temporary password was copied to the local clipboard and was not saved in repository files.
