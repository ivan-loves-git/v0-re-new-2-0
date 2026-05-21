<!-- refreshed: 2026-05-21 -->
# Architecture

**Analysis Date:** 2026-05-21

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                   Next.js App Router                         │
├──────────────────┬──────────────────┬───────────────────────┤
│ Staff dashboard  │ Repreneur portal │ Public flows / tools   │
│ `app/(dashboard)`│ `app/portal`     │ `app/intake-v2`        │
│                  │                  │ `app/assessment`       │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│        Server Components, Server Actions, API Routes         │
│ `app/**/page.tsx`, `lib/actions/*`, `app/api/**/route.ts`   │
└────────┬──────────────────┬─────────────────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Auth / Authorization │ Domain Types + Rules │ UI Components │
│ `lib/auth.ts`        │ `lib/types/*`        │ `components/*`│
│ `lib/access-control.ts` `lib/utils/*`                      │
└────────┬──────────────────┬─────────────────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│          Supabase PostgreSQL + Storage + External APIs       │
│ `lib/supabase/*`, `scripts/*.sql`, `supabase/migrations/*`  │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root application shell | Global metadata, fonts, toast host, Vercel analytics, global CSS | `app/layout.tsx` |
| Edge proxy | Cookie-level auth gate, protected route redirects, `/my-opportunities` redirect | `proxy.ts` |
| Staff dashboard shell | Staff-only role gate, sidebar state, staff navigation chrome | `app/(dashboard)/layout.tsx` |
| Portal shell | Repreneur-only role gate and portal navigation chrome | `app/portal/layout.tsx` |
| Role router | Post-login destination by role | `app/routing/page.tsx`, `lib/access-control.ts` |
| Better Auth server | Email/password auth, sessions, trusted origins, PostgreSQL pool | `lib/auth.ts` |
| Better Auth API | Mounts Better Auth handlers under `/api/auth/*` | `app/api/auth/[...all]/route.ts` |
| Server auth helpers | Session lookup for Server Components, Server Actions, API routes | `lib/auth-server.ts` |
| Access control | Staff/repreneur/unassigned role resolution from `app_user_roles` and `repreneurs` | `lib/access-control.ts` |
| Supabase clients | Browser, server, admin, and Supabase-session proxy clients | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts` |
| Server actions | Mutations, validation, cache revalidation, redirects | `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`, `lib/actions/intake-v2.ts` |
| API routes | JSON endpoints, uploads, cron, webhooks, AI generation | `app/api/**/route.ts` |
| Domain types | Application-level records, enums, insert/update shapes | `lib/types/repreneur.ts`, `lib/types/opportunity.ts`, `lib/types/offer.ts`, `lib/types/email.ts` |
| Domain rules | Scoring, journey derivation, parsing, match scoring | `lib/utils/scoring-v2.ts`, `lib/utils/journey-derivation.ts`, `lib/utils/opportunity-match-scoring.ts` |
| Feature components | Route-specific UI surfaces | `components/repreneurs/*`, `components/opportunities/*`, `components/offers/*`, `components/dashboard/*` |
| Design system components | shadcn/Radix primitives and local UI primitives | `components/ui/*` |

## Pattern Overview

**Overall:** Next.js App Router with Server Component data loading, Server Actions for mutations, API routes for integration boundaries, and Supabase as the persistence layer.

**Key Characteristics:**
- Use `app/**/page.tsx` files as route entry points and keep reusable UI in `components/**`.
- Use `lib/actions/**` for form and button mutations that need auth, Supabase writes, `revalidatePath`, or `redirect`.
- Use `app/api/**/route.ts` for browser fetch endpoints, uploads, webhooks, cron, auth handlers, and AI calls.
- Use Better Auth for application identity and Supabase service-role clients for database access.
- Keep business vocabulary in `lib/types/**`, `lib/config/**`, `lib/constants/**`, and `lib/data/**`.

## Layers

**Routing Layer:**
- Purpose: Own URL structure, route-specific metadata, role shells, page-level data fetches.
- Location: `app/`
- Contains: `page.tsx`, `layout.tsx`, `route.ts`, dynamic routes such as `app/(dashboard)/repreneurs/[id]/page.tsx`.
- Depends on: `components/**`, `lib/actions/**`, `lib/supabase/**`, `lib/access-control.ts`.
- Used by: Next.js runtime.

**Authentication and Authorization Layer:**
- Purpose: Authenticate users with Better Auth and route them to staff or repreneur experiences.
- Location: `lib/auth.ts`, `lib/auth-server.ts`, `lib/auth-client.ts`, `lib/access-control.ts`, `app/api/auth/[...all]/route.ts`, `proxy.ts`.
- Contains: Better Auth config, session helpers, role lookup, route guards, client sign-in exports.
- Depends on: `better-auth`, `pg`, `next/headers`, `next/navigation`, `lib/supabase/admin.ts`.
- Used by: Dashboard and portal layouts, protected actions, protected API routes.

**Data Access Layer:**
- Purpose: Centralize Supabase clients and direct table/storage access.
- Location: `lib/supabase/`
- Contains: `createAdminClient`, `createServerClient`, browser client singleton, Supabase-session proxy helper.
- Depends on: `@supabase/supabase-js`, `@supabase/ssr`, env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Used by: Server Components, Server Actions, API routes.

**Domain Action Layer:**
- Purpose: Own mutations and business workflows.
- Location: `lib/actions/`
- Contains: Repreneur lifecycle actions, opportunity workflows, emails, analytics, portal access, intake submission, Wavy templates.
- Depends on: `lib/auth-server.ts`, `lib/supabase/admin.ts`, `lib/types/**`, `lib/utils/**`, `next/cache`, `next/navigation`.
- Used by: Client components and Server Components.

**Domain Rule Layer:**
- Purpose: Own pure or mostly pure calculations and transformations.
- Location: `lib/utils/`, `lib/config/`, `lib/constants/`, `lib/data/`, `lib/types/`.
- Contains: WHO/WHEN scoring, Tier 1/2/3 scoring, journey derivation, opportunity matching, questionnaire config, option lists, static roadmap data.
- Depends on: Mostly local types and constants.
- Used by: Actions, pages, and components.

**Presentation Layer:**
- Purpose: Render dashboard, portal, intake, analytics, forms, tables, and controls.
- Location: `components/`, `app/**/page.tsx`.
- Contains: Feature components, shadcn UI primitives, page chrome, client-side interactions.
- Depends on: `components/ui/**`, `lib/actions/**`, `lib/types/**`, `lib/config/**`, `lib/utils.ts`.
- Used by: Route entry points.

**Integration Layer:**
- Purpose: Isolate external service calls and callback endpoints.
- Location: `lib/email/`, `lib/prompts/`, `app/api/wavy/*`, `app/api/webhooks/*`, `app/api/cron/*`.
- Contains: Resend client, React Email templates, Anthropic generation route, Resend webhook handling, Vercel cron jobs.
- Depends on: `resend`, `@react-email/components`, `@anthropic-ai/sdk`, `crypto`, Supabase clients.
- Used by: Email actions, Wavy UI, cron, webhook routes.

## Data Flow

### Primary Staff Dashboard Request Path

1. The request enters `proxy.ts:3`, which checks Better Auth session cookies and redirects unauthenticated protected paths (`proxy.ts:20`).
2. Staff dashboard routes render inside `app/(dashboard)/layout.tsx:8`; the layout calls `requireStaffAccess()` before rendering navigation (`app/(dashboard)/layout.tsx:13`).
3. `requireStaffAccess()` resolves the session and role from `lib/access-control.ts:158`, using `getCurrentUserAccess()` and Supabase role lookups (`lib/access-control.ts:107`).
4. The page fetches data through Supabase or actions. Example: `app/(dashboard)/repreneurs/page.tsx:15` creates a server client and parallel-fetches `repreneurs`, `leadership_assessments`, and `activities` (`app/(dashboard)/repreneurs/page.tsx:20`).
5. The page transforms rows into view models and hands them to feature components such as `components/repreneurs/repreneurs-groups-page.tsx` (`app/(dashboard)/repreneurs/page.tsx:73`).

### Staff Mutation Path

1. A client or server form calls a Server Action in `lib/actions/*`; for example `createRepreneur()` in `lib/actions/repreneurs.ts`.
2. The action validates input, calls `requireUser()` from `lib/auth-server.ts`, then uses `createAdminClient()` from `lib/supabase/admin.ts`.
3. The action writes to Supabase tables, throws typed-enough `Error` messages for failures, then calls `revalidatePath()` for affected routes.
4. Creation flows redirect after successful writes, for example `createRepreneur()` redirects to `/repreneurs/${data.id}` in `lib/actions/repreneurs.ts`.

### Public Intake Path

1. `app/intake-v2/page.tsx` renders a client intake experience through `components/intake-v2/intake-form-v2.tsx`.
2. The client component submits to `submitIntakeV2()` in `lib/actions/intake-v2.ts:18`.
3. The action checks duplicate email, computes WHO/WHEN scores with `calculateDualScore()` (`lib/actions/intake-v2.ts:63`), inserts a `repreneurs` row (`lib/actions/intake-v2.ts:119`), and revalidates staff views (`lib/actions/intake-v2.ts:133`).
4. The action sends a welcome email asynchronously through `lib/email/*` and deliberately does not block form success on email failure (`lib/actions/intake-v2.ts:138`).

### Repreneur Portal Path

1. `/portal/*` requests pass through `proxy.ts` protected route checks.
2. `app/portal/layout.tsx` calls `requirePortalAccess()` and redirects staff users back to `/dashboard_re`.
3. Portal pages under `app/portal/deals/*` and `app/portal/profile/page.tsx` fetch role-scoped repreneur data through Supabase/action helpers.
4. Portal UI renders through `components/portal/portal-shell.tsx` and opportunity/repreneur components.

### Upload, Cron, Webhook, and AI API Path

1. Upload endpoints such as `app/api/upload-avatar/route.ts` and `app/api/upload-cv/route.ts` receive `multipart/form-data`, validate file presence/type/size, and write to Supabase Storage.
2. JSON routes such as `app/api/repreneurs/[id]/route.ts` call `getCurrentUser()` and return `NextResponse.json`.
3. Cron logic in `app/api/cron/abandoned-forms/route.ts` verifies `CRON_SECRET` bearer auth or Vercel cron user-agent, then queries Supabase and sends emails.
4. Webhook logic in `app/api/webhooks/resend/route.ts` verifies `RESEND_WEBHOOK_SECRET` signatures before updating `email_logs`.
5. Wavy generation in `app/api/wavy/generate/route.ts` checks `getCurrentUser()`, reads `ANTHROPIC_API_KEY`, optionally loads Supabase context, then calls Anthropic.

**State Management:**
- Server state lives in Supabase PostgreSQL tables and Supabase Storage buckets.
- Auth session state lives in Better Auth cookies and Better Auth database tables.
- UI state is local React state in client components such as `components/intake-v2/intake-form-v2.tsx` and `components/wavy/wavy-tool.tsx`.
- Cache freshness is handled with route-level `export const revalidate = 30` on selected pages and explicit `revalidatePath()` in Server Actions.

## Key Abstractions

**Supabase Client Factories:**
- Purpose: Separate browser, server, and service-role access.
- Examples: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`.
- Pattern: Import the narrowest client needed; use `createAdminClient()` only on the server.

**Role-Based Access Helpers:**
- Purpose: Convert Better Auth users into app roles and route users to the correct experience.
- Examples: `lib/access-control.ts`, `app/routing/page.tsx`, `app/(dashboard)/layout.tsx`, `app/portal/layout.tsx`.
- Pattern: Use `requireStaffAccess()` in staff shells, `requirePortalAccess()` in portal shells, and `requireUser()` inside protected actions.

**Server Actions as Use Cases:**
- Purpose: Encapsulate mutation workflows close to domain language.
- Examples: `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`, `lib/actions/intake-v2.ts`, `lib/actions/portal-access.ts`.
- Pattern: Validate input, require auth where needed, write through Supabase, revalidate affected routes, redirect only for navigation-changing commands.

**Domain Types and Option Constants:**
- Purpose: Keep database row shapes and UI enum options aligned.
- Examples: `lib/types/repreneur.ts`, `lib/types/opportunity.ts`, `lib/constants/sectors.ts`, `lib/config/questionnaire-v2.ts`.
- Pattern: Add new domain vocabulary to `lib/types/**` first, then import it into actions/components.

**Scoring and Journey Rules:**
- Purpose: Keep scoring and stage derivation deterministic and testable.
- Examples: `lib/utils/scoring-v2.ts`, `lib/utils/tier1-scoring.ts`, `lib/utils/tier2-scoring.ts`, `lib/utils/journey-derivation.ts`.
- Pattern: Keep calculation code in `lib/utils/**`; pages and actions call these helpers instead of duplicating scoring logic.

**Email Templates and Sender:**
- Purpose: Centralize transactional and campaign email rendering/sending.
- Examples: `lib/email/send-email.ts`, `lib/email/templates/base-layout.tsx`, `lib/email/templates/*`.
- Pattern: Use `sendEmail()` with `templateKey` and React Email components; fetch editable subject/body through `lib/actions/emails.ts` when templates are managed in-app.

## Entry Points

**Root Page:**
- Location: `app/page.tsx`
- Triggers: Browser request to `/`.
- Responsibilities: Redirect to `/routing`.

**Role Router:**
- Location: `app/routing/page.tsx`
- Triggers: Post-login redirects and root redirects for logged-in users.
- Responsibilities: Call `getPostLoginDestination()` and redirect to staff dashboard, portal, login, or logout.

**Staff Dashboard:**
- Location: `app/(dashboard)/layout.tsx`
- Triggers: Requests to staff routes such as `/dashboard_re`, `/repreneurs`, `/opportunities`, `/offers`.
- Responsibilities: Enforce staff access, render sidebar and floating navigation.

**Repreneur Portal:**
- Location: `app/portal/layout.tsx`
- Triggers: Requests to `/portal`, `/portal/deals`, `/portal/profile`.
- Responsibilities: Enforce repreneur access and render portal shell.

**Public Intake:**
- Location: `app/intake-v2/page.tsx`
- Triggers: Requests to `/intake-v2`.
- Responsibilities: Render public questionnaire and submit to `lib/actions/intake-v2.ts`.

**Assessment Flow:**
- Location: `app/assessment/[token]/page.tsx`
- Triggers: Tokenized leadership assessment links.
- Responsibilities: Render assessment form and success flow under `app/assessment/[token]/success/page.tsx`.

**Better Auth API:**
- Location: `app/api/auth/[...all]/route.ts`
- Triggers: `/api/auth/*` requests from `lib/auth-client.ts`.
- Responsibilities: Delegate GET/POST to Better Auth.

**Cron Jobs:**
- Location: `app/api/cron/abandoned-forms/route.ts`
- Triggers: Vercel cron configured in `vercel.json`.
- Responsibilities: Abandoned-form, interview-reminder, booking-reminder, and reactivation email jobs.

**Webhooks:**
- Location: `app/api/webhooks/resend/route.ts`
- Triggers: Resend callback requests.
- Responsibilities: Verify signature and update email status rows.

## Architectural Constraints

- **Threading:** Next.js runs request handlers and Server Components on the Node/serverless runtime; no explicit worker threads are used in app code.
- **Global state:** `lib/auth.ts` has a module-level PostgreSQL `Pool` singleton; `lib/supabase/client.ts` has a browser Supabase singleton.
- **Circular imports:** Not detected in the sampled route/action/type paths. Keep shared types in `lib/types/**` and pure helpers in `lib/utils/**` to avoid component/action cycles.
- **Auth model:** Better Auth is the source of identity. Supabase Auth helpers in `lib/supabase/proxy.ts` are not the primary app auth path; use `lib/auth-server.ts` and `lib/access-control.ts`.
- **RLS model:** Server-side app code commonly uses service-role Supabase clients from `lib/supabase/admin.ts` and `lib/supabase/server.ts`, so authorization must be enforced before calls.
- **Runtime secrets:** Mention env var names only. Do not log or embed raw values for `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, or `RESEND_WEBHOOK_SECRET`.
- **Build typing:** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`; do not rely on production build to catch type errors.

## Anti-Patterns

### Bypassing Access Helpers

**What happens:** Protected data access can be called directly with `createAdminClient()` or `createServerClient()` without a nearby `requireUser()`, `requireStaffAccess()`, or `requirePortalAccess()`.
**Why it's wrong:** Supabase service-role clients bypass RLS, so route and action code must enforce application authorization before data access.
**Do this instead:** Put staff route protection in `app/(dashboard)/layout.tsx`, portal route protection in `app/portal/layout.tsx`, and action/API protection with `requireUser()` from `lib/auth-server.ts` or role helpers from `lib/access-control.ts`.

### Duplicating Domain Rules in Components

**What happens:** Pages and components can accumulate local score labels, enum mappings, and status transforms, as seen in `app/(dashboard)/repreneurs/[id]/page.tsx`.
**Why it's wrong:** UI-local rule duplication makes scoring and journey behavior drift between pages.
**Do this instead:** Put reusable score, journey, status, and option rules in `lib/utils/**`, `lib/constants/**`, or `lib/config/**`, then import them into pages and components.

### Adding Business Mutations to API Routes by Default

**What happens:** A business mutation can be implemented as a JSON route even when it is only used by internal app UI.
**Why it's wrong:** It creates a second mutation style beside Server Actions and often requires duplicate auth/error/revalidation logic.
**Do this instead:** Use `lib/actions/**` for app-owned mutations and reserve `app/api/**/route.ts` for uploads, webhooks, cron, auth handlers, AI calls, and external fetch boundaries.

## Error Handling

**Strategy:** Fail fast for protected mutations and integration routes; return user-safe result objects for public form submissions; log operational details server-side.

**Patterns:**
- Server Actions throw `Error` for database failures and call `revalidatePath()` after successful writes, as in `lib/actions/repreneurs.ts` and `lib/actions/opportunities.ts`.
- Public actions return `{ success: false, error: string }` instead of throwing user-facing validation/database failures, as in `lib/actions/intake-v2.ts`.
- API routes return `NextResponse.json(..., { status })` for unauthorized, bad request, not found, and server errors, as in `app/api/repreneurs/[id]/route.ts`.
- Webhook and cron routes verify secrets/headers before database writes, as in `app/api/webhooks/resend/route.ts` and `app/api/cron/abandoned-forms/route.ts`.
- External side effects such as welcome email sending can be non-blocking when the primary database write succeeds, as in `lib/actions/intake-v2.ts`.

## Cross-Cutting Concerns

**Logging:** Use `console.log`/`console.error` in server actions and API routes. Key files include `lib/actions/intake-v2.ts`, `lib/actions/repreneurs.ts`, `lib/auth.ts`, `app/api/cron/abandoned-forms/route.ts`, and `app/api/webhooks/resend/route.ts`.

**Validation:** Validation is mostly inline per action/route. Examples include email/required-field validation in `lib/actions/repreneurs.ts`, file type/size checks in `app/api/upload-avatar/route.ts` and `app/api/upload-cv/route.ts`, and channel/template validation in `app/api/wavy/generate/route.ts`.

**Authentication:** Better Auth is configured in `lib/auth.ts`, exposed to the browser by `lib/auth-client.ts`, mounted by `app/api/auth/[...all]/route.ts`, checked on the server by `lib/auth-server.ts`, and converted into app roles by `lib/access-control.ts`.

**Authorization:** Route group layouts enforce staff/portal access; Server Actions and API routes must still call auth helpers before protected data access because service-role Supabase clients bypass RLS.

**Caching:** Route-level revalidation appears on data-heavy dashboard pages such as `app/(dashboard)/repreneurs/page.tsx`; mutations use `revalidatePath()` in `lib/actions/**`.

**Email:** `lib/email/send-email.ts` sends through Resend and logs email events; templates live in `lib/email/templates/**`; delivery callbacks update `email_logs` through `app/api/webhooks/resend/route.ts`.

**AI:** Wavy generation is isolated to `app/api/wavy/generate/route.ts` and prompt helpers in `lib/prompts/wavy-system.ts`.

---

*Architecture analysis: 2026-05-21*
