# Phase 8: Post-demo Workflow MVP - Research

**Date:** 2026-05-22
**Status:** Complete
**Source:** `.planning/briefs/2026-05-22-founder-demo-actions.md`

## Research Summary

Phase 8 can be built mostly by refining existing surfaces. The current code already has staff-managed portal access, opportunity create/edit, normalized M&A sources, opportunity matching, pursuit stages, M&A email send/logging, and dashboard snapshots. The main work is stabilizing demo blockers, improving the UI path to existing features, adding one pursuit stage, and making matching visible from the repreneur side.

The safest implementation path is vertical and incremental:

1. Fix demo blockers and selector search first.
2. Clean and validate opportunity intake without changing the broad data model.
3. Add reverse match visibility using `opportunity_matches.repreneur_id`.
4. Extend the active pursuit workflow with an info memo stage and an M&A-request send action.
5. Verify in browser against staff and repreneur portal workflows.

## External Best-practice Notes

- Next.js form guidance supports client and server validation, with HTML attributes for basic validation and server-side validation for stronger checks. It also recommends `useActionState` or `useFormStatus` for pending and error states. This directly applies to the current `OpportunityForm`, whose manual `isSubmitting` state does not reset after a successful non-redirect edit. Source: [Next.js Forms guide](https://nextjs.org/docs/app/guides/forms).
- shadcn/ui's searchable combobox pattern is built from `Popover` plus `Command`, which fits the repreneur selector problem better than Radix `Select` when the list can reach hundreds of candidates. Source: [shadcn/ui Combobox](https://v3.shadcn.com/docs/components/combobox).
- Supabase/Postgres enum changes require schema migrations. Adding an enum value uses `ALTER TYPE ... ADD VALUE`, while removing enum values is unsafe. This matters for adding `info_memo_received` to `opportunity_pursuit_stage`. Source: [Supabase Managing Enums](https://supabase.com/docs/guides/database/postgres/enums).

## Current-code Findings

### Portal access

- `lib/actions/portal-access.ts` already handles staff-controlled enable/resend/disable via Better Auth tables plus `app_user_roles`.
- `scripts/054_repreneur_portal_access_linkage.sql` added `repreneur_id`, timestamps, and unique repreneur-role linkage.
- `components/repreneurs/portal-access-card.tsx` wraps actions in `useTransition`, shows toasts, and refreshes the page.
- Risk: `enableRepreneurPortalAccess` uses direct `pg` writes to Better Auth tables and sends a password reset email through Better Auth. The reported demo error likely lives in env/db/Auth table assumptions or the reset-email call, not in missing UI.
- Planning implication: first plan must reproduce and harden errors around account creation, role upsert, credential account creation, and access email send. It should return clearer error messages and avoid partially enabled records when email sending fails.

### Opportunity create/edit and save feedback

- `app/(dashboard)/opportunities/new/page.tsx` already exists and renders `OpportunityForm`.
- `components/opportunities/opportunity-form.tsx` uses a client `handleSubmit` with manual `isSubmitting`.
- On successful edit, `updateOpportunity` returns `void`; the client never calls `setIsSubmitting(false)` in the success path. This directly explains the demo bug where the data saves but the button stays on `Saving...`.
- `createOpportunity` redirects after insert, so the stuck state is more likely on edit than create.
- Current validation is minimal: only `reference` is required in server actions and HTML. The form has many optional fields.
- Planning implication: introduce a typed action result or `useActionState` pattern for edits, reset pending state, show success toast, and add explicit required-field validation for the locked opportunity fields.

### Opportunity intake fields and M&A contact storage

- `lib/actions/opportunities.ts` upserts `ma_sources` from form data when source fields are present.
- `components/opportunities/opportunity-form.tsx` already captures firm/source, source type, contact name, contact email, phone, source notes, and source visibility.
- `lib/types/opportunity.ts` already includes `MaSource`, `source_id`, `source_label`, `source_visibility`, `public_title`, `anonymized_description`, and `staff_notes`.
- `lib/utils/opportunity-import.ts` maps imported rows to `source_visibility: "staff_only"`, `repreneur_visibility: "anonymized"`, and `anonymized_description`.
- Planning implication: do not add new M&A source schema. Verify and tighten the current source upsert. Rename UI copy from "Anonymized description" to a clearer "Teaser summary" if the DB column remains `anonymized_description`.

### Matching visibility

- `lib/actions/opportunity-matches.ts` already lists matches by opportunity and candidates.
- `opportunity_matches` has `repreneur_id`, and `scripts/055_dashboard_navigation_performance_indexes.sql` already proposes `idx_opportunity_matches_repreneur_updated`, which supports reverse lookup.
- `app/(dashboard)/repreneurs/[id]/page.tsx` currently shows profile, portal access, scores, readiness, documents, activity, notes, and offers, but no opportunity matches.
- `components/opportunities/opportunity-matches-panel.tsx` stores and displays platform recommendation, human recommendation, score, reasons, and status.
- `components/opportunities/repreneur-opportunity-list.tsx` already displays opportunity rows for portal-facing views and can be reused or adapted for a staff-side reverse-match list.
- Planning implication: add a staff action such as `listOpportunityMatchesForRepreneur(repreneurId)` and a compact repreneur-detail card/table using existing match labels and score display.

### Opportunity overview recommendations

- `components/opportunities/opportunity-detail.tsx` keeps recommendations in a tab and overview mostly shows metrics, internal description, repreneur-visible description, and M&A source panel.
- Recommended repreneurs can be surfaced on the overview by summarizing existing `matches` passed into `OpportunityDetail`.
- Planning implication: add a compact "Recommended repreneurs" overview card showing top matches/status/score and linking to the Recommendations tab or repreneur detail.

### Pursuit stages and NDA/info memo workflow

- `OpportunityPursuitStage` currently supports `interest`, `intermediary_meeting`, `seller_meeting`, `loi`, `closed`, and `dropped`.
- `scripts/049_opportunity_pursuit_stages.sql` created the enum and history table.
- `lib/actions/opportunity-matches.ts` restricts staff-editable stages through `STAFF_EDITABLE_PURSUIT_STAGES`.
- `components/opportunities/opportunity-pursuit-panel.tsx` reads `OPPORTUNITY_PURSUIT_STAGE_OPTIONS`.
- `lib/utils/opportunity-journey.ts` maps pursuit stages to journey labels.
- Planning implication: adding an info memo stage requires a migration, TypeScript type update, label/options update, action allow-list update, journey mapping update, tests, and browser UAT.

### M&A email workflow

- `lib/actions/ma-workflows.ts` already drafts, sends, and logs M&A emails against `ma_source_interactions`.
- Existing templates include `ma_request_more_information`, `ma_repreneur_interest_feedback`, and `ma_process_follow_up`.
- `loadOpportunityContext` currently chooses the best match and substitutes basic variables, but it only includes repreneur name/email-level context.
- Planning implication: extend the M&A workflow for the active pursuit context rather than building a separate send stack. Add explicit "request NDA/info memo" template or mode if existing templates are too generic. Include repreneur profile/fiche context in variables if available.

### Reminder model

- Existing reminder logic for stale opportunities lives around `lib/actions/opportunity-freshness.ts` and dashboard panels.
- There is no dedicated NDA/info memo reminder model yet.
- `ma_source_interactions` logs sends but not reminder due dates.
- Planning implication: for MVP, derive reminders from active pursuits with `pursuit_stage = interest` or `info_memo_requested`/not advanced after a threshold, plus interaction timestamps where available. Avoid a new reminders table unless research during implementation proves derivation is too fragile.

### Performance

- Dirty worktree already contains `scripts/055_dashboard_navigation_performance_indexes.sql`, `supabase/migrations/20260521_dashboard_navigation_performance_indexes.sql`, and `lib/data/dashboard-snapshots.ts`, suggesting performance work is already underway.
- `lib/data/dashboard-snapshots.ts` uses `"use cache"`, `cacheLife`, `cacheTag`, and batched Supabase queries for dashboard/list snapshots.
- `app/(dashboard)/dashboard_op/page.tsx` still calls several server actions directly.
- Planning implication: treat performance as investigation and targeted fix. Do not duplicate existing dashboard-snapshot/index work. Verify what is already in the dirty worktree before implementing.

## Risks

- There are many unrelated dirty files in the worktree, including dashboard performance and layout changes. The executor must inspect diffs before editing and avoid reverting user work.
- Adding an enum value is one-way in practice. The stage label should be confirmed in code before migration. Recommended value: `info_memo_received`, label: "Info memo received".
- Portal access uses direct SQL into Better Auth tables; partial failure handling matters because DB role linkage and email sending are separate operations.
- `next.config.mjs` currently ignores TypeScript build errors. The plan should still require `npm run lint` and targeted tests, and should not use ignored type errors as permission to ship broken types.

## Recommended Plan Shape

- `08-01`: Stabilize immediate demo blockers and searchable selectors.
- `08-02`: Tighten opportunity creation/editing, validation, teaser copy, and confusing field cleanup.
- `08-03`: Add reverse match visibility and opportunity overview recommendation summary.
- `08-04`: Add info memo stage and NDA/info memo M&A request flow.
- `08-05`: Browser UAT, performance follow-up classification, and roadmap/backlog cleanup.

## Validation Architecture

- Unit tests:
  - Add/update tests for `lib/utils/opportunity-journey.ts` after adding the new stage.
  - Add server-action tests only where existing test harnesses make it cheap; otherwise use browser UAT for DB-backed flows.
- Browser UAT:
  - Staff login.
  - Enable portal access for a test repreneur or reproduce a controlled repair path.
  - Create/edit opportunity and confirm save feedback resets.
  - Search repreneur selectors in portal preview and recommendation panel.
  - Open repreneur profile and confirm associated matches are visible.
  - Open opportunity overview and confirm recommended repreneurs are visible.
  - Validate interested match, send/request NDA/info memo email, update info memo stage, and confirm history/reminder state.
- Build checks:
  - `npm run lint`
  - `npm run build`

## Research Complete
