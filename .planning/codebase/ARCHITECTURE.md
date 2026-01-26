# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Next.js 16 Server Components + Server Actions (RSC) with Supabase backend

**Key Characteristics:**
- Server-first architecture minimizing client-side logic
- Next.js App Router with protected middleware
- Supabase (PostgreSQL + Auth + Storage) as backend
- Better Auth for session management and email/password authentication
- Server Actions for form handling and database mutations
- Component-driven UI with shadcn/ui + Radix UI
- Scoring and evaluation engines for repreneur assessment

## Layers

**Presentation Layer (UI):**
- Purpose: React components for user interfaces
- Location: `components/`
- Contains: Page components, form components, UI primitives, specialized domain components (intake-v2, repreneurs, offers, pipeline, etc.)
- Depends on: Utils, types, data, actions
- Used by: App Router pages

**Page/Route Layer:**
- Purpose: Next.js App Router pages and layouts
- Location: `app/` and `app/(dashboard)/`
- Contains: Route handlers, page components, layout components
- Depends on: Middleware, components, actions, auth
- Used by: Browser navigation

**Middleware & Auth Layer:**
- Purpose: Request/session validation and routing protection
- Location: `middleware.ts`, `lib/auth.ts`, `lib/auth-server.ts`
- Contains: Route guards, session validation, Better Auth configuration
- Depends on: Supabase, cookies
- Used by: All protected routes

**Server Actions Layer:**
- Purpose: Server-side mutations and data operations
- Location: `lib/actions/`
- Contains: Mutation handlers for repreneurs, offers, pipeline, intake forms, emails, tasks, activities
- Depends on: Supabase clients, auth, email service, scoring utilities
- Used by: Client components, forms, API routes

**Supabase/Database Layer:**
- Purpose: Persistent data storage and admin operations
- Location: `lib/supabase/`
- Contains: Server client (SSR-safe), admin client (service role), client factory
- Depends on: Supabase SDK
- Used by: Server actions, API routes, server components

**Utilities & Business Logic:**
- Purpose: Pure functions for scoring, calculations, transformations
- Location: `lib/utils/`, `lib/constants/`, `lib/data/`
- Contains: Tier 1/2/3 scoring, journey derivation, evaluation criteria, intake transformation
- Depends on: Types only
- Used by: Actions, components, server functions

**Type System:**
- Purpose: TypeScript type definitions and contracts
- Location: `lib/types/`
- Contains: Repreneur, offer, intake, scoring, email, task types
- Depends on: None (leaf node)
- Used by: Everywhere

**Configuration & Constants:**
- Purpose: Static configuration and lookup tables
- Location: `lib/config/`, `lib/constants/`
- Contains: Feature flags, questionnaire specs, tier configs, sectors, regions, investment ranges
- Depends on: None
- Used by: Throughout application

**Email & Communication:**
- Purpose: Email template rendering and sending
- Location: `lib/email/`
- Contains: Email service client (Resend), email templates (React Email), rate limiting
- Depends on: Resend SDK, types
- Used by: Server actions on key events

**I18n (Internationalization):**
- Purpose: Multi-language support (EN/FR)
- Location: `lib/i18n/`
- Contains: Translation configuration and utilities
- Depends on: None
- Used by: Components, intake form

**API Routes:**
- Purpose: HTTP endpoints for external integrations and webhooks
- Location: `app/api/`
- Contains: Authentication routes (Better Auth), upload handlers, seed data, webhooks (Resend), cron jobs
- Depends on: Supabase, Better Auth, email service
- Used by: External services, browser fetch calls

## Data Flow

**Repreneur Intake Flow:**

1. User visits public `/intake-v2` form (unauthenticated)
2. Form component (`IntakeFormV2`) collects multi-step data
3. On submission, calls `submitIntakeV2FormAction()` (server action)
4. Server action validates consent, creates repreneur record via admin client
5. Automatically calculates `tier1_score` using scoring engine
6. Records stored in `repreneurs`, `repreneur_answers`, `activities` tables
7. Optional: Sends confirmation email via Resend
8. User can convert to authenticated user or remain anonymous lead

**Authenticated Repreneur Management Flow:**

1. User logs in via `/auth/login` (Better Auth + email/password)
2. Session validated in middleware, redirected to `/dashboard`
3. Sidebar displays navigation, user can access `/repreneurs` list
4. Click repreneur → fetch from `repreneurs` table via server component
5. Edit actions trigger server actions in `lib/actions/repreneurs.ts`
6. Updates cascade: tier1_score → tier2_stars → journey_stage
7. Changes logged to `activities` table for audit trail
8. Profile page includes embedded questionnaire, notes, offers, milestones

**Scoring & Assessment:**

1. **Tier 1 (Intake):** Calculated at form submission based on Q1-Q17 answers
   - Uses `calculateTier1Score()` from `lib/utils/tier1-scoring.ts`
   - Scores read from `evaluation_criteria` table when available
   - Stored as static snapshot: `tier1_score`, `tier1_score_breakdown`

2. **Tier 2 (Competency):** Manual 6-dimension star rating post-interview
   - Dimensions: leadership, financial_acumen, communication, clarity_of_vision, coachability, commitment
   - Stored in `tier2_*` columns
   - Edited via inline UI or modal forms

3. **Tier 3 (Milestones):** Checkbox-based achievement tracking
   - 11 sequential milestones from investment_thesis to first_acquisition
   - Stored as `ms_*` boolean columns
   - Milestone count derives journey_stage: explorer → learner → ready → serial_acquirer

**Offer Pipeline Flow:**

1. Admin creates offer via `/offers/new` form
2. Server action stores in `offers` table
3. Admin navigates to repreneur profile → "Offers" tab
4. Creates junction record in `repreneur_offers` (tracks status, dates)
5. When offer accepted, can send email confirmation
6. Pipeline view shows all repreneur-offer relationships with status

**Email Communication:**

1. Event triggers in server action (e.g., intake complete, offer accepted)
2. Server action calls `sendEmail()` from `lib/email/send-email.ts`
3. Function renders React Email template component
4. Template sent via Resend API with rate limiting check
5. Email log stored in `email_logs` table with delivery metadata
6. Unsubscribe/consent tracked in repreneur record

**State Management:**

- **Server State:** Supabase PostgreSQL (source of truth)
- **Client State:** Minimal (form state during input)
- **Session State:** Better Auth cookies (httpOnly for security)
- **Cache:** Next.js `revalidatePath()` invalidates stale data after mutations
- **Real-time:** Not implemented (single-user admin tool, polling sufficient)

## Key Abstractions

**Repreneur:**
- Purpose: Core domain entity representing an entrepreneur/acquirer
- Examples: `lib/types/repreneur.ts`, `lib/actions/repreneurs.ts`, `components/repreneurs/`
- Pattern: Type-safe record with lifecycle status (lead/qualified/client/rejected), journey stage, scoring tiers

**Offer:**
- Purpose: Consulting package/service offering to repreneurs
- Examples: `lib/types/offer.ts`, `lib/actions/offers.ts`, `components/offers/`
- Pattern: Standalone offer record with many-to-many relationship to repreneurs via junction table

**IntakeFormV2:**
- Purpose: Multi-step questionnaire capturing repreneur profile
- Examples: `lib/types/intake-v2.ts`, `components/intake-v2/`
- Pattern: Stateful form component collecting contact, WHO/WHEN/NEEDS questions, consent

**ScoringEngine:**
- Purpose: Algorithmic assessment of repreneur potential
- Examples: `lib/utils/tier1-scoring.ts`, `lib/utils/tier2-scoring.ts`, `lib/data/evaluation-criteria.ts`
- Pattern: Pure functions mapping questionnaire answers to numeric scores, stored as snapshots

**Activity/Audit Log:**
- Purpose: Track all changes to repreneurs for compliance and history
- Examples: `lib/actions/activities.ts`
- Pattern: Immutable append-only log recording who changed what when

## Entry Points

**Root Page:**
- Location: `app/page.tsx`
- Triggers: Browser load of `/`
- Responsibilities: Immediate redirect to `/dashboard` (logged in) or stays on `/` (public)

**Dashboard Layout:**
- Location: `app/(dashboard)/layout.tsx`
- Triggers: First page load after login
- Responsibilities: Render sidebar navigation, session extraction from cookies, nested route rendering

**Intake Form (Public):**
- Location: `app/intake-v2/page.tsx`
- Triggers: Browser load of `/intake-v2`
- Responsibilities: Render multi-step form, collect data, submit via server action

**Repreneurs List:**
- Location: `app/(dashboard)/repreneurs/page.tsx`
- Triggers: Click "Repreneurs" in sidebar
- Responsibilities: Fetch all repreneurs, display searchable/sortable table, link to detail pages

**Repreneurs Detail:**
- Location: `app/(dashboard)/repreneurs/[id]/page.tsx`
- Triggers: Click row in repreneurs list
- Responsibilities: Fetch single repreneur with all related data, render profile with tabs (details, offers, milestones, notes)

**API Route: Better Auth:**
- Location: `app/api/auth/[...all]/route.ts`
- Triggers: Login/signup/password reset flows
- Responsibilities: Delegate to Better Auth library for session management

## Error Handling

**Strategy:** Graceful degradation with user-visible feedback

**Patterns:**

1. **Server Actions:** Wrap in try/catch, throw user-friendly errors
   ```typescript
   // Example from repreneurs.ts
   try {
     const { data, error } = await supabase.from("repreneurs").insert(...)
     if (error) throw new Error(error.message)
   } catch (e) {
     toast.error("Failed to create repreneur")
   }
   ```

2. **Components:** Use error boundaries and error.tsx layout
   - `app/(dashboard)/error.tsx` catches errors in dashboard subtree
   - Shows error UI with retry option

3. **API Routes:** Return appropriate HTTP status codes
   - 400 for validation errors
   - 401 for auth failures
   - 500 for server errors

4. **Forms:** Field-level validation with Zod + React Hook Form
   - Errors displayed inline below fields
   - Toast notifications for submission failures

## Cross-Cutting Concerns

**Logging:**
- Implementation: `console.log()` in server components/actions, visible in server logs
- Pattern: Structured logs with context (e.g., `[v0] HomePage: Redirecting to /dashboard`)
- Used for: Debugging, monitoring data flows

**Validation:**
- Implementation: Zod schemas in `lib/config/`, React Hook Form in components
- Pattern: Centralized schema definitions, server-side re-validation in actions
- Example: `questionnaire-v2.ts` defines all question validation rules

**Authentication:**
- Implementation: Better Auth + middleware cookie checks
- Pattern: Session stored in httpOnly cookies, validated on each request
- Fallback: Cookie parsing in dashboard layout for fast user info extraction

**Authorization:**
- Implementation: Middleware checks for route protection
- Pattern: Protected paths defined in `middleware.ts`, simple allow/deny
- Current: All authenticated users have same permissions (no RBAC)

**GDPR Consent:**
- Implementation: `marketing_consent` flag on repreneurs with timestamp
- Pattern: Consent required for email sends, tracked in email logs
- Enforcement: Server action checks consent before sending emails

