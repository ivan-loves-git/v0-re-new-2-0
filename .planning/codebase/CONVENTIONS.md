# Coding Conventions

**Analysis Date:** 2026-05-21

## Naming Patterns

**Files:**
- Use kebab-case for React components and feature modules: `components/opportunities/opportunity-form.tsx`, `components/dashboard/stats-cards.tsx`, `lib/utils/opportunity-match-scoring.ts`.
- Use `page.tsx`, `layout.tsx`, `template.tsx`, `error.tsx`, and `route.ts` for Next.js App Router files: `app/intake-v2/page.tsx`, `app/(dashboard)/layout.tsx`, `app/api/wavy/generate/route.ts`.
- Use feature folders under `components/` and `lib/actions/`: `components/offers/offer-form.tsx`, `components/repreneurs/status-badge.tsx`, `lib/actions/offers.ts`, `lib/actions/repreneurs.ts`.
- Use `index.ts` barrel exports only for compact feature entry points: `components/intake-v2/index.ts`, `components/questionnaire/index.ts`, `lib/email/index.ts`.
- Use `__tests__` for Vitest unit tests beside implementation folders: `lib/utils/__tests__/scoring-v2.test.ts`, `lib/utils/__tests__/opportunity-match-scoring.test.ts`.

**Functions:**
- Use camelCase for functions and action handlers: `calculateWhoScore` in `lib/utils/scoring-v2.ts`, `createRepreneur` in `lib/actions/repreneurs.ts`, `getCurrentUser` in `lib/auth-server.ts`.
- Use named exported functions for shared server utilities, server actions, and pure helpers: `createAdminClient` in `lib/supabase/admin.ts`, `calculateOpportunityMatchScore` in `lib/utils/opportunity-match-scoring.ts`.
- Use `handleSubmit` for local form submit wrappers inside client components: `components/opportunities/opportunity-form.tsx`.
- Use `GET` and `POST` uppercase exports for API route handlers: `app/api/repreneurs/[id]/route.ts`, `app/api/wavy/generate/route.ts`.

**Variables:**
- Use camelCase for local variables and request state: `sectorPrefsRaw`, `marketingConsent`, `templateContext`, `repreneurContext` in `lib/actions/repreneurs.ts` and `app/api/wavy/generate/route.ts`.
- Preserve database column names in object payloads when writing to Supabase: `first_name`, `last_name`, `marketing_consent`, `consent_timestamp` in `lib/actions/repreneurs.ts`.
- Use uppercase constants for static config maps and option lists: `WHO_POINTS`, `TRIANGULATION_MATRIX`, `FLAG_DESCRIPTIONS` in `lib/utils/scoring-v2.ts`, `PERSONA_OPTIONS` in `lib/types/repreneur.ts`.
- Use `is*` booleans for UI state: `isSubmitting` in `components/opportunities/opportunity-form.tsx`.

**Types:**
- Use PascalCase for interfaces and exported union types: `Repreneur`, `LifecycleStatus`, `Tier2Dimensions`, `MilestoneKey` in `lib/types/repreneur.ts`.
- Use domain-specific request interfaces near API handlers when the shape is local: `GenerateRequest` in `app/api/wavy/generate/route.ts`.
- Use inferred option value types from `as const` arrays when possible: `SourceType` in `lib/types/repreneur.ts`.
- Import type-only symbols with `import type` or inline `type` imports: `import type { Repreneur_Insert }` in `lib/actions/repreneurs.ts`, `cva, type VariantProps` in `components/ui/button.tsx`.

## Code Style

**Formatting:**
- Primary formatter dependency: Prettier `3.7.4` in `package.json`.
- No committed `.prettierrc` or `prettier.config.*` is detected; use Prettier defaults unless a local editor config supplies project settings.
- The active codebase has mixed quote style. New shadcn/ui and most action/API files use double quotes, for example `components/ui/button.tsx` and `lib/actions/repreneurs.ts`; older utility tests use single quotes, for example `lib/utils/__tests__/scoring-v2.test.ts`. Prefer matching the surrounding file.
- Use trailing commas in multi-line function calls and object literals where the local file already uses them: `components/dashboard/stats-cards.tsx`, `components/ui/button.tsx`, `lib/utils/__tests__/opportunity-match-scoring.test.ts`.

**Linting:**
- Run lint with `npm run lint`, configured as `eslint .` in `package.json`.
- ESLint config is flat config in `eslint.config.mjs`.
- `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` are enabled in `eslint.config.mjs`.
- The project intentionally treats prototype-era strictness issues as warnings: `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-empty-object-type`, `react-hooks/error-boundaries`, `react-hooks/purity`, `react-hooks/set-state-in-effect`, and `react-hooks/static-components` in `eslint.config.mjs`.
- Do not place production app code in ignored paths. ESLint ignores `_archive/**`, `scripts/**`, `scripts/e2e-tests/**`, `.next/**`, `coverage/**`, and `node_modules/**` in `eslint.config.mjs`.

**TypeScript:**
- Keep app code under the strict TypeScript project configured in `tsconfig.json`.
- `strict: true`, `isolatedModules: true`, `noEmit: true`, and `moduleResolution: "bundler"` are enabled in `tsconfig.json`.
- Use the `@/*` alias for root-relative imports. The alias maps to `./*` in `tsconfig.json` and `vitest.config.ts`.
- `allowJs: true` is enabled, but current application code is TypeScript-first; add new app code as `.ts` or `.tsx`.

## Import Organization

**Order:**
1. Framework/runtime imports: `react`, `next/*`, `better-auth/*`, `@supabase/*`, `@anthropic-ai/sdk`.
2. UI and component imports: `@/components/ui/button`, `@/components/repreneurs/status-badge`, feature component imports.
3. Domain actions, utilities, data, and types: `@/lib/actions/*`, `@/lib/utils/*`, `@/lib/types/*`.
4. Relative imports for same-folder files and feature-local helpers: `./copy-button`, `./base-layout`, `../scoring-v2`.

**Path Aliases:**
- Use `@/` for application-root imports in app, component, lib, and test files: `@/lib/auth-server`, `@/components/ui/card`, `@/lib/types/scoring-v2`.
- Use relative imports for implementation-under-test in co-located tests: `../scoring-v2` in `lib/utils/__tests__/scoring-v2.test.ts`, `../opportunity-match-scoring` in `lib/utils/__tests__/opportunity-match-scoring.test.ts`.
- Use relative imports inside tight feature modules when files are siblings: `./base-layout` in `lib/email/templates/welcome.tsx`.

## Error Handling

**Patterns:**
- API routes should authenticate early and return structured JSON errors with `NextResponse.json`: `app/api/repreneurs/[id]/route.ts`, `app/api/wavy/generate/route.ts`.
- Server actions should throw `Error` with user-actionable messages after failed Supabase writes: `lib/actions/repreneurs.ts`, `lib/actions/offers.ts`, `lib/actions/opportunity-matches.ts`.
- Database errors from Supabase are usually propagated via `throw new Error(error.message)`: `lib/actions/repreneurs.ts`, `lib/actions/opportunity-matches.ts`.
- For expected validation failures, throw explicit messages before database writes: `First name is required`, `Last name is required`, and `Valid email is required` in `lib/actions/repreneurs.ts`.
- For optional side effects such as emails or cache revalidation, catch and log without failing the primary mutation when the mutation has already succeeded: `lib/actions/repreneurs.ts`, `lib/actions/offers.ts`, `lib/email/send-email.ts`.
- In server auth helpers, use `unstable_rethrow(error)` before logging fallback errors so Next.js control-flow exceptions are preserved: `lib/auth-server.ts`.
- Environment validation should fail fast and log field-level validation metadata without printing secret values: `lib/env.ts`.

## Logging

**Framework:** console

**Patterns:**
- Use `console.error` for failed database, auth, API, and email operations: `lib/actions/intake.ts`, `lib/actions/wavy.ts`, `app/api/wavy/generate/route.ts`.
- Use scoped log prefixes for operational helpers where a single action has multiple stages: `[auth]` in `lib/auth.ts`, `[updateRepreneurField]` in `lib/actions/repreneurs.ts`, `[sendEmail]` in `lib/email/send-email.ts`.
- Use `console.warn` when a non-critical fallback is used or setup step fails without blocking the main path: `lib/data/intake-criteria.ts`, `scripts/e2e-tests/index.ts`.
- Never log raw secret values. Existing auth logging checks only whether `RESEND_API_KEY` is set in `lib/auth.ts`.

## Comments

**When to Comment:**
- Use comments to explain domain scoring matrices, business rules, backwards compatibility, and security boundaries: `lib/utils/scoring-v2.ts`, `lib/actions/repreneurs.ts`, `lib/supabase/admin.ts`.
- Keep comments near non-obvious behavior such as preserving lifecycle status during profile edits: `lib/actions/repreneurs.ts`.
- Use section dividers sparingly in long domain modules and tests to group scenarios: `lib/utils/scoring-v2.ts`, `lib/utils/__tests__/scoring-v2.test.ts`.

**JSDoc/TSDoc:**
- Use JSDoc for exported helpers, server actions, and test runner utilities where call semantics matter: `lib/auth-server.ts`, `lib/actions/repreneurs.ts`, `scripts/e2e-tests/index.ts`.
- Do not require JSDoc for small presentational components or obvious local functions: `components/dashboard/stats-cards.tsx`, `components/opportunities/opportunity-form.tsx`.

## Function Design

**Size:** Keep pure utility functions focused and table-driven when domain rules are dense. `lib/utils/scoring-v2.ts` stores scoring constants separately from calculation functions.

**Parameters:** Prefer typed objects and domain aliases over positional primitives for business logic. Examples include `WhoAnswers` and `WhenAnswers` in `lib/utils/scoring-v2.ts`, `OpportunityWithSource` in `components/opportunities/opportunity-form.tsx`.

**Return Values:** Return structured domain result objects from pure utilities, not loosely shaped primitives. Examples include score results from `lib/utils/scoring-v2.ts` and match results from `lib/utils/opportunity-match-scoring.ts`.

**Server Actions:** Accept `FormData` for form-backed mutations, parse/validate inside the action, then call `revalidatePath` and `redirect` where needed: `lib/actions/repreneurs.ts`, `lib/actions/opportunities.ts`.

**Client Components:** Mark files with `"use client"` only when hooks, event state, or browser APIs are needed: `components/opportunities/opportunity-form.tsx`, `components/dashboard/stats-cards.tsx`, `app/c/[slug]/copy-button.tsx`.

## Module Design

**Exports:** Use named exports for utilities, actions, constants, and components. Examples: `export function Button` in `components/ui/button.tsx`, `export async function createRepreneur` in `lib/actions/repreneurs.ts`, `export const FLAG_DESCRIPTIONS` in `lib/utils/scoring-v2.ts`.

**Barrel Files:** Use barrel files for public feature APIs only when they reduce import noise. Existing examples are `lib/email/index.ts`, `components/guide/index.ts`, `components/questionnaire/index.ts`.

**UI Components:** Prefer shadcn/ui primitives and Radix-based components from `components/ui/` for new dashboard and operational UI. `components/ui/button.tsx` uses `class-variance-authority` and `cn` from `lib/utils.ts`.

**Styling:** Use Tailwind utility classes inline with shadcn semantics. Compose conditional classes through `cn` from `lib/utils.ts`.

**Auth:** Follow the project-local Better Auth skills. Keep server configuration in `lib/auth.ts`, server session helpers in `lib/auth-server.ts`, and client helpers in `lib/auth-client.ts`. Export Better Auth inferred types from `lib/auth.ts`.

**Database Access:** Use `createAdminClient` from `lib/supabase/admin.ts` only in server-side code. The file explicitly notes that the service role client bypasses RLS and must never be exposed to the browser.

---

*Convention analysis: 2026-05-21*
