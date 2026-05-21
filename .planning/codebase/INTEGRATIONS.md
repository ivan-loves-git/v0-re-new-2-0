# External Integrations

**Analysis Date:** 2026-05-21

## APIs & External Services

**Database / Backend-as-a-Service:**
- Supabase - PostgreSQL data API and Storage for CRM records, auth tables, email logs, intake tracking, avatars, CVs, and opportunity documents.
  - SDK/Client: `@supabase/supabase-js`, `@supabase/ssr`
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
  - Primary clients: `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy.ts`

**Email Delivery:**
- Resend - Transactional and manual email sending, Wavy email sending, M&A source workflow emails, password reset emails, and email-event webhooks.
  - SDK/Client: `resend`
  - Auth: `RESEND_API_KEY`
  - Sender configuration: `RESEND_FROM_EMAIL`
  - Webhook signature: `RESEND_WEBHOOK_SECRET`
  - Core files: `lib/email/resend-client.ts`, `lib/email/send-email.ts`, `lib/auth.ts`, `app/api/wavy/send/route.ts`, `lib/actions/ma-workflows.ts`, `app/api/webhooks/resend/route.ts`

**AI Generation:**
- Anthropic Claude - Wavy email/WhatsApp draft generation in `app/api/wavy/generate/route.ts`.
  - SDK/Client: `@anthropic-ai/sdk`
  - Auth: `ANTHROPIC_API_KEY`
  - Model: `claude-sonnet-4-20250514`

**Analytics:**
- Vercel Analytics - Client-side analytics mounted globally in `app/layout.tsx`.
  - SDK/Client: `@vercel/analytics/next`
  - Auth: Vercel project configuration; no repo env var detected.

**Fonts / Hosted Assets:**
- Google Fonts via Next Font - Inter, Geist Mono, and Source Serif 4 imported in `app/layout.tsx`.
  - SDK/Client: `next/font/google`
  - Auth: none

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: `DATABASE_URL` for direct `pg` connections; `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for admin Supabase API access; `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser/cookie-aware clients.
  - Client: `pg` in `lib/auth.ts`, `lib/actions/portal-access.ts`, and `scripts/create-users-direct.ts`; `@supabase/supabase-js` in `lib/supabase/server.ts` and `lib/supabase/admin.ts`; `@supabase/ssr` in `lib/supabase/client.ts` and `lib/supabase/proxy.ts`.
  - Auth tables: `"user"`, `"session"`, `"account"`, and `"verification"` created by `scripts/better-auth-migration.sql`.
  - CRM tables: `repreneurs`, `offers`, `notes`, `activities`, `repreneur_offers`, `leadership_assessments`, `opportunities`, `opportunity_matches`, `opportunity_documents`, `ma_sources`, and related workflow tables in `scripts/*.sql`.
  - Email tables: `email_templates`, `email_logs`, `intake_abandonment_tracking`, and `email_daily_counts` in `scripts/013_create_email_tables.sql`.

**File Storage:**
- Supabase Storage
  - `cvs` bucket - Public CV/LDC document storage configured by `scripts/017_setup_cv_storage.sql` and used by `app/api/upload-cv/route.ts`.
  - `avatars` bucket - Public avatar storage configured by `scripts/009_setup_avatar_storage.sql` and used by `app/api/upload-avatar/route.ts`.
  - `opportunity-documents` bucket - Private opportunity document storage configured by `scripts/045_setup_opportunity_documents_storage.sql`, uploaded/deleted by `lib/actions/opportunity-documents.ts`, and served through signed URLs in `app/portal/deals/[matchId]/documents/[documentId]/route.ts` and `app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts`.
  - Supabase-hosted images are allowed in Next Image config by `next.config.mjs`.

**Caching:**
- Better Auth cookie cache - Enabled for 5 minutes in `lib/auth.ts`.
- Next.js route/cache invalidation - `revalidatePath` is used after mutations in files such as `app/api/upload-avatar/route.ts` and `lib/actions/ma-workflows.ts`.
- External cache service: Not detected.

## Authentication & Identity

**Auth Provider:**
- Better Auth - Custom app authentication using email/password and Supabase PostgreSQL persistence.
  - Implementation: `betterAuth()` configured in `lib/auth.ts`, mounted through `toNextJsHandler(auth)` in `app/api/auth/[...all]/route.ts`, and consumed by `lib/auth-client.ts` and `lib/auth-server.ts`.
  - Database: direct `pg` `Pool` using `DATABASE_URL` with SSL in `lib/auth.ts`.
  - Session: 7-day sessions, 24-hour update age, 5-minute cookie cache in `lib/auth.ts`.
  - Cookies: secure cookies enabled in production by `lib/auth.ts`; `proxy.ts` checks both `__Secure-better-auth.session_token` and `better-auth.session_token`.
  - Password reset: Better Auth `sendResetPassword` sends via Resend in `lib/auth.ts`.
  - User creation: `app/api/auth/create-users/route.ts`, `scripts/create-better-auth-users.ts`, and `scripts/create-users-direct.ts`.
  - Portal authorization: role and repreneur linkage use `app_user_roles` via `lib/access-control.ts` and `lib/actions/portal-access.ts`.

**Supabase Auth:**
- Supabase Auth is not the app auth provider. `lib/supabase/proxy.ts` contains a Supabase SSR user check, but current route protection is handled primarily by Better Auth cookies in `proxy.ts` and session validation in `lib/auth-server.ts`.

## Monitoring & Observability

**Error Tracking:**
- Dedicated error tracking service: Not detected.

**Logs:**
- Console logging in route handlers and Server Actions, including auth email delivery in `lib/auth.ts`, webhook processing in `app/api/webhooks/resend/route.ts`, storage upload errors in `app/api/upload-cv/route.ts` and `app/api/upload-avatar/route.ts`, and cron execution in `app/api/cron/abandoned-forms/route.ts`.
- Email delivery observability is stored in Supabase `email_logs` through `lib/email/send-email.ts` and updated by `app/api/webhooks/resend/route.ts`.
- Vercel Analytics records frontend usage through `app/layout.tsx`.

## CI/CD & Deployment

**Hosting:**
- Vercel - App deployment target, production domain metadata, and scheduled cron support.
  - Config: `vercel.json`
  - Cron: `/api/cron/abandoned-forms`
  - Runtime metadata: `next.config.mjs` injects git-derived `NEXT_PUBLIC_BUILD_NUMBER` and `NEXT_PUBLIC_BUILD_HASH`.

**CI Pipeline:**
- GitHub/Vercel auto-deploy is referenced in `AGENTS.md`; no GitHub Actions workflow directory was detected in the files explored for this tech map.
- Local verification commands are defined in `package.json`: `npm run build`, `npm run lint`, `npm run test`, and `npm run test:coverage`.

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL for browser and server clients.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key for browser and SSR clients.
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only Supabase admin/service-role access.
- `DATABASE_URL` - PostgreSQL connection string for Better Auth and direct `pg` operations.
- `BETTER_AUTH_SECRET` - Better Auth secret and admin bootstrap route secret.
- `BETTER_AUTH_URL` - Better Auth base URL and trusted origin.
- `RESEND_API_KEY` - Resend email sending.
- `RESEND_FROM_EMAIL` - Default verified sender address for email sends.
- `RESEND_WEBHOOK_SECRET` - HMAC secret for Resend webhook signature verification.
- `ANTHROPIC_API_KEY` - Wavy AI generation.
- `CRON_SECRET` - Bearer token for Vercel cron authentication.

**Optional / feature env vars:**
- `CC_ON_INTERVIEW_REMINDER` - BCC recipient for interview and booking reminders in `app/api/cron/abandoned-forms/route.ts`.
- `NEXT_PUBLIC_SHOW_TEST_AUTOFILL` - Intake autofill controls in `lib/config/intake-test-data.ts`.
- `NEXT_PUBLIC_DUAL_SCORING`, `NEXT_PUBLIC_INTAKE_V2`, `NEXT_PUBLIC_SHOW_SCORE_BREAKDOWN` - Feature flags in `lib/config/feature-flags.ts`.
- `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`, `VERCEL_ENV`, `NODE_ENV` - Runtime URL/environment behavior in `components/wavy/wavy-suggests-widget.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, and `lib/auth.ts`.
- `OPENAI_API_KEY` - Optional env var validated in `lib/env.ts`; no active OpenAI client usage was detected in the explored app code.
- Additional AI provider variables are listed in `.env.example`, but active code usage was not detected outside the template.

**Secrets location:**
- `.env.local` is present for local secrets and was not read.
- `.env.example` and `.env.test.local.example` document required variable names with placeholders.
- Production secrets live in Vercel project environment configuration.

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/resend` - Resend webhook endpoint in `app/api/webhooks/resend/route.ts`; verifies `resend-signature` with `RESEND_WEBHOOK_SECRET`, maps Resend events to internal statuses, and updates `email_logs`.
- `GET /api/webhooks/resend` - Health/verification endpoint in `app/api/webhooks/resend/route.ts`.
- `GET /api/cron/abandoned-forms` - Vercel Cron endpoint in `app/api/cron/abandoned-forms/route.ts`; sends abandoned-form reminders, interview reminders, booking reminders, and shifts stale leads. Auth accepts `CRON_SECRET` bearer token or Vercel cron user-agent.
- `POST /api/auth/*` and `GET /api/auth/*` - Better Auth callbacks and session routes mounted by `app/api/auth/[...all]/route.ts`.
- `POST /api/upload-cv` and `DELETE /api/upload-cv` - Supabase Storage CV/LDC upload and delete endpoint in `app/api/upload-cv/route.ts`.
- `POST /api/upload-avatar` - Supabase Storage avatar upload endpoint in `app/api/upload-avatar/route.ts`.
- `GET /portal/deals/[matchId]/documents/[documentId]` - Signed Supabase Storage document access in `app/portal/deals/[matchId]/documents/[documentId]/route.ts`.
- `GET /app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]` - Dashboard preview signed document access in `app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route.ts`.

**Outgoing:**
- Resend `emails.send` calls from `lib/email/send-email.ts`, `lib/auth.ts`, `app/api/wavy/send/route.ts`, `lib/actions/ma-workflows.ts`, and scripts such as `scripts/send-roadmap-email.ts`, `scripts/send-team-update.ts`, `scripts/send-quick-memo.ts`, `scripts/send-password-reminder.ts`, and `scripts/send-welcome-email.ts`.
- Anthropic `messages.create` calls from `app/api/wavy/generate/route.ts`.
- Supabase database and storage requests from `lib/actions/*.ts`, `app/api/*.ts`, `app/portal/**/*.ts`, and scripts under `scripts/`.
- Better Auth API calls from `lib/auth-client.ts` and user bootstrap scripts such as `scripts/create-better-auth-users.ts`.

---

*Integration audit: 2026-05-21*
