# External Integrations

**Analysis Date:** 2026-01-26

## APIs & External Services

**Email Delivery:**
- Resend - Transactional email service
  - SDK/Client: `resend` 4.0.0
  - Auth: `RESEND_API_KEY` (environment variable)
  - Configuration: `lib/email/resend-client.ts`
  - From email: `RESEND_FROM_EMAIL` (must be verified in Resend dashboard)
  - Rate limits: 100 emails/day, 3000/month (free tier)
  - Usage: Password resets (`lib/auth.ts`), abandoned form reminders, product updates

**Analytics:**
- Vercel Analytics - Production metrics and performance monitoring
  - SDK/Client: `@vercel/analytics/next` 1.3.1
  - Implementation: `app/layout.tsx` - integrated at root level
  - Auto-tracks: page views, Core Web Vitals, user interactions
  - No configuration needed beyond package

**AI/LLM (Optional - Feature Infrastructure):**
Multiple LLM providers configured but feature flagged:
- OpenAI - `OPENAI_API_KEY` (format: sk-proj-...)
- Anthropic Claude - `ANTHROPIC_API_KEY` (format: sk-ant-api03-...)
- Perplexity - `PERPLEXITY_API_KEY` (format: pplx-...)
- Google Gemini - `GOOGLE_API_KEY`
- Mistral - `MISTRAL_API_KEY`
- xAI - `XAI_API_KEY`
- Groq - `GROQ_API_KEY`
- OpenRouter - `OPENROUTER_API_KEY`
- Azure OpenAI - `AZURE_OPENAI_API_KEY`
- Ollama (self-hosted) - `OLLAMA_API_KEY`

Note: These are prepared in env but not actively used in current feature set (checked via feature flags in `lib/config/feature-flags.ts`)

**GitHub (Optional):**
- GitHub API - For potential import/export features
  - Auth: `GITHUB_API_KEY` (format: ghp_... or github_pat_...)
  - Status: Optional, not currently integrated

## Data Storage

**Primary Database:**
- Supabase PostgreSQL
  - Connection: `DATABASE_URL` = `postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres`
  - Client SDKs:
    - `@supabase/ssr` 0.8.0 - Server-side rendering integration
    - `@supabase/supabase-js` latest - JavaScript client
    - `pg` 8.17.1 - Direct PostgreSQL driver (used by Better Auth)
  - Access methods:
    - Browser client: `lib/supabase/client.ts` (uses anonymous key + RLS)
    - Server client: `lib/supabase/server.ts` (uses anonymous key + RLS)
    - Admin client: `lib/supabase/admin.ts` (uses service role, bypasses RLS - server-only)
  - Tables: `repreneurs`, `offers`, `repreneur_offers`, `notes`, `email_logs`, `email_daily_counts`, `intake_abandonment_tracking`, and auth tables managed by Better Auth
  - Migrations: `supabase/migrations/` contains SQL schema changes

**Session & Auth Storage:**
- PostgreSQL (Supabase) via Better Auth
  - Tables: `user`, `session` (managed by better-auth)
  - Connection pool: `lib/auth.ts` creates connection pool (max 5 connections for serverless)

**File Storage:**
- Local filesystem only - No cloud storage configured
  - Avatar uploads: Stored in Vercel deployment (ephemeral)
  - Note: Files not persisted across deployments

**Caching:**
- Cookie-based session cache - Better Auth session cache (5 minute TTL)
- No Redis or distributed cache configured

## Authentication & Identity

**Auth Provider:**
- Better Auth (self-hosted) - Email/password authentication
  - Implementation: `lib/auth.ts` (server), `lib/auth-client.ts` (client/React)
  - Database: PostgreSQL (Supabase)
  - Connection: `DATABASE_URL` + `BETTER_AUTH_SECRET`
  - Auth method: Email + password (min 8 characters)
  - Users: Created manually in Supabase dashboard (no signup form for internal users)
  - Sessions: 7-day expiration, 24-hour update window
  - Password reset: Via Resend email with 1-hour expiration link
  - Cookies: Secure in production (`NODE_ENV === 'production'`)

**Integration Points:**
- `app/api/auth/[...all]/route.ts` - All Better Auth endpoints
- `app/auth/` - Login and error pages
- CORS: Trusted origins configured in `lib/auth.ts`:
  - `http://localhost:3000` (dev)
  - `https://v0-re-new-2-0.vercel.app` (production)

**User Types:**
- Internal team users (email/password)
- Public intake form respondents (unauthenticated, saved via RPC)

## Monitoring & Observability

**Error Tracking:**
- Console logging only - No error tracking service configured
- Stack traces visible in server logs and browser console

**Logs:**
- Server: `console.log()` / `console.error()` - visible in Vercel logs
- Client: Browser DevTools console
- Email service: Resend webhook events logged to `email_logs` table

**Debugging:**
- Cron job results: Response JSON from `/api/cron/` endpoints
- Email status: Tracked in `email_logs` table via Resend webhooks

## CI/CD & Deployment

**Hosting:**
- Vercel
  - Project URL: `v0-re-new-2-0.vercel.app`
  - GitHub integration: `ivan-loves-git/v0-re-new-2-0` repository
  - Deployments: Automatic on `main` branch push
  - Environment: Next.js 16 with Node.js runtime

**Cron Jobs (Vercel):**
- Defined in `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/abandoned-forms",
        "schedule": "0 9 * * *"  // Daily at 9 AM UTC
      }
    ]
  }
  ```
- Manual trigger: Curl hook available (documented in project CLAUDE.md)
- Limitations: Hobby plan allows 1 cron per day maximum

**Build Process:**
- Next.js build system (Turbopack)
- TypeScript compilation with type checking disabled in production (`next.config.mjs`)
- Git metadata embedded: Commit count and hash stored as build environment variables

## Environment Configuration

**Required env vars (enforced at startup):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `RESEND_API_KEY`

**Optional env vars:**
- All LLM provider keys (prepared but unused)
- `GITHUB_API_KEY` (prepared but unused)

**Validation:**
- `lib/env.ts` - Zod schema validates at build time
- Missing required vars cause immediate build failure with field-level errors

**Secrets location:**
- Development: `.env.local` (git-ignored)
- Production: Vercel environment variables dashboard
- Pattern: NEXT_PUBLIC_* are exposed to browser, others server-only

## Webhooks & Callbacks

**Incoming Webhooks:**
- Resend Email Events - `/api/webhooks/resend/route.ts`
  - Signature verification: HMAC-SHA256 (required)
  - Secret: `RESEND_WEBHOOK_SECRET`
  - Events tracked:
    - `email.sent` → status: "sent"
    - `email.delivered` → status: "delivered", `delivered_at` timestamp
    - `email.opened` → status: "opened", `opened_at` timestamp
    - `email.clicked` → status: "clicked", `clicked_at` timestamp
    - `email.bounced` → status: "bounced", `bounced_at` timestamp
    - `email.complained` → status: "complained"
  - Storage: Updates `email_logs` table in Supabase
  - Verification: GET endpoint responds with `{ status: "Webhook endpoint active" }`

**Cron Triggers (Internal):**
- `/api/cron/abandoned-forms` - Vercel-triggered daily at 9 AM
  - Auth: Bearer token from `CRON_SECRET`
  - Action: Finds intake forms abandoned >48 hours, sends reminder emails
  - Logs: Returns JSON with count of processed forms and errors

**Outgoing Webhooks:**
- None configured

## Data Flows

**Email Workflow:**
1. Action triggers: `sendEmail()` in `lib/email/send-email.ts`
2. Resend sends email via `resend.emails.send()`
3. Email logged to `email_logs` table with Resend ID
4. Resend webhook notifies app of delivery/open/click events
5. `/api/webhooks/resend` updates `email_logs` with event timestamps

**Abandoned Form Reminder:**
1. Daily cron `/api/cron/abandoned-forms` triggers at 9 AM
2. Queries forms inactive >48 hours in `intake_abandonment_tracking`
3. Checks `marketing_consent` (GDPR compliance)
4. Limits to 2 reminders per person
5. Sends email via Resend
6. Updates `reminder_count` and `last_reminder_at`

**Authentication Flow:**
1. User submits email/password on login page
2. Better Auth validates credentials against `user` table
3. Session stored in PostgreSQL `session` table
4. Session token in secure cookie
5. Server validates cookie on subsequent requests
6. Client can check `useSession()` hook for auth state

---

*Integration audit: 2026-01-26*
