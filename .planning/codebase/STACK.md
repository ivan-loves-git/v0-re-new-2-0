# Technology Stack

**Analysis Date:** 2026-05-21

## Languages

**Primary:**
- TypeScript 5.9.3 - Next.js App Router pages, API routes, Server Actions, React components, shared utilities, and automation scripts in `app/`, `components/`, `lib/`, and `scripts/`.
- TSX / React 19.2.0 - UI components and route views in `app/**/*.tsx` and `components/**/*.tsx`.

**Secondary:**
- SQL / PostgreSQL - Database schema, RLS policies, seed data, indexes, and Supabase Storage setup in `scripts/*.sql` and `supabase/migrations/*.sql`.
- JavaScript / ESM - Framework and tool configuration in `next.config.mjs`, `eslint.config.mjs`, and `postcss.config.mjs`.
- Python - One-off Flatchr Excel import tooling in `scripts/import-flatchr-excel.py`.
- CSS - Tailwind v4 theme tokens, global styles, and animation imports in `app/globals.css`.

## Runtime

**Environment:**
- Node.js runtime - Next.js 16 app and route handlers; no repo-pinned Node version was detected in `.nvmrc`, `.node-version`, or `package.json`.
- Vercel serverless runtime - Production hosting and scheduled cron configured by `vercel.json`.
- PostgreSQL runtime - Better Auth direct `pg` pool and Supabase API clients connect to Supabase-hosted PostgreSQL through `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and Supabase keys.

**Package Manager:**
- npm - `package-lock.json` is present and `package.json` scripts use npm-compatible commands.
- pnpm - `pnpm-lock.yaml` is also present. Treat lockfile ownership carefully and keep dependency updates consistent with the installer used by the active workflow.
- Lockfile: present (`package-lock.json` and `pnpm-lock.yaml`).

## Frameworks

**Core:**
- Next.js 16.0.10 - App Router, route handlers, Server Components, Server Actions, metadata, image generation, and deployment build in `app/`, `next.config.mjs`, and `package.json`.
- React 19.2.0 / React DOM 19.2.0 - UI rendering for dashboard, portal, intake, analytics, and tools surfaces in `app/` and `components/`.
- Tailwind CSS 4.1.9 - Utility styling and design tokens via `app/globals.css` and `postcss.config.mjs`.
- shadcn/ui + Radix UI - Component system configured in `components.json`, with installed UI primitives under `components/ui/`.
- Better Auth 1.4.14 - Email/password authentication configured in `lib/auth.ts`, client helpers in `lib/auth-client.ts`, and the route handler in `app/api/auth/[...all]/route.ts`.
- Supabase JS / SSR - Database and storage clients in `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/client.ts`, and `lib/supabase/proxy.ts`.

**Testing:**
- Vitest 3.0.0 - Unit test runner configured in `vitest.config.ts`; scripts are `npm run test`, `npm run test:watch`, and `npm run test:coverage`.
- V8 coverage - Coverage provider configured through `@vitest/coverage-v8` in `vitest.config.ts`.
- Custom E2E scripts - TypeScript browser/data-validation harness under `scripts/e2e-tests/`; no Playwright package is declared in `package.json`.

**Build/Dev:**
- Next.js build/dev/start - Scripts in `package.json`: `build`, `dev`, `start`.
- ESLint 9.39.4 with `eslint-config-next` 16.0.10 - Linting configured in `eslint.config.mjs` and run by `npm run lint`.
- TypeScript strict mode - `strict: true`, bundler module resolution, and `@/*` path alias configured in `tsconfig.json`.
- PostCSS + `@tailwindcss/postcss` - Tailwind v4 PostCSS integration in `postcss.config.mjs`.
- Prettier 3.7.4 - Installed in `package.json`; no dedicated Prettier config file detected.

## Key Dependencies

**Critical:**
- `next` 16.0.10 - Application framework and build target for `app/`.
- `react` 19.2.0 and `react-dom` 19.2.0 - UI runtime for all React surfaces.
- `better-auth` ^1.4.14 - Auth server, React client, password hashing helpers, and Next.js integration used by `lib/auth.ts`, `lib/auth-client.ts`, `lib/auth-server.ts`, `proxy.ts`, and `app/api/auth/[...all]/route.ts`.
- `pg` ^8.17.1 - Direct PostgreSQL pooling for Better Auth and portal access operations in `lib/auth.ts`, `lib/actions/portal-access.ts`, and `scripts/create-users-direct.ts`.
- `@supabase/supabase-js` latest - Server/admin data access and storage operations in `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `app/api/upload-cv/route.ts`, and many `lib/actions/*.ts` modules.
- `@supabase/ssr` 0.8.0 - Browser and cookie-aware Supabase clients in `lib/supabase/client.ts` and `lib/supabase/proxy.ts`.
- `resend` ^4.0.0 - Transactional email, Wavy sends, M&A workflow emails, and webhook correlation through `lib/email/resend-client.ts`, `lib/email/send-email.ts`, `app/api/wavy/send/route.ts`, and `app/api/webhooks/resend/route.ts`.
- `@anthropic-ai/sdk` ^0.72.1 - Wavy message generation in `app/api/wavy/generate/route.ts`.
- `zod` ^4.3.6 - Environment validation in `lib/env.ts` and schema validation across form/action code.

**Infrastructure:**
- `@vercel/analytics` 1.3.1 - Client analytics mounted in `app/layout.tsx`.
- `@react-email/components` ^0.0.31 and `@react-email/render` ^1.0.2 - Email templates in `lib/email/templates/`.
- `lucide-react` ^0.454.0 - Icon library configured by `components.json` and used throughout components.
- `@radix-ui/react-*` packages and `radix-ui` ^1.4.3 - shadcn UI primitive foundation under `components/ui/`.
- `react-hook-form` ^7.60.0, `@hookform/resolvers` ^3.10.0, and `@tanstack/react-form` ^1.27.7 - Form handling for intake and dashboard workflows.
- `recharts` 2.15.4 - Analytics charts in `components/analytics/`.
- `date-fns` 4.1.0 - Date formatting/calculation in app and action code.
- `sonner` ^1.7.4 - Toast UI mounted in `app/layout.tsx`.
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` - Drag-and-drop UI behavior for workflow surfaces.

## Configuration

**Environment:**
- Environment templates are present in `.env.example` and `.env.test.local.example`; `.env.local` is present and must not be read or committed.
- Required runtime variables include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, and `CRON_SECRET`.
- Integration-specific variables include `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `CC_ON_INTERVIEW_REMINDER`, `NEXT_PUBLIC_SHOW_TEST_AUTOFILL`, and `NEXT_PUBLIC_APP_URL`.
- `lib/env.ts` validates Supabase, Resend, optional `OPENAI_API_KEY`, and `NODE_ENV`, but it is not the only source of env requirements; `lib/auth.ts`, `app/api/wavy/generate/route.ts`, `app/api/webhooks/resend/route.ts`, and `app/api/cron/abandoned-forms/route.ts` read additional variables directly.

**Build:**
- `next.config.mjs` injects `NEXT_PUBLIC_BUILD_NUMBER` and `NEXT_PUBLIC_BUILD_HASH` from git metadata, permits Supabase Storage image hosts, raises Server Action body size to 10 MB, and redirects `/intake` to `/intake-v2`.
- `tsconfig.json` enables strict TypeScript, `@/*` path aliases, JSX via `react-jsx`, and includes `app/`, `components/`, `hooks/`, `lib/`, `proxy.ts`, `vitest.config.ts`, and generated Next types.
- `eslint.config.mjs` applies Next core web vitals and TypeScript linting with prototype-era warnings for explicit `any`, empty object types, and several React Hooks rules.
- `postcss.config.mjs` wires Tailwind v4 through `@tailwindcss/postcss`.
- `components.json` configures shadcn `new-york`, RSC, TSX, CSS variables, aliases, and Lucide icons.
- `vercel.json` defines the production cron path `/api/cron/abandoned-forms`.

## Platform Requirements

**Development:**
- Run `npm run dev` for local Next.js development.
- Run `npm run build && npm run lint` before considering code changes verified, per `AGENTS.md`.
- Provide Supabase, Better Auth, Resend, and optional Anthropic env vars through `.env.local`; do not hard-code secrets.
- Use `@/*` imports for project modules, matching `tsconfig.json` and `components.json`.
- Use shadcn/Radix UI primitives for new dashboard feature surfaces, matching `components.json` and existing `components/ui/`.

**Production:**
- Deployment target is Vercel, with canonical metadata URL `https://app.re-new.team` in `app/layout.tsx`.
- Database and file storage target is Supabase, using service-role server clients in `lib/supabase/server.ts` and `lib/supabase/admin.ts`.
- Auth target is Better Auth over Supabase PostgreSQL, mounted at `/api/auth/*`.
- Email delivery target is Resend, with webhook status updates at `/api/webhooks/resend`.
- AI generation target is Anthropic Claude through `/api/wavy/generate`.

---

*Stack analysis: 2026-05-21*
