# Codebase Structure

**Analysis Date:** 2026-05-21

## Directory Layout

```text
renew-platform/
├── app/                    # Next.js App Router routes, layouts, API routes
├── components/             # Reusable React components and shadcn UI primitives
├── hooks/                  # Shared React hooks
├── lib/                    # Server actions, auth, data clients, domain types/rules
├── public/                 # Static images, icons, logos, avatars, static HTML assets
├── scripts/                # SQL migrations, imports, one-off maintenance scripts
├── supabase/               # Supabase CLI config/migrations
├── docs/                   # Project process and communication docs
├── data/                   # Static/project data files
├── styles/                 # Additional stylesheet assets
├── .planning/              # GSD planning, phase, and codebase mapping docs
├── .codex/skills/          # Project-local Codex skills
├── _archive/               # Archived docs, legacy code, prior artifacts
├── package.json            # Scripts and dependency manifest
├── tsconfig.json           # TypeScript config and `@/*` path alias
├── next.config.mjs         # Next.js config, build metadata, redirects, upload limits
├── proxy.ts                # Next.js proxy auth gate and redirects
├── vercel.json             # Vercel cron configuration
└── components.json         # shadcn/ui configuration
```

## Directory Purposes

**`app/`:**
- Purpose: Own URL routing and request entry points.
- Contains: App Router `page.tsx`, `layout.tsx`, and `route.ts` files.
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/routing/page.tsx`, `app/(dashboard)/layout.tsx`, `app/portal/layout.tsx`, `app/api/auth/[...all]/route.ts`.

**`app/(dashboard)/`:**
- Purpose: Staff-only application surface.
- Contains: Dashboard, analytics, repreneur CRM, opportunity, offer, email, guide, account, and Wavy tool routes.
- Key files: `app/(dashboard)/repreneurs/page.tsx`, `app/(dashboard)/repreneurs/[id]/page.tsx`, `app/(dashboard)/opportunities/page.tsx`, `app/(dashboard)/opportunities/[id]/page.tsx`, `app/(dashboard)/tools/wavy/page.tsx`.

**`app/portal/`:**
- Purpose: Repreneur-facing authenticated portal.
- Contains: Portal shell, deal list/detail routes, profile route.
- Key files: `app/portal/layout.tsx`, `app/portal/page.tsx`, `app/portal/deals/page.tsx`, `app/portal/deals/[matchId]/page.tsx`, `app/portal/profile/page.tsx`.

**`app/auth/`:**
- Purpose: Authentication screens and logout route.
- Contains: Login, forgot password, reset password, error page, logout route.
- Key files: `app/auth/login/page.tsx`, `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`, `app/auth/logout/route.ts`.

**`app/intake-v2/`:**
- Purpose: Public repreneur intake questionnaire.
- Contains: Public form page, form-specific layout, success page.
- Key files: `app/intake-v2/page.tsx`, `app/intake-v2/layout.tsx`, `app/intake-v2/success/page.tsx`.

**`app/assessment/`:**
- Purpose: Tokenized leadership assessment flow.
- Contains: Assessment token layout/page and success route.
- Key files: `app/assessment/[token]/layout.tsx`, `app/assessment/[token]/page.tsx`, `app/assessment/[token]/success/page.tsx`.

**`app/api/`:**
- Purpose: HTTP boundaries that are not pure page rendering.
- Contains: Better Auth handlers, CRUD JSON endpoints, uploads, Wavy AI routes, cron, webhooks, scrapbook routes.
- Key files: `app/api/auth/[...all]/route.ts`, `app/api/repreneurs/[id]/route.ts`, `app/api/upload-avatar/route.ts`, `app/api/upload-cv/route.ts`, `app/api/cron/abandoned-forms/route.ts`, `app/api/webhooks/resend/route.ts`, `app/api/wavy/generate/route.ts`.

**`components/`:**
- Purpose: Reusable UI and feature components.
- Contains: Shared app shell, feature folders, and design system primitives.
- Key files: `components/app-sidebar.tsx`, `components/dashboard-header.tsx`, `components/repreneurs/repreneurs-groups-page.tsx`, `components/opportunities/opportunity-table.tsx`, `components/portal/portal-shell.tsx`, `components/wavy/wavy-tool.tsx`.

**`components/ui/`:**
- Purpose: shadcn/Radix UI primitives plus local design primitives.
- Contains: Buttons, cards, tables, dialogs, sidebar, badges, tabs, forms, charts, section headers.
- Key files: `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx`, `components/ui/sidebar.tsx`, `components/ui/section-page-header.tsx`, `components/ui/kpi-metric-tile.tsx`.

**`components/repreneurs/`:**
- Purpose: Repreneur list/detail/forms/scoring/journey UI.
- Contains: Tables, forms, inline editors, notes, documents, status badges, scoring cards, portal access card.
- Key files: `components/repreneurs/repreneur-table.tsx`, `components/repreneurs/repreneurs-groups-page.tsx`, `components/repreneurs/repreneur-form.tsx`, `components/repreneurs/repreneur-notes.tsx`, `components/repreneurs/tier3-milestones-card.tsx`.

**`components/opportunities/`:**
- Purpose: Opportunity/deal workflow UI.
- Contains: Opportunity tables, detail panels, import review, M&A source panels, match/pursuit/review panels.
- Key files: `components/opportunities/opportunity-table.tsx`, `components/opportunities/opportunity-detail.tsx`, `components/opportunities/opportunity-work-surface-table.tsx`, `components/opportunities/ma-source-directory.tsx`.

**`components/intake-v2/`:**
- Purpose: Public intake form UI.
- Contains: Main form, language toggle, autofill control, step components.
- Key files: `components/intake-v2/intake-form-v2.tsx`, `components/intake-v2/language-toggle.tsx`, `components/intake-v2/steps/step-contact.tsx`, `components/intake-v2/steps/step-review.tsx`.

**`components/dashboard/` and `components/analytics/`:**
- Purpose: Staff dashboards, KPI cards, charts, activity panels.
- Contains: Chart panels, stats cards, freshness panels, conversion charts.
- Key files: `components/dashboard/stats-cards.tsx`, `components/dashboard/opportunity-kpi-panel.tsx`, `components/analytics/kpi-cards.tsx`, `components/analytics/conversion-funnel.tsx`.

**`lib/`:**
- Purpose: Non-UI application logic.
- Contains: Auth config, Supabase clients, Server Actions, email, config, constants, data, prompts, types, utility functions.
- Key files: `lib/auth.ts`, `lib/auth-server.ts`, `lib/access-control.ts`, `lib/supabase/admin.ts`, `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`.

**`lib/actions/`:**
- Purpose: Server Actions and app use cases.
- Contains: Repreneur, opportunity, offer, intake, email, analytics, portal, Wavy, and workflow actions.
- Key files: `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`, `lib/actions/intake-v2.ts`, `lib/actions/offers.ts`, `lib/actions/emails.ts`, `lib/actions/portal-access.ts`, `lib/actions/wavy.ts`.

**`lib/supabase/`:**
- Purpose: Supabase client factories.
- Contains: Browser client, server service-role client, admin client, Supabase-session proxy helper.
- Key files: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`.

**`lib/types/`:**
- Purpose: TypeScript domain model definitions and enum option lists.
- Contains: Repreneur, opportunity, offer, email, intake, assessment, scoring, evaluation criteria types.
- Key files: `lib/types/repreneur.ts`, `lib/types/opportunity.ts`, `lib/types/offer.ts`, `lib/types/email.ts`, `lib/types/intake-v2.ts`.

**`lib/utils/`:**
- Purpose: Domain calculations and data transformations.
- Contains: Scoring, journey derivation, CSV export, Flatchr parsing, opportunity import/match logic.
- Key files: `lib/utils/scoring-v2.ts`, `lib/utils/journey-derivation.ts`, `lib/utils/opportunity-match-scoring.ts`, `lib/utils/opportunity-import.ts`, `lib/utils/flatchr-parser.ts`.

**`lib/email/`:**
- Purpose: Email sending and rendering.
- Contains: Resend client, sender wrapper, React Email templates.
- Key files: `lib/email/send-email.ts`, `lib/email/resend-client.ts`, `lib/email/templates/base-layout.tsx`, `lib/email/templates/welcome.tsx`, `lib/email/templates/interview-reminder.tsx`.

**`lib/config/`, `lib/constants/`, `lib/data/`:**
- Purpose: Static business configuration and option lists.
- Contains: Questionnaire configs, feature flags, assessment config, sectors, regions, roadmap/status data.
- Key files: `lib/config/questionnaire-v2.ts`, `lib/config/feature-flags.ts`, `lib/constants/sectors.ts`, `lib/constants/french-regions.ts`, `lib/data/roadmap-status.ts`.

**`hooks/`:**
- Purpose: Shared React hooks.
- Contains: Mobile breakpoint hook.
- Key files: `hooks/use-mobile.ts`.

**`public/`:**
- Purpose: Static assets served by Next.js.
- Contains: Logos, icons, avatars, team images, placeholder assets, static strategy explorer HTML.
- Key files: `public/wave-logo.png`, `public/renew-logo.png`, `public/avatars/default-1.jpg`, `public/team/bertrand.png`, `public/re-new-strategy-explorer.html`.

**`scripts/`:**
- Purpose: SQL schema scripts, imports, data maintenance, test utilities, email send scripts.
- Contains: Numbered SQL scripts, TypeScript scripts, Python import script, E2E test helpers.
- Key files: `scripts/044_create_opportunities_foundation.sql`, `scripts/047_create_app_user_roles.sql`, `scripts/054_repreneur_portal_access_linkage.sql`, `scripts/import-flatchr-v2.ts`, `scripts/send-roadmap-email.ts`.

**`supabase/`:**
- Purpose: Supabase CLI-managed migration area.
- Contains: Migration SQL files.
- Key files: `supabase/migrations/20241229_add_journey_stage.sql`, `supabase/migrations/20260513_add_scrapbook_upload_rpc.sql`.

**`.codex/skills/`:**
- Purpose: Project-local agent skills.
- Contains: Better Auth guidance and auth creation guidance.
- Key files: `.codex/skills/better-auth-best-practices/SKILL.md`, `.codex/skills/create-auth-skill/SKILL.md`.

**`_archive/`:**
- Purpose: Archived product docs, prior implementation artifacts, deprecated code, discovery work.
- Contains: Legacy docs and old component/app copies.
- Key files: `_archive/components-intake-v2/`, `_archive/intake-v2/`, `_archive/00_CANONICAL/`.

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Root route redirect to `/routing`.
- `app/routing/page.tsx`: Role-aware post-login redirect.
- `app/layout.tsx`: Root HTML shell, metadata, toast provider, analytics.
- `app/(dashboard)/layout.tsx`: Staff-only dashboard layout.
- `app/portal/layout.tsx`: Repreneur portal layout.
- `proxy.ts`: Edge-level protected-path redirect logic.
- `app/api/auth/[...all]/route.ts`: Better Auth route handler.

**Configuration:**
- `package.json`: NPM scripts and dependencies.
- `tsconfig.json`: Strict TypeScript config and `@/*` path alias to repo root.
- `next.config.mjs`: Next.js settings, build-number env injection, image remote patterns, redirects, Server Action upload size.
- `components.json`: shadcn/ui configuration.
- `eslint.config.mjs`: ESLint configuration.
- `vitest.config.ts`: Vitest configuration.
- `vercel.json`: Vercel cron configuration.
- `.env.example`: Example environment variable names.
- `.env.local`: Local environment file present; do not read or quote contents.

**Core Logic:**
- `lib/auth.ts`: Better Auth server configuration and PostgreSQL pool.
- `lib/auth-server.ts`: Server-side session helpers.
- `lib/auth-client.ts`: Browser Better Auth client exports.
- `lib/access-control.ts`: Role and route access helpers.
- `lib/supabase/admin.ts`: Service-role Supabase admin client.
- `lib/supabase/server.ts`: Server-side Supabase service-role client.
- `lib/actions/repreneurs.ts`: Repreneur mutations, notes, lifecycle/scoring updates.
- `lib/actions/opportunities.ts`: Opportunity CRUD and source upsert workflows.
- `lib/actions/intake-v2.ts`: Public intake submission, scoring, insertion, welcome email.
- `lib/email/send-email.ts`: Email send/logging wrapper.
- `lib/utils/scoring-v2.ts`: WHO/WHEN scoring.
- `lib/utils/journey-derivation.ts`: Journey stage and milestone derivation.

**Feature UI:**
- `components/app-sidebar.tsx`: Staff sidebar navigation.
- `components/floating-nav.tsx`: In-dashboard floating nav.
- `components/repreneurs/repreneurs-groups-page.tsx`: Main repreneur grouping/list surface.
- `components/opportunities/opportunity-work-surface-table.tsx`: Opportunity work-surface table.
- `components/portal/portal-shell.tsx`: Portal shell.
- `components/wavy/wavy-tool.tsx`: Wavy message-generation tool.

**API and Integrations:**
- `app/api/upload-avatar/route.ts`: Authenticated avatar upload to Supabase Storage.
- `app/api/upload-cv/route.ts`: CV/LDC document upload and delete.
- `app/api/cron/abandoned-forms/route.ts`: Scheduled reminder jobs.
- `app/api/webhooks/resend/route.ts`: Resend delivery webhook handler.
- `app/api/wavy/generate/route.ts`: Anthropic-powered Wavy generation.
- `app/api/wavy/send/route.ts`: Wavy send endpoint.

**Database and Storage Setup:**
- `scripts/002_create_offers_table.sql`: Offers table setup.
- `scripts/004_create_notes_table.sql`: Notes table setup.
- `scripts/013_create_email_tables.sql`: Email tables setup.
- `scripts/017_setup_cv_storage.sql`: CV storage setup.
- `scripts/044_create_opportunities_foundation.sql`: Opportunity foundation tables.
- `scripts/045_setup_opportunity_documents_storage.sql`: Opportunity document storage setup.
- `scripts/047_create_app_user_roles.sql`: App role table setup.
- `scripts/054_repreneur_portal_access_linkage.sql`: Portal access linkage.
- `supabase/migrations/20260513_add_scrapbook_upload_rpc.sql`: Supabase migration for scrapbook upload RPC.

**Testing:**
- `lib/utils/__tests__/scoring-v2.test.ts`: Scoring utility tests.
- `lib/utils/__tests__/intake-integration.test.ts`: Intake integration-style utility tests.
- `lib/utils/__tests__/opportunity-journey.test.ts`: Opportunity journey utility tests.
- `lib/utils/__tests__/opportunity-match-scoring.test.ts`: Opportunity match scoring tests.
- `scripts/e2e-tests/`: Scripted E2E test harness.

## Naming Conventions

**Files:**
- App Router pages/layouts/routes use framework names: `page.tsx`, `layout.tsx`, `route.ts`.
- Dynamic route folders use bracket notation: `app/(dashboard)/repreneurs/[id]/page.tsx`, `app/assessment/[token]/page.tsx`.
- React component files use kebab-case: `components/repreneurs/repreneur-table.tsx`, `components/opportunities/opportunity-detail.tsx`.
- UI primitive files use kebab-case matching component names: `components/ui/alert-dialog.tsx`, `components/ui/dropdown-menu.tsx`.
- Server Action modules use plural domain names: `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`, `lib/actions/offers.ts`.
- Type modules use singular domain names when modeling one aggregate and topic names for cross-cutting areas: `lib/types/repreneur.ts`, `lib/types/opportunity.ts`, `lib/types/email.ts`.
- SQL scripts in `scripts/` use numeric prefixes for schema sequence: `scripts/044_create_opportunities_foundation.sql`.

**Directories:**
- Route groups use parentheses for layout grouping without URL segment: `app/(dashboard)/`.
- Feature component folders are plural domain names: `components/repreneurs/`, `components/opportunities/`, `components/offers/`.
- Shared primitives live under `components/ui/`.
- Domain logic is grouped by responsibility under `lib/actions/`, `lib/types/`, `lib/utils/`, `lib/config/`, `lib/constants/`, `lib/data/`.

## Where to Add New Code

**New Staff Page:**
- Route: `app/(dashboard)/<feature>/page.tsx`
- Shared feature UI: `components/<feature>/`
- Mutations: `lib/actions/<feature>.ts`
- Types: `lib/types/<feature>.ts`
- Navigation: update `components/app-sidebar.tsx` when the page should be visible in staff nav.

**New Portal Page:**
- Route: `app/portal/<feature>/page.tsx`
- Shared portal UI: `components/portal/` or `components/<feature>/` when reusable outside the portal.
- Access control: rely on `app/portal/layout.tsx` for portal shell protection; use `requirePortalAccess()` in data-sensitive helpers when needed.

**New Public Flow:**
- Route: `app/<public-flow>/page.tsx`
- Components: `components/<public-flow>/`
- Server submission: `lib/actions/<public-flow>.ts`
- Keep public actions result-object based (`{ success, error }`) when the UI needs inline errors.

**New API Endpoint:**
- Implementation: `app/api/<resource>/route.ts` or `app/api/<resource>/[id]/route.ts`
- Auth: call `getCurrentUser()` or `requireUser()` from `lib/auth-server.ts` unless the endpoint is intentionally public or signed.
- Use API routes for uploads, webhooks, cron, auth, AI calls, and external consumers.

**New Server Mutation:**
- Implementation: `lib/actions/<domain>.ts`
- Database client: `createAdminClient()` from `lib/supabase/admin.ts` for service-role server writes.
- Cache: call `revalidatePath()` for affected dashboard/portal routes.
- Navigation: use `redirect()` only when the mutation should move the user.

**New Database Table or Column:**
- Schema script: next numbered `scripts/NNN_description.sql`
- Supabase CLI migration: `supabase/migrations/<timestamp>_<description>.sql` when applying through Supabase migrations.
- Types: update matching `lib/types/<domain>.ts`.
- Access: update `lib/actions/**` or page-level queries that select the affected fields.

**New Repreneur Feature:**
- Staff route/page: `app/(dashboard)/repreneurs/` or `app/(dashboard)/repreneurs/[id]/page.tsx`.
- Components: `components/repreneurs/`.
- Actions: `lib/actions/repreneurs.ts` or a narrowly named action module if the feature is substantial.
- Types/rules: `lib/types/repreneur.ts`, `lib/utils/journey-derivation.ts`, `lib/utils/scoring-v2.ts`.

**New Opportunity Feature:**
- Staff route/page: `app/(dashboard)/opportunities/`.
- Components: `components/opportunities/`.
- Actions: `lib/actions/opportunities.ts` or related modules such as `lib/actions/opportunity-matches.ts`.
- Types/rules: `lib/types/opportunity.ts`, `lib/utils/opportunity-match-scoring.ts`, `lib/utils/opportunity-journey.ts`.

**New Email or Wavy Workflow:**
- Email template: `lib/email/templates/<template>.tsx`.
- Email send logic: `lib/email/send-email.ts` or domain action in `lib/actions/emails.ts`.
- Wavy prompt/context: `lib/prompts/wavy-system.ts`.
- Wavy UI: `components/wavy/`.
- Wavy API boundary: `app/api/wavy/<action>/route.ts`.

**New Utility:**
- Shared pure helper: `lib/utils/<topic>.ts`.
- Shared constants/options: `lib/constants/<topic>.ts`.
- Static product data: `lib/data/<topic>.ts`.
- Add tests for complex utility behavior under `lib/utils/__tests__/`.

**New UI Primitive:**
- Prefer existing shadcn primitives under `components/ui/`.
- Add new shared primitive to `components/ui/<name>.tsx` only when multiple features will reuse it.
- Add feature-specific UI to `components/<feature>/` instead of `components/ui/`.

## Special Directories

**`.planning/`:**
- Purpose: GSD project memory, roadmap/phase artifacts, codebase maps.
- Generated: Yes, by planning/mapping workflows.
- Committed: Yes.

**`.planning/codebase/`:**
- Purpose: Current codebase maps consumed by GSD planning and execution.
- Generated: Yes.
- Committed: Yes.

**`.codex/skills/`:**
- Purpose: Project-local agent instructions.
- Generated: No.
- Committed: Yes.

**`_archive/`:**
- Purpose: Archived docs and prior implementation artifacts.
- Generated: No.
- Committed: Yes.

**`.next/`:**
- Purpose: Next.js build/dev output.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: Installed package dependencies.
- Generated: Yes.
- Committed: No.

**`coverage/`, `playwright-report/`, `test-results/`:**
- Purpose: Test and coverage outputs.
- Generated: Yes.
- Committed: No.

**`scripts/e2e-tests/`:**
- Purpose: Repository E2E test harness and reports.
- Generated: Partially; source scripts are authored, reports are generated.
- Committed: Source scripts yes; generated reports depend on run output.

**`Avatars/`:**
- Purpose: Source/default avatar assets separate from served `public/avatars/`.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-05-21*
