# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

### Legacy Scoring System Still in Use
- **Issue:** Old tier1-scoring and tier2-scoring systems coexist with new dual scoring (WHO/WHEN). Backwards compatibility fallbacks create code duplication and maintenance burden.
- **Files:**
  - `lib/utils/tier1-scoring.ts` (433 lines)
  - `lib/utils/tier2-scoring.ts`
  - `lib/utils/scoring-v2.ts` (423 lines)
  - `lib/types/email.ts` (marked with @deprecated)
  - `lib/actions/repreneurs.ts` (843 lines, many compatibility checks)
- **Impact:** Three scoring systems to maintain, new developers must understand all three, increased risk of score inconsistencies
- **Fix approach:** Create deprecation schedule (e.g., "remove tier1/tier2 by v1.0"), migrate all profiles to dual scoring, then delete old scoring files

### Backwards Compatibility Layers Scattered
- **Issue:** Multiple fallback patterns for JSON parsing and field compatibility throughout the codebase
- **Files:**
  - `lib/actions/repreneurs.ts` lines 30, 42, 91, 103, 824
  - `lib/actions/intake-v2.ts` line 95
- **Impact:** Complex error handling, makes data transformation logic hard to follow, increases chance of data corruption
- **Fix approach:** Consolidate all backwards compatibility into a single migration utility, run as one-time database job, then remove fallbacks

### Unused Journey Stage Column
- **Issue:** `journey_stage` column in repreneurs table added but not actively used in interface yet
- **Files:**
  - `supabase/migrations/20241229_add_journey_stage.sql`
  - `lib/actions/repreneurs.ts` (updateJourneyStage function exists but not integrated into UI)
- **Impact:** Dead code, confusion about source of truth for repreneur maturity
- **Fix approach:** Either fully integrate into dashboard/profile workflow or remove column and migration

## Known Bugs

### Missing Email Features in Intake V2
- **Issue:** Intake form submission completes but doesn't send welcome email or high-score alerts
- **Files:** `lib/actions/intake-v2.ts` lines 127-128
- **Trigger:** Submit intake-v2 form
- **Symptoms:** Repreneur created but receives no confirmation email; high-score leads never alerted
- **Workaround:** None currently. Team must manually send emails or wait for Sprint 5
- **Priority:** Medium - affects user experience and lead nurturing

### Missing "when_score" Field in Tier1 Display
- **Issue:** Top tier1 repreneur table shows only "who" score with TODO placeholder for "when"
- **Files:** `components/dashboard/top-tier1-repreneurs.tsx` line 69
- **Trigger:** View dashboard with tier1 repreneurs
- **Symptoms:** When score column always shows 0 (hardcoded), incomplete ranking
- **Fix approach:** Remove hardcoded 0, fetch actual when_score from database if available, or clarify if this dashboard is for tier1-only (legacy) ranking

## Security Considerations

### Admin Client Bypasses RLS Globally
- **Risk:** Admin client (service role key) used in many server actions without explicit authorization checks
- **Files:**
  - `lib/supabase/admin.ts`
  - Used in: `lib/actions/repreneurs.ts`, `lib/actions/intake-v2.ts`, `lib/actions/emails.ts`, `app/api/` routes
- **Current mitigation:** Better Auth session validation in middleware and server functions, CRON jobs validated with bearer token
- **Recommendation:**
  1. Add explicit user context logging when using admin client (who initiated, what data changed)
  2. Add role-based permission check before sensitive operations (e.g., delete, status change)
  3. Consider scoped Supabase roles for different actions instead of blanket admin access

### No Row-Level Security (RLS) Policies
- **Risk:** Without RLS, a compromised session token could access all data via API
- **Files:** No RLS policies found in migrations
- **Current mitigation:** Middleware and server-side session validation
- **Recommendation:** Implement Supabase RLS policies as additional safety layer:
  - Repreneurs table: Users can only see repreneurs they created (via created_by)
  - Notes table: Restrict to team members with proper role
  - Email logs: Only admins can read

### Unvalidated CRON Secret
- **Risk:** CRON job only validates bearer token, no rate limiting or CSRF protection
- **Files:** `app/api/cron/abandoned-forms/route.ts` line 15
- **Current mitigation:** Bearer token validation (process.env.CRON_SECRET)
- **Recommendation:** Add IP whitelist for Vercel CRON (hardcoded or via env), add timestamp validation to prevent replay attacks

### File Upload Without Image Dimension Validation
- **Risk:** While magic bytes are validated, no check for image dimensions (could compress large files maliciously)
- **Files:** `app/api/upload-avatar/route.ts`
- **Current mitigation:** 5MB file size limit, magic bytes verification, extension whitelist
- **Recommendation:** Add max width/height validation (e.g., reject images >5000px to prevent slowdown)

### CSV/File Import Missing
- **Issue:** Scripts exist for importing from Flatchr but no in-app UI validation for imported data
- **Files:** `scripts/` directory has migrations and import scripts
- **Risk:** Malformed import data could silently corrupt database or create duplicates
- **Fix approach:** Add import preview step showing sample rows before insert, transaction rollback on validation error

## Performance Bottlenecks

### Large Component Files Need Code Splitting
- **Problem:** UI components are very large, may cause slow client-side rendering
- **Files with high line counts:**
  - `components/guide/development-roadmap.tsx` (1023 lines)
  - `lib/actions/repreneurs.ts` (843 lines)
  - `components/ui/sidebar.tsx` (726 lines)
  - `components/repreneurs/repreneur-table.tsx` (656 lines)
  - `lib/i18n/translations.ts` (622 lines)
- **Impact:** Slower initial page load, larger JS bundles for dashboard
- **Improvement path:**
  1. Extract roadmap entries to separate data file
  2. Split repreneur-table into smaller sub-components (filters, cell renderers, modals)
  3. Use React.lazy() for modals and rarely-used components

### Potential N+1 Queries in Dashboard
- **Problem:** Dashboard fetches repreneurs, then may loop through to fetch notes/activities per repreneur
- **Files:**
  - `app/(dashboard)/dashboard/page.tsx` (multiple async functions with Promise.all)
  - `lib/actions/repreneurs.ts` (getRepreneurWithDetails, getRepreneursList)
- **Impact:** If dashboard shows 50 repreneurs and fetches activities per repreneur, that's 51 queries instead of 1 join
- **Current approach:** Uses Promise.all for parallel requests (good), but no explicit select() optimization
- **Improvement path:**
  1. Audit each Supabase query to ensure it selects only needed fields
  2. Use Supabase joins when fetching related data (activities, notes) in single query
  3. Add caching layer for frequently accessed repreneur lists

### Translation File Size
- **Problem:** `lib/i18n/translations.ts` is 622 lines, bundled on every page load
- **Files:** `lib/i18n/translations.ts`
- **Impact:** Adds ~30KB to JS bundle even for single-language users
- **Improvement path:**
  1. Move to separate JSON files per language
  2. Load language file only when selected
  3. Consider i18n library (next-intl) instead of manual object

## Fragile Areas

### Scoring Logic is Complex and Highly Coupled
- **Files:**
  - `lib/utils/scoring-v2.ts` (423 lines, hardcoded scoring matrix)
  - `lib/config/questionnaire-v2.ts` (scoring question config)
- **Why fragile:** Scoring matrix is computed but appears hardcoded, changing weights requires finding all locations, no test coverage for edge cases
- **Safe modification:**
  1. Always run full test suite before deploying (only 2 test files exist)
  2. Add integration test for each score change scenario
  3. Extract scoring weights to database table so Bertrand can adjust without code change
- **Test coverage:** Only `lib/utils/__tests__/scoring-v2.test.ts` covers this - **needs expansion**

### Email System Assumes Resend is Always Available
- **Files:**
  - `lib/email/send-email.ts` (158, 246 lines check for API key but don't have fallback)
  - `lib/email/resend-client.ts`
- **Why fragile:** No fallback to console.log or database queue if Resend fails
- **Impact:** Users don't know if email was sent; failed emails aren't retried
- **Safe modification:**
  1. Queue all emails to database first
  2. Have separate worker process retry failed emails
  3. Log all email events for debugging

### Questionnaire Form State Management
- **Files:** `components/repreneurs/questionnaire-form-v2.tsx` (521 lines, useState with complex nested object)
- **Why fragile:** Form state updated via setFormData multiple times, calculations (previewScore) depends on state. No validation before save.
- **Safe modification:**
  1. Add Zod schema validation before submission
  2. Consider React Hook Form for complex questionnaire (currently using useState)
  3. Add error boundary around scoring calculation

### Database Schema Has No Validation Constraints
- **Issue:** Most fields are nullable or TEXT type with no CHECK constraints
- **Files:** `supabase/migrations/` (only 1 migration found)
- **Impact:** Database accepts invalid data (e.g., lifecycle_status = "invalid_status"), only frontend validates
- **Risk:** Direct SQL or API client bypasses validation
- **Fix approach:**
  1. Add CHECK constraints to status columns (lifecycle_status, journey_stage)
  2. Add NOT NULL constraints to required fields
  3. Add FOREIGN KEY constraints for links to auth.users

## Test Coverage Gaps

### API Routes Not Tested
- **What's not tested:** All `/app/api/` routes lack test coverage
- **Files without tests:**
  - `app/api/upload-avatar/route.ts` - file upload validation
  - `app/api/seed/route.ts` - test data generation
  - `app/api/auth/create-users/route.ts` - user creation
  - `app/api/cron/abandoned-forms/route.ts` - email sending
  - `app/api/webhooks/resend/route.ts` - email delivery tracking
- **Risk:** Upload restrictions, CRON logic, auth flows could break unnoticed
- **Priority:** High - these are critical system paths

### Server Actions Not Tested
- **What's not tested:** `lib/actions/repreneurs.ts` (843 lines) has no test coverage
- **Files:**
  - `lib/actions/repreneurs.ts` - createRepreneur, updateRepreneur, reject, etc.
  - `lib/actions/intake-v2.ts` - form submission
  - `lib/actions/emails.ts` - email operations
  - `lib/actions/offers.ts` - offer management
- **Risk:** Data mutations, email sending, lifecycle changes could fail silently
- **Priority:** Very High - most business logic lives here

### Components Not Tested
- **What's not tested:** Repreneur table, questionnaire form, dashboard, modals
- **Files:** No .test.tsx files found in `components/`
- **Risk:** UI changes could break form submission, table filtering, navigation
- **Priority:** Medium - lower impact than business logic tests

### Integration Tests Limited
- **What exists:**
  - `lib/utils/__tests__/intake-integration.test.ts` (519 lines)
  - `lib/utils/__tests__/scoring-v2.test.ts` (735 lines)
- **What's missing:**
  - End-to-end intake flow (form submission → repreneur created → scoring → email sent)
  - Profile edit workflows
  - Offer acceptance journey
  - Data export workflows
- **Priority:** Medium

### No Error Scenario Tests
- **Missing:** Tests for:
  - Database connection failures
  - Email service failures (Resend down)
  - Invalid form submissions
  - Duplicate email submissions
  - Missing required environment variables
- **Impact:** Production errors appear as surprises
- **Fix approach:** Add error scenario test suite before going live

## Scaling Limits

### Single Cron Job for All Abandoned Forms
- **Current capacity:** Vercel Hobby plan limits to 1 cron job per day (9 AM UTC)
- **Files:** `app/api/cron/abandoned-forms/route.ts`
- **Limit:** If processing 1000+ abandoned forms, the cron must complete within timeout (unlikely at Hobby tier)
- **Scaling path:**
  1. Move to Pro plan (allows multiple crons)
  2. Or split into smaller jobs (e.g., process by cohort)
  3. Or use external job queue (Bull, Inngest)

### Supabase Storage for Avatars/CVs
- **Current:** Files stored in Supabase storage buckets
- **Files:** `app/api/upload-avatar/route.ts`, `app/api/upload-cv/route.ts`
- **Limit:** Supabase storage is cheap but no automatic scaling; Pro plan has limits on bandwidth
- **Scaling path:** At high traffic, consider CDN (Cloudflare) or S3 bucket

### Single Admin Client Connection
- **Current:** All server actions use single admin client
- **Risk:** If Supabase has rate limits, all operations share same pool
- **Scaling path:** Implement connection pooling, or split by operation type (reads vs writes)

## Dependencies at Risk

### `@supabase/supabase-js` Pinned to "latest"
- **Risk:** Means unpredictable version on deploys, could introduce breaking changes
- **Files:** `package.json` line 49
- **Impact:** Build could suddenly fail after Vercel rebuild
- **Migration plan:** Pin to specific version (e.g., "^2.45.0"), test before upgrading

### `better-auth` Version 1.4.14 (Relatively New)
- **Risk:** Auth is critical; newer libraries have more bugs
- **Files:** `package.json` line 54
- **Current mitigation:** Session validation in middleware
- **Recommendation:** Monitor GitHub issues, test auth flows after any upgrade

### Heavy Dependency on Resend (Email)
- **Risk:** If Resend has outage, users get no emails and don't know
- **Files:** `lib/email/` entire directory
- **Impact:** Lost lead nurturing, no intake confirmations
- **Contingency plan:** Add fallback to transactional email queue in database, or add SendGrid as backup

### No Monitoring or Alerting
- **Risk:** Bugs in production go unnoticed until users complain
- **Files:** No error tracking service configured
- **Recommendation:** Add Sentry or similar for error tracking

## Missing Critical Features

### No Email Retry Logic
- **Problem:** If Resend fails temporarily, email is lost (no retry, no queue)
- **Files:** `lib/email/send-email.ts` (no retry loop)
- **Blocks:** Reliable email delivery
- **Fix approach:** Add email_queue table, separate worker, exponential backoff retries

### No Data Export for Repreneurs
- **Problem:** Team needs to export repreneur data (for Flatchr migration, reporting, etc.)
- **Impact:** Manual copy-paste from UI, error-prone, non-scalable
- **Blocks:** Analysis, reporting, data portability
- **Fix approach:** Add CSV export endpoint, test with real data

### No Audit Logging
- **Problem:** No record of who changed what repreneur status/data
- **Impact:** Can't debug "why was this person marked rejected?" questions
- **Blocks:** Compliance, debugging, accountability
- **Fix approach:** Create audit_log table, log all mutations

### No Bulk Operations
- **Problem:** Updating 50 repreneur statuses requires 50 API calls
- **Impact:** Slow team workflows, manual work
- **Blocks:** Efficient team operations
- **Fix approach:** Add bulk update endpoint, validate each record before transaction

### No Custom Fields/Metadata
- **Problem:** Schema is fixed; new client data (notes, custom fields) requires schema changes
- **Impact:** New fields require developer, database migration
- **Blocks:** Flexibility for client customization
- **Fix approach:** Add repreneur.metadata JSONB column for arbitrary data

## Notes on Database Schema

### Missing Indexes
- **Issue:** No explicit indexes defined in migrations
- **Files:** `supabase/migrations/` - only 1 migration file
- **Impact:** Queries on large tables (repreneurs) could be slow
- **Fix approach:**
  1. Add index on `email` (lookups)
  2. Add index on `lifecycle_status` (filtering)
  3. Add index on `created_by` (multi-tenant queries)
  4. Add index on `created_at` (date range queries)

### Foreign Key Relationships Incomplete
- **Issue:** Migration only adds journey_stage column, no comprehensive schema migration
- **Files:** `supabase/migrations/20241229_add_journey_stage.sql`
- **Impact:** Unclear relationships between tables, cascading deletes not explicit
- **Fix approach:** Export full schema as baseline migration, version control it

## Recommendations (Priority Order)

1. **High Priority (Address before production launch):**
   - Add test coverage for all API routes and server actions
   - Implement email retry queue and worker process
   - Add RLS policies to Supabase tables
   - Set scoring weights in database (remove hardcoded matrix)
   - Implement audit logging for sensitive operations

2. **Medium Priority (Address soon after launch):**
   - Consolidate legacy scoring systems, set deprecation date
   - Add error tracking (Sentry)
   - Optimize database queries (N+1 detection)
   - Code split large components
   - Add data export feature

3. **Low Priority (Nice to have):**
   - Extract translations to separate files
   - Add connection pooling for Supabase
   - Implement custom fields via JSONB
   - Add bulk operations endpoint

---

*Concerns audit: 2026-01-26*
