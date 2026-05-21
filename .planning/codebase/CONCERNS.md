# Codebase Concerns

**Analysis Date:** 2026-05-21

## Tech Debt

**Service-role Supabase clients are the default server data layer:**
- Issue: `createServerClient()` and `createAdminClient()` both use `SUPABASE_SERVICE_ROLE_KEY`, so RLS is bypassed for server components, API routes, and server actions.
- Files: `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/actions/repreneurs.ts`, `app/api/repreneurs/[id]/route.ts`, `app/api/upload-avatar/route.ts`
- Impact: Every route/action must enforce authorization perfectly in application code. Any missed `requireStaffAccess()` or ownership check becomes full database access.
- Fix approach: Use a request-scoped user Supabase client for user-owned reads/writes, reserve `createAdminClient()` for explicit server-only jobs, and require `requireStaffAccess()` or `requirePortalAccess()` at the start of each privileged action.

**Staff-only server actions lack consistent authorization:**
- Issue: Many privileged actions use the service-role client with no auth check, while some newer modules use `requireStaffAccess()`.
- Files: `lib/actions/repreneurs.ts`, `lib/actions/emails.ts`, `lib/actions/offers.ts`, `lib/actions/pipeline.ts`
- Impact: Server actions such as `updateRepreneur()`, `updateRepreneurStatus()`, `updateRepreneurField()`, `setTier2Stars()`, `rejectRepreneur()`, `declineRepreneur()`, `saveQuestionnaire()`, `updateTier1Answer()`, `setTier2Dimensions()`, and `toggleMilestone()` can mutate CRM records without local authorization guards.
- Fix approach: Add `await requireStaffAccess()` to staff-only actions and `await requirePortalAccess()` plus ownership checks to repreneur-owned actions. Keep public intake actions isolated in `lib/actions/intake.ts`, `lib/actions/intake-v2.ts`, `lib/actions/waitlist.ts`, and token-based assessment flows.

**Dynamic column updates are too broad:**
- Issue: Generic update helpers accept caller-provided field names and write them directly into Supabase updates.
- Files: `lib/actions/repreneurs.ts`
- Impact: `updateRepreneurField()`, `updateTier1Answer()`, and `toggleMilestone()` can write unexpected columns if called with manipulated field names.
- Fix approach: Replace dynamic field strings with explicit allowlists for editable fields and milestone keys before building update objects.

**Schema management is split between ad hoc scripts and migrations:**
- Issue: Most schema changes live in numbered SQL files under `scripts/`, while `supabase/migrations/` contains only a small subset.
- Files: `scripts/002_create_offers_table.sql`, `scripts/022_add_performance_indexes.sql`, `scripts/047_create_app_user_roles.sql`, `scripts/054_repreneur_portal_access_linkage.sql`, `supabase/migrations/20241229_add_journey_stage.sql`, `supabase/migrations/20260513_add_scrapbook_upload_rpc.sql`
- Impact: New environments can miss tables, indexes, RLS policies, or functions such as `increment_email_count()` unless scripts are applied manually in the correct order.
- Fix approach: Move active schema into Supabase migrations, document applied migration state, and keep one source of truth for production schema.

**Large operational files carry multiple responsibilities:**
- Issue: Several files mix querying, transformation, business rules, rendering concerns, and mutations.
- Files: `lib/actions/repreneurs.ts`, `components/guide/development-roadmap.tsx`, `components/repreneurs/repreneur-table.tsx`, `app/(dashboard)/dashboard_re/page.tsx`, `app/api/seed/route.ts`
- Impact: Small changes have a wide blast radius and are difficult to review or test narrowly.
- Fix approach: Split by workflow: query functions, mutation actions, scoring/derivation helpers, and UI components. Keep server actions thin and delegate business rules to testable `lib/` helpers.

## Known Bugs

**Email consent override parameter is not honored:**
- Symptoms: `sendEmail()` accepts `requiresConsent?: boolean`, but the function only checks the database template's `requires_consent` setting and never reads `params.requiresConsent`.
- Files: `lib/email/send-email.ts`, `app/api/cron/abandoned-forms/route.ts`
- Trigger: Callers pass `requiresConsent: true` for a template row that is missing or has `requires_consent = false`.
- Workaround: Ensure template rows are configured correctly in `email_templates`.

**Email daily limit check and increment are separate operations:**
- Symptoms: Concurrent sends can pass `checkDailyLimit()` before either send increments the daily count.
- Files: `lib/email/send-email.ts`, `scripts/022_add_performance_indexes.sql`
- Trigger: Multiple emails are sent concurrently near `DAILY_EMAIL_LIMIT`.
- Workaround: Keep `DAILY_EMAIL_LIMIT` conservative until the limit check and increment are enforced in one database RPC.

**Search escaping does not fully isolate PostgREST `.or()` syntax:**
- Symptoms: Search escapes `%`, `_`, and backslashes, but still interpolates user input into a comma-delimited `.or()` expression.
- Files: `lib/actions/emails.ts`, `lib/access-control.ts`
- Trigger: Search or email values containing PostgREST filter delimiters or syntax characters.
- Workaround: Prefer separate safe queries or a database RPC with parameters for search/filter use cases.

## Security Considerations

**Unauthenticated scrapbook endpoints read and write shared content:**
- Risk: Any caller can overwrite the `review` clipboard row, and content is converted to HTML without escaping user-provided text.
- Files: `app/api/scrapbook/review/route.ts`, `app/api/scrapbook/review-read/route.ts`
- Current mitigation: Only empty content is rejected.
- Recommendations: Require staff auth, escape HTML before storage/rendering, or move this behind a signed internal endpoint.

**Authenticated routes often check login but not role or ownership:**
- Risk: Repreneur users can potentially reach staff-oriented endpoints/actions if they can call them directly, because several checks use `getCurrentUser()` or `requireUser()` instead of `requireStaffAccess()`.
- Files: `app/api/repreneurs/[id]/route.ts`, `app/api/upload-avatar/route.ts`, `app/api/wavy/generate/route.ts`, `app/api/wavy/send/route.ts`, `lib/actions/wavy.ts`, `lib/actions/offers.ts`, `lib/actions/opportunities.ts`, `lib/actions/opportunity-documents.ts`
- Current mitigation: Dashboard layout uses `requireStaffAccess()` in `app/(dashboard)/layout.tsx`; portal pages use portal-specific access helpers in newer modules.
- Recommendations: Put role checks in every API route and server action. For repreneur portal actions, verify `matchId`, `documentId`, or `repreneurId` belongs to the current portal user.

**Wavy send endpoint builds HTML from caller text without escaping:**
- Risk: Caller-provided message body is inserted into an HTML email template after only newline replacement.
- Files: `app/api/wavy/send/route.ts`
- Current mitigation: Requires a logged-in Better Auth user.
- Recommendations: Require staff access, escape HTML entities before paragraph wrapping, and log rejected attempts.

**Avatar upload validates file type but not record ownership:**
- Risk: Any logged-in user can submit a `repreneurId` and update that record's `avatar_url`.
- Files: `app/api/upload-avatar/route.ts`
- Current mitigation: Extension allowlist, file-size limit, and magic-byte verification are present.
- Recommendations: Require staff access for staff-managed avatar updates or verify the requested `repreneurId` belongs to the current portal user.

**Better Auth rate limiting is disabled:**
- Risk: Login and password-reset endpoints rely on external controls rather than Better Auth's built-in rate limiter.
- Files: `lib/auth.ts`
- Current mitigation: Secure cookies are enabled in production and trusted origins are configured.
- Recommendations: Enable Better Auth rate limiting and add per-path rules for sign-in and password-reset endpoints.

## Performance Bottlenecks

**Repreneurs and pipeline pages fetch full CRM datasets:**
- Problem: Staff list pages query all repreneurs and related records without pagination.
- Files: `app/(dashboard)/repreneurs/page.tsx`, `app/(dashboard)/pipeline/page.tsx`
- Cause: Queries order by `created_at` but do not use `.limit()` or `.range()`.
- Improvement path: Add server-side pagination/search parameters and pass total counts to table/board components.

**Re-New dashboard repeats broad data fetches:**
- Problem: Dashboard sections independently query all repreneurs and activities.
- Files: `app/(dashboard)/dashboard_re/page.tsx`
- Cause: `StatsAndTiersRow()`, `MiddleRow()`, and `ChartsRow()` each create their own Supabase client and query overlapping data.
- Improvement path: Fetch shared datasets once at page level or cache shared query functions with React `cache()`.

**Parallel agent worktrees are large and pollute local scans:**
- Problem: `.claude/worktrees/` is about 494 MB and contains nested copies of app, scripts, tests, and archives.
- Files: `.claude/worktrees/`, `.git/info/exclude`, `vitest.config.ts`
- Cause: Worktrees are excluded from git but still present under the repo, so broad `find` commands and naive tooling can scan duplicate code.
- Improvement path: Keep `.claude/worktrees/` pruned and ensure all codebase tooling excludes `.claude/**`, `node_modules/**`, and `_archive/**`.

## Fragile Areas

**Role-based access control is split across layout, route, and action layers:**
- Files: `app/(dashboard)/layout.tsx`, `lib/access-control.ts`, `lib/auth-server.ts`, `lib/actions/repreneurs.ts`, `app/api/*.ts`
- Why fragile: A page-level guard protects normal navigation, but direct API/server-action calls need their own guards because database clients bypass RLS.
- Safe modification: Treat `requireStaffAccess()` and `requirePortalAccess()` as mandatory entry checks for non-public server code. Add tests around rejected staff/portal/public access.
- Test coverage: No unit or integration tests cover server-action authorization boundaries.

**Email delivery prioritizes sending over auditability:**
- Files: `lib/email/send-email.ts`, `app/api/webhooks/resend/route.ts`, `scripts/013_create_email_tables.sql`
- Why fragile: If pending log insertion fails, `sendEmail()` still sends. If status updates fail, delivery can succeed without reliable tracking.
- Safe modification: For operational emails, require log creation before send or store a durable outbox record with retry semantics.
- Test coverage: Utility tests exist under `lib/utils/__tests__/`, but email sending, logging failures, and webhook status transitions are not covered by Vitest.

**Generated/database types are incomplete at query boundaries:**
- Files: `app/(dashboard)/repreneurs/page.tsx`, `app/(dashboard)/pipeline/page.tsx`, `lib/actions/opportunity-matches.ts`, `lib/actions/analytics.ts`, `scripts/e2e-tests/index.ts`
- Why fragile: `any` is used to normalize joined Supabase rows and test errors, so schema drift can surface as runtime bugs.
- Safe modification: Generate Supabase database types, add typed row-normalizer helpers, and keep `any` limited to isolated adapter boundaries.
- Test coverage: Vitest covers scoring and opportunity matching utilities, not the page-level data-shaping code that uses these casts.

## Scaling Limits

**CRM list pages scale linearly with database size:**
- Current capacity: Current pages are acceptable for small internal datasets.
- Limit: Full-table repreneur, assessment, and activity reads become slow as records grow into thousands.
- Scaling path: Add pagination, filtered views, and indexed search endpoints for `app/(dashboard)/repreneurs/page.tsx`, `app/(dashboard)/pipeline/page.tsx`, and `app/(dashboard)/dashboard_re/page.tsx`.

**Email sending has a non-transactional daily quota gate:**
- Current capacity: `DAILY_EMAIL_LIMIT` is checked in application code before send.
- Limit: Concurrent sends can exceed the configured limit because the check and increment are not atomic.
- Scaling path: Move "reserve email quota, insert pending log, send, finalize status" into an outbox/quota flow.

## Dependencies at Risk

**Unused UI dependencies remain installed:**
- Risk: Packages appear in `package.json` and `package-lock.json` with no direct imports in active `app/`, `components/`, or `lib/` source.
- Impact: Larger install surface and unnecessary security/update maintenance.
- Migration plan: Remove unused packages after a build check: `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, and `vaul`.

## Missing Critical Features

**Central authorization test suite:**
- Problem: The most important security boundary is application-level authorization, but there is no dedicated test suite for staff, repreneur, and anonymous access.
- Blocks: Safe expansion of portal features, staff APIs, and server actions that use service-role Supabase clients.

**Automated database migration verification:**
- Problem: Active schema files under `scripts/` are not validated as a single migration chain.
- Blocks: Reliable environment rebuilds and confidence that production contains required indexes, functions, and RLS policies.

## Test Coverage Gaps

**API routes and server actions:**
- What's not tested: Auth failures, role failures, ownership checks, service-role mutations, Wavy email send, avatar upload ownership, and scrapbook endpoints.
- Files: `app/api/repreneurs/[id]/route.ts`, `app/api/upload-avatar/route.ts`, `app/api/wavy/send/route.ts`, `app/api/scrapbook/review/route.ts`, `lib/actions/repreneurs.ts`, `lib/actions/emails.ts`
- Risk: Security regressions can ship while `npm run test` still passes.
- Priority: High

**Dashboard query behavior:**
- What's not tested: Pagination absence, duplicate fetches, large-list transformation, and dashboard aggregate correctness.
- Files: `app/(dashboard)/repreneurs/page.tsx`, `app/(dashboard)/pipeline/page.tsx`, `app/(dashboard)/dashboard_re/page.tsx`
- Risk: Performance and aggregate bugs appear only with production-sized data.
- Priority: Medium

**Email workflows:**
- What's not tested: Consent enforcement, daily quota behavior, log insertion failures, webhook signature handling, and webhook status transitions.
- Files: `lib/email/send-email.ts`, `app/api/cron/abandoned-forms/route.ts`, `app/api/webhooks/resend/route.ts`
- Risk: Compliance, deliverability, and reporting failures are not caught automatically.
- Priority: High

---

*Concerns audit: 2026-05-21*
