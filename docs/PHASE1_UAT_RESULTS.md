# Phase 1 UAT Results

**Status:** Phase 1.1 UAT accepted; UAT cleanup complete
**Environment:** Same Supabase project, controlled Phase 1.1 migration
**Branch:** `codex/gsd-v2-phase1-20260516`
**Worktree:** `_worktrees/renew-platform-gsd-v2-phase1`

## Environment Decision

Approved by Ivan on 2026-05-17 and superseding the earlier separate-project plan:

- Use the same/current Re-New Supabase project for Phase 1.1 testing to avoid extra Supabase project cost.
- Apply only reviewed additive migrations.
- Do not run destructive SQL against existing schema or existing non-UAT data.
- Use clearly marked fake or sanitized opportunity data for UAT.
- Keep secrets local and uncommitted.

## Migration Checklist

- [x] Confirm target Supabase project URL/ref is the intended current Re-New project: `iiuqcdnmxhtyispnykgf`.
- [x] Confirm backup route: schema-only snapshot saved locally at `/tmp/renew-phase-1-1/pre_phase_1_1_schema.sql`; Ivan accepted additive migration risk for data.
- [x] Confirm `scripts/044_create_opportunities_foundation.sql` is additive-only.
- [x] Confirm `scripts/045_setup_opportunity_documents_storage.sql` is additive-only for the opportunity documents bucket/policies.
- [x] Confirm worktree `.env.local` points to the approved project and remains uncommitted.
- [x] Apply `scripts/044_create_opportunities_foundation.sql`.
- [x] Apply opportunity document storage setup: private `opportunity-documents` bucket created via service API. `storage.objects` SQL policies could not be applied by the pooler DB user because Supabase owns that internal table; Phase 1 server actions use the service role and upload was verified.
- [x] Confirm app can connect to the approved database.
- [x] Confirm app can use the opportunity documents storage bucket.
- [x] Confirm `git status --short` shows no committed secrets.
- [x] Prepare UAT cleanup route for records marked `UAT-` or `phase-1.1-uat`.

## UAT Checklist

### Opportunity Management

- [x] Create opportunity technical path verified with marked record `UAT-1779001031632`.
- [x] Create opportunity manually through browser UI: `UAT-BROWSER-1779001491408`.
- [x] Edit locked June fields through browser UI: location, public title, and staff notes updated.
- [x] Archive opportunity through browser UI: `UAT-BROWSER-1779001491408` now shows `Archived`.
- [x] Confirm status/visibility labels render on authenticated opportunity list.

### Staff-Only vs Repreneur-Visible

- [x] Source/contact technical path verified on staff-side record.
- [x] Public/anonymized fields technical path verified in created record.
- [x] Staff detail view keeps source/contact data in the staff-only source section; Phase 1 has no repreneur portal exposure yet.

### Import Review

- [x] Prepare a representative CSV matching Bertrand workbook-style aliases.
- [x] Preview rows.
- [x] Confirm valid rows, warnings, and blockers.
- [x] Commit approved valid rows only: `UAT-IMPORT-1779001652678` created; one missing-reference row remained blocked/skipped.

### Documents

- [x] Attach a document technical path verified through Supabase storage and metadata.
- [x] Confirm default visibility is staff-only in metadata.
- [x] Change visibility to approved for repreneur through browser UI.
- [x] Remove document through browser UI.

### Scope Boundaries

- [x] No automatic PDF parsing.
- [x] No full M&A CRM.
- [x] No AI matching.
- [x] No repreneur portal exposure yet.

## Findings

| Area | Result | Severity | Notes |
|------|--------|----------|-------|
| Environment | Pass | - | Same Supabase project selected, connection verified, local `.env.local` ignored by git. |
| Migration | Pass with note | Low | Opportunity tables applied. Storage bucket created via service API because pooler user cannot own `storage.objects` policies. Phase 1 upload uses server service role, so document upload works. |
| Auth guard | Fixed | Medium | Unauthenticated `/opportunities` returned 500 because middleware did not protect the route. Added `/opportunities` to protected paths; now redirects to `/auth/login`. |
| Browser UAT | Pass | - | Created, edited, archived, imported, and managed document visibility/removal through the browser using marked UAT records. |
| Import review | Pass | - | One valid row was committed and one missing-reference row was blocked/skipped as expected. |
| UAT cleanup | Pass | - | Removed `UAT-1779001031632`, `UAT-BROWSER-1779001491408`, `UAT-IMPORT-1779001652678`, the temporary UAT logins/sessions, and the stored UAT document file after Ivan accepted the local result. |
| Dev server warning | Follow-up | Low | Next dev logs warn that `prettier` is missing for `@react-email/render`; not blocking opportunity UAT. |
| Typecheck | Existing blocker outside Phase 1.1 | Medium | Full `tsc --noEmit` still fails on pre-existing unrelated project errors in archived/intake/email/test areas. Phase 1.1 browser UAT is not blocked, but merge should acknowledge this baseline. |

## Release Recommendation

Ivan accepted the local UAT result on 2026-05-17 and approved push/merge. Phase 1 is ready to merge from the worktree branch. The remaining caution is project-wide TypeScript baseline noise that predates this phase.

UAT cleanup decision: completed before push/merge. No marked Phase 1.1 UAT opportunities or temporary UAT users remain in the approved Supabase project.
