# Phase 8: Post-demo Workflow MVP - Pattern Map

**Date:** 2026-05-22
**Status:** Complete

## Pattern Summary

Phase 8 should extend existing server-action, shadcn/ui, Supabase, and dashboard-cache patterns. The codebase already has almost every domain primitive needed. The implementation should avoid new architectural layers and focus on specific action/component upgrades.

## Form Mutation Pattern

### Existing Files

- `components/opportunities/opportunity-form.tsx`
- `lib/actions/opportunities.ts`
- `components/opportunities/opportunity-review-submit-button.tsx`
- `components/opportunities/opportunity-matches-panel.tsx`
- `components/repreneurs/portal-access-card.tsx`

### Pattern to Reuse

- For simple server-action forms nested in server components, use form actions with a submit button reading pending state via `useFormStatus`, as in `OpportunityReviewSubmitButton`.
- For richer client forms with toast/error behavior, use local client state plus an action result object, as in `OpportunityMatchesPanel`.
- Avoid the current `OpportunityForm` success-state bug:
  - It sets `isSubmitting` to `true`.
  - It resets only in `catch`.
  - Successful edit actions return `void`, so the button can remain stuck.

### Planning Implication

Convert opportunity edit/create to a result-returning path or to `useActionState`, with consistent success/error feedback and reset behavior. Keep redirects only where intended for create.

## Searchable Selector Pattern

### Existing Files

- `components/opportunities/opportunity-matches-panel.tsx`
- `components/repreneurs/staff-portal-preview-selector.tsx`
- `app/(dashboard)/portal-preview/page.tsx`
- `components/wavy/repreneur-search.tsx`
- `package.json` (`cmdk`, Radix Popover, shadcn/ui primitives already available)

### Pattern to Reuse

- Current opportunity recommendation picker uses Radix `Select`, which is poor for hundreds of repreneurs.
- The platform already depends on `cmdk`, and shadcn's combobox pattern uses `Popover` + `Command`.
- Build or reuse a compact `RepreneurCombobox` component for staff-side repreneur selection.

### Planning Implication

Replace the staff pickers that need search, not every select in the app. First targets:

- Portal preview selector.
- Opportunity recommendation `repreneur_id` selector.

## Opportunity Data Pattern

### Existing Files

- `lib/types/opportunity.ts`
- `lib/actions/opportunities.ts`
- `components/opportunities/opportunity-form.tsx`
- `lib/utils/opportunity-import.ts`
- `scripts/044_create_opportunities_foundation.sql`
- `scripts/051_ma_source_directory_and_email_templates.sql`
- `scripts/052_seed_demo_ma_source_contacts.sql`

### Pattern to Reuse

- `opportunities` stores operational opportunity fields.
- `ma_sources` stores firm/contact metadata.
- `opportunities.source_id` links to `ma_sources`.
- `upsertSourceFromForm` already creates/updates source records from opportunity forms.
- `anonymized_description` is the current entrepreneur-visible summary field, even if the UI label should change to "Teaser summary".

### Planning Implication

Do not add new source/contact tables. Verify existing source linkage and tighten validation/copy. Prefer UI label changes over DB renames for the current phase unless the confusing field creates real implementation risk.

## Matching Pattern

### Existing Files

- `lib/actions/opportunity-matches.ts`
- `components/opportunities/opportunity-matches-panel.tsx`
- `lib/utils/opportunity-match-scoring.ts`
- `components/opportunities/repreneur-opportunity-list.tsx`
- `app/(dashboard)/repreneurs/[id]/page.tsx`
- `supabase/migrations/20260521_dashboard_navigation_performance_indexes.sql`

### Pattern to Reuse

- Matching rows already connect `opportunity_id` and `repreneur_id`.
- Platform score, reasons, platform recommendation, and human recommendation already exist.
- The opportunity detail page already receives `matches`.
- The repreneur profile page does not yet fetch `opportunity_matches`.
- A reverse lookup is supported by existing data and planned/performance indexes.

### Planning Implication

Add a staff-facing reverse match query and component on repreneur detail. Surface a compact overview card on opportunity detail by summarizing existing `matches`, not by introducing a new matching model.

## Pursuit Stage Pattern

### Existing Files

- `lib/types/opportunity.ts`
- `scripts/049_opportunity_pursuit_stages.sql`
- `lib/actions/opportunity-matches.ts`
- `components/opportunities/opportunity-pursuit-panel.tsx`
- `lib/utils/opportunity-journey.ts`
- `lib/utils/__tests__/opportunity-journey.test.ts`

### Pattern to Reuse

- `opportunity_pursuit_stage` is a Postgres enum.
- The current stage is stored on `opportunity_matches.pursuit_stage`.
- Stage history is stored in `opportunity_pursuit_events`.
- Staff-editable stages are allow-listed in the action layer.
- UI options come from `OPPORTUNITY_PURSUIT_STAGE_OPTIONS`.
- Derived opportunity journey maps active-pursuit stages to journey labels.

### Planning Implication

Add `info_memo_received` through a migration and thread it through types, labels, allow-lists, derived journey, pursuit panel, and tests. Because enum removal is unsafe, the implementation should not add several speculative stages.

## M&A Email Pattern

### Existing Files

- `lib/actions/ma-workflows.ts`
- `components/opportunities/opportunity-ma-workflow-panel.tsx`
- `app/api/opportunities/[id]/ma-workflow/send/route.ts`
- `lib/email/templates.ts`
- `scripts/053_create_ma_source_interactions.sql`

### Pattern to Reuse

- The opportunity M&A tab already drafts, sends, and logs intermediary emails.
- `ma_source_interactions` logs outbound emails against opportunity/source.
- Template metadata and bodies already support M&A/intermediary templates.
- `loadOpportunityContext` already substitutes opportunity/source/repreneur variables.

### Planning Implication

Extend this workflow for NDA/info memo request rather than building a new email tool. Add a template key or selected mode only if existing templates cannot express the request cleanly.

## Dashboard and Reminder Pattern

### Existing Files

- `lib/actions/opportunity-freshness.ts`
- `components/dashboard/opportunity-freshness-panel.tsx`
- `app/(dashboard)/dashboard_op/page.tsx`
- `lib/data/dashboard-snapshots.ts`
- `scripts/055_dashboard_navigation_performance_indexes.sql`
- `supabase/migrations/20260521_dashboard_navigation_performance_indexes.sql`

### Pattern to Reuse

- Current reminders are derived from existing data, not a separate task table.
- Dashboard snapshots are moving toward Next cache tags and cached Supabase reads.
- Active pursuit and NDA-blocked queues already exist on the opportunity dashboard.

### Planning Implication

Derive NDA/info memo reminders from existing pursuit stage and interaction dates. Avoid a new reminders table unless implementation research finds derivation cannot represent the workflow.

## Testing Pattern

### Existing Files

- `vitest.config.ts`
- `lib/utils/__tests__/opportunity-journey.test.ts`
- `lib/utils/__tests__/opportunity-match-scoring.test.ts`
- `scripts/e2e-tests/`
- `AGENTS.md`

### Pattern to Reuse

- Unit tests are concentrated around pure `lib/utils` logic.
- DB-backed staff workflows are validated through build/lint and browser UAT.
- Project instructions require browser testing with stored credentials and forbid stopping at the login wall.

### Planning Implication

Add focused unit tests for the new stage/derived journey. Use browser UAT for portal access, form save feedback, selectors, reverse match visibility, and email flow.

## Pattern Mapping Complete
