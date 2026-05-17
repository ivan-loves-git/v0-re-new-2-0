# Summary 02-03: Staff Dashboard and Repreneur Portal Split

## Completed

- Added `/portal/deals` and `/portal/deals/[matchId]` for external repreneur deal access.
- Added `/portal/profile` with a read-only profile summary: WHO/WHEN scores, journey progress, strengths, improvement points, target thesis, and visible milestones.
- Added a dedicated portal layout without the staff sidebar.
- Redirected legacy `/my-opportunities` routes away from the old mixed dashboard page.
- Removed `My Deals` from the internal staff sidebar.
- Added `/routing` so post-login navigation can send staff to `/dashboard` and repreneurs to `/portal/deals`.
- Added staff access guard to the internal dashboard layout.
- Added additive `app_user_roles` role table and seeded known staff accounts.

## Verification

- Applied `scripts/047_create_app_user_roles.sql` to the approved Supabase project.
- Confirmed staff login routing:
  - `/routing` redirects to `/dashboard`.
  - `/dashboard` loads.
  - `/my-opportunities` redirects to `/dashboard` for staff users.
- Confirmed legacy `/my-opportunities` no longer renders the old mixed dashboard page.
- Confirmed unauthenticated `/portal/deals` redirects to `/auth/login`.
- Ran TypeScript check; the repository still has known baseline failures in archived/older files.
- Filtered TypeScript output showed no errors in the new portal/access files.
- Lint could not run because `eslint` is not installed in the project.

## Notes

- Staff URLs were not migrated to `/staff/*` in this pass. The internal dashboard remains on the existing URLs to avoid unnecessary route churn.
- The repreneur profile is intentionally read-only for June and does not open advanced profile editing/self-service.
- Future third-party onboarding should create explicit `app_user_roles` rows rather than relying only on email/profile inference.

## Executive Summary

The product now has two surfaces: an internal staff dashboard and an external repreneur portal. Repreneurs no longer need to enter the staff dashboard shell to see their deals or profile.

This keeps the June flow tighter and safer. We can now build interest/reject actions inside the external portal instead of attaching them to the wrong dashboard experience.
