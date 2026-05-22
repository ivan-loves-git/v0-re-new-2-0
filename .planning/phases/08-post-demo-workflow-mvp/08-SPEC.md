# Phase 8: Post-demo Workflow MVP - Specification

**Created:** 2026-05-22
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Re-New staff can create and maintain real deal-flow opportunities from Bertrand's canonical Excel structure, connect them to repreneurs from both directions, and move validated interest into a tracked M&A NDA/info memo request workflow.

## Background

Phase 8 follows the founder demo where the platform showed strong progress but exposed practical workflow gaps. The current codebase already has opportunity records, M&A source records, repreneur portal access controls, opportunity matching, pursuit stages, M&A email workflows, and dashboard navigation performance stabilization.

The remaining gap is precision and operability. Opportunity creation currently requires only `reference`; the form labels include confusing concepts such as `anonymized_description`, `source_visibility`, and generic notes; `Effectif` from Bertrand's Excel can be a range like `40-50` while the current schema stores `headcount` as an integer; opportunity matching is visible mainly from the opportunity side; and the pursuit stage model does not yet include the info memo checkpoint Bertrand described.

The canonical Excel source for opportunity fields is `/Users/ivanpaudice/Downloads/2026_05_04_Mandats_Source_UPDATED_dealflow.xlsx`, sheet `2026.05.04 Source`, header row 3. Its mandate fields are `Ref. Mandat`, `Source`, `Localisation`, `Secteur`, `Description`, `CA M€`, `EBE K€`, `Effectif`, and `Date ajout`. The shared workbook has the same fields except `Source`, so the source-updated workbook is the authority for Phase 8.

## Requirements

1. **Excel field enforcement**: New and edited opportunity saves must enforce Bertrand's canonical mandate fields.
   - Current: `components/opportunities/opportunity-form.tsx` marks only `reference` as required, and `lib/actions/opportunities.ts` only blocks missing `reference`.
   - Target: Opportunity save is blocked unless `Ref. Mandat`, `Source`, `Localisation`, `Secteur`, `Description`, `CA M€`, `EBE K€`, `Effectif`, and `Date ajout` are present and parseable or preservable.
   - Acceptance: Submitting the opportunity form with any canonical Excel field missing shows a field-level error and does not create or update the opportunity.

2. **M&A contact enforcement**: M&A contact name and email must be required before an opportunity can be saved.
   - Current: `ma_sources` supports `contact_name` and `contact_email`, but the opportunity form accepts them as optional.
   - Target: Opportunity save requires an M&A firm/source, contact name, and valid contact email so the later NDA/info memo request can be sent without data repair.
   - Acceptance: Submitting a new or edited opportunity without source firm, contact name, or valid contact email fails with field-level validation and leaves existing data unchanged.

3. **Excel value preservation**: Opportunity storage must preserve the Excel semantics without data loss.
   - Current: `revenue_meur` and `ebitda_keur` are numeric; `headcount` is an integer, but Excel `Effectif` can be a range such as `40-50`.
   - Target: `CA M€` and `EBE K€` are stored as numeric values in the existing units, while `Effectif` supports the exact Excel value including ranges.
   - Acceptance: A sample row with `CA M€ = 7 M€`, `EBE K€ = 700 K€`, and `Effectif = 40-50` can be saved and redisplayed without losing the headcount range.

4. **Create opportunity entry point**: Staff must have a clear path to create a new opportunity from the opportunity operating surfaces.
   - Current: `/opportunities/new` exists, but the demo showed the create path is not obvious enough.
   - Target: At least the opportunity Find or Groups surface and the opportunity dashboard expose a clear create opportunity action.
   - Acceptance: A staff user starting from the opportunity dashboard or opportunity Find page can reach the create form in one click.

5. **Schema-level field cleanup**: Confusing opportunity/source fields must be cleaned at schema level, not only relabeled in the UI.
   - Current: The schema and code use `anonymized_description`, `source_visibility`, `repreneur_visibility`, `ma_sources.notes`, and `opportunities.staff_notes`, which are confusing for staff and partly redundant.
   - Target: Schema migrations and code updates replace confusing names with operational names: `anonymized_description` becomes a teaser summary field, M&A source visibility is removed or made a non-editable staff-only invariant, repreneur exposure naming becomes explicit, and internal notes fields are clearly named as internal notes.
   - Acceptance: No user-facing form, type, action, or portal query writes to the old confusing field names after the migration, and existing data is backfilled into the new names.

6. **Portal access reliability**: Staff portal access enablement must complete or fail with clear, recoverable state.
   - Current: `enableRepreneurPortalAccess` creates or links Better Auth user/account rows, writes `app_user_roles`, then sends a reset/access email; partial failure can leave confusing state.
   - Target: Enable, resend, and disable actions report clear errors and do not leave a repreneur appearing enabled when required account or email setup did not complete.
   - Acceptance: Browser UAT can enable, resend, and disable portal access for a test repreneur; simulated missing email or auth/email failure produces a clear error and no misleading enabled state.

7. **Searchable repreneur selectors**: Staff selectors that choose or preview repreneurs must support search.
   - Current: Portal preview and opportunity recommendation selection rely on non-search select patterns that do not scale to the repreneur list.
   - Target: Portal preview and opportunity recommendation screens provide searchable repreneur selection by name and email.
   - Acceptance: In browser UAT, typing part of a repreneur name or email filters selector options and selecting a result updates the target workflow correctly.

8. **Bidirectional matching visibility**: Matching must be understandable from both opportunity and repreneur surfaces.
   - Current: `listOpportunityMatches` shows matches from the opportunity side; repreneur profiles do not show associated opportunities, and recommended repreneurs are not prominent on the opportunity overview.
   - Target: Repreneur profile pages show associated opportunity matches with scores/statuses, and opportunity overview pages show recommended repreneurs without requiring staff to enter the deeper recommendations tab.
   - Acceptance: A known match appears on both the opportunity overview and the matched repreneur profile with consistent score, recommendation, status, and links.

9. **NDA/info memo pursuit workflow**: Validated interest must flow into a tracked M&A NDA/info memo request.
   - Current: Pursuit stages are `interest`, `intermediary_meeting`, `seller_meeting`, `loi`, `closed`, and `dropped`; the M&A email workflow can send/log messages but does not have an explicit NDA/info memo checkpoint.
   - Target: The pursuit stage model includes `info_memo_received` before `intermediary_meeting`, and staff can prepare/send an M&A firm email requesting the NDA/info memo with opportunity and repreneur context.
   - Acceptance: After validating a repreneur pursuit, staff can send the NDA/info memo request email, see it logged against the source/opportunity, and move the pursuit to `Info memo received`.

10. **Seven-day workflow reminders**: Staff must be reminded when the NDA/info memo process stalls for 7 days.
    - Current: Existing reminders focus on stale opportunities; there is no dedicated reminder for the NDA/info memo step.
    - Target: Active pursuits that have not advanced after 7 calendar days from validated interest or the latest NDA/info memo request are visible as needing follow-up.
    - Acceptance: A seeded or test active pursuit older than 7 days with no `info_memo_received` stage appears in the staff follow-up surface, while a pursuit under 7 days or already at `info_memo_received` does not.

## Boundaries

**In scope:**
- Enforce Bertrand's canonical Excel mandate fields for opportunity saves.
- Require M&A source firm, contact name, and contact email at opportunity save time.
- Preserve actual Excel values, including range-style `Effectif` values.
- Add clear create opportunity entry points.
- Clean confusing opportunity/source fields at schema and code level with backfilled data.
- Fix portal access enable/resend/disable reliability and save feedback blockers.
- Add searchable repreneur selectors for portal preview and opportunity recommendation.
- Add bidirectional match visibility on opportunity and repreneur staff pages.
- Add the `info_memo_received` pursuit stage before intermediary meeting.
- Add an M&A NDA/info memo request email flow using existing M&A source interactions.
- Add 7-day follow-up reminders for stalled NDA/info memo workflow.
- Verify the affected staff and portal workflows in browser.

**Out of scope:**
- Full PDF-to-opportunity AI ingestion - explicitly deferred beyond Phase 8.
- ChatGPT JSON opportunity import path - parked for V4/backlog, not part of this MVP.
- Info memo document storage or parsing - Bertrand said it is not urgent.
- Generic Re-New NDA replacement - M&A firms require the candidate/repreneur to sign their own NDA.
- Full M&A firm portal - already out of V2.
- Full HTML email template editor - not needed to validate this workflow.
- AI matching or AI deal analysis - matching remains structured and human-adjustable for this phase.
- Repreneur self-service profile editing - external portal stays narrow/read-only except existing opportunity actions.

## Constraints

- Canonical opportunity fields come from `/Users/ivanpaudice/Downloads/2026_05_04_Mandats_Source_UPDATED_dealflow.xlsx`, sheet `2026.05.04 Source`, row 3 headers.
- `Effectif` must support ranges and non-integer text from Excel without silent truncation.
- M&A source details must remain staff-only and must not appear in repreneur portal views.
- Schema cleanup requires migrations, type updates, action updates, import updates, dashboard data loader updates, and portal query updates.
- Adding `info_memo_received` to the Postgres enum is one-way in practice; do not add speculative extra stages.
- New workflow pages must preserve the Phase 8 navigation-performance guardrail: no broad repeated Supabase reads or route remount wrappers.
- Verification must use stored project credentials and real browser UAT; do not stop at the login screen.
- Build and lint remain required, and visible TypeScript issues cannot be ignored because `next.config.mjs` suppresses build-time type failures.

## Acceptance Criteria

- [ ] Opportunity save blocks missing `Ref. Mandat`, `Source`, `Localisation`, `Secteur`, `Description`, `CA M€`, `EBE K€`, `Effectif`, and `Date ajout`.
- [ ] Opportunity save blocks missing M&A contact name or invalid/missing M&A contact email.
- [ ] Excel sample values including `Effectif = 40-50` save and redisplay without data loss.
- [ ] Staff can reach create opportunity in one click from opportunity dashboard or opportunity Find.
- [ ] Confusing field names are migrated/backfilled at schema level and old confusing names are not used by forms/actions/portal queries.
- [ ] Portal access enable, resend, and disable pass browser UAT and show clear failure messages on invalid setup.
- [ ] Portal preview and opportunity recommendation selectors support name/email search.
- [ ] A known opportunity match is visible from both the opportunity overview and the repreneur profile.
- [ ] `Info memo received` exists as a pursuit stage before intermediary meeting and is covered by journey-stage tests.
- [ ] Staff can send/log an M&A NDA/info memo request email using opportunity and repreneur context.
- [ ] Active pursuits stalled for 7 days before info memo receipt appear in staff follow-up/reminder surfaces.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Browser UAT covers portal access, opportunity create/edit validation, search selectors, bidirectional matching, NDA/info memo request, 7-day reminders, and repreneur portal data exposure.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.94 | 0.75 | met | Phase outcome is tied to opportunity intake, matching visibility, and NDA/info memo workflow. |
| Boundary Clarity | 0.90 | 0.70 | met | AI ingestion, JSON import, info memo storage, and generic NDA workflow are explicitly out of scope. |
| Constraint Clarity | 0.82 | 0.65 | met | Excel source, mandatory contact data, schema cleanup, enum, performance, and portal constraints are locked. |
| Acceptance Criteria | 0.86 | 0.70 | met | Pass/fail checks cover each workflow and verification gate. |
| **Ambiguity** | 0.11 | <=0.20 | met | Gate passed. |

Status: met = dimension meets minimum; below minimum = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 0 | Workflow setup | Which phase should receive the SPEC? | Phase 8: Post-demo workflow MVP. |
| 1 | Researcher | What source defines mandatory opportunity fields? | Bertrand's fresh Excel from Notion/downloads is canonical; use `2026_05_04_Mandats_Source_UPDATED_dealflow.xlsx`. |
| 1 | Researcher | Should missing Excel fields block save or only warn? | Enforce the Excel structure as save-blocking validation. |
| 2 | Seed Closer | Should M&A contact name/email be required at save or only before sending? | Require M&A contact name and email at opportunity save time. |
| 2 | Seed Closer | What reminder threshold should apply to stalled NDA/info memo flow? | Use 7 calendar days with no progress. |
| 2 | Seed Closer | Should confusing fields be hidden only in UI or cleaned in schema? | Do schema-level cleanup with migrations/backfill. |

---

*Phase: 08-post-demo-workflow-mvp*
*Spec created: 2026-05-22*
*Next step: $gsd-discuss-phase 8 - implementation decisions (how to build what's specified above)*
