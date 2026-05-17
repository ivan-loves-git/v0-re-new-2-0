# Phase 1 UAT Results

**Status:** Technical environment ready; human UAT pending
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
- [ ] Create opportunity manually through browser UI.
- [ ] Edit locked June fields through browser UI.
- [ ] Archive opportunity through browser UI.
- [x] Confirm status/visibility labels render on authenticated opportunity list.

### Staff-Only vs Repreneur-Visible

- [x] Source/contact technical path verified on staff-side record.
- [x] Public/anonymized fields technical path verified in created record.
- [ ] Human check that source details do not leak to repreneur-visible content.

### Import Review

- [ ] Prepare a small CSV/TSV export from Bertrand workbook.
- [ ] Preview rows.
- [ ] Confirm valid rows, warnings, and blockers.
- [ ] Commit approved valid rows only.

### Documents

- [x] Attach a document technical path verified through Supabase storage and metadata.
- [x] Confirm default visibility is staff-only in metadata.
- [ ] Change visibility to approved for repreneur through browser UI.
- [ ] Remove document through browser UI.

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
| Technical UAT | Partial pass | Medium | Authenticated `/opportunities` renders and includes marked UAT opportunity `UAT-1779001031632`; document upload/storage path verified. Manual UI edit/archive/import still pending. |
| Dev server warning | Follow-up | Low | Next dev logs warn that `prettier` is missing for `@react-email/render`; not blocking opportunity UAT. |

## Release Recommendation

Do not merge yet. Phase 1.1 environment setup is complete, but Phase 1.1 UAT remains partially complete until Ivan or Codex validates manual create/edit/archive/import/document visibility flows in the browser.

UAT cleanup decision: keep `UAT-1779001031632`, its attached test document, and the `uat.phase11.20260517@re-new.team` test login temporarily so Ivan can inspect the live test result. Remove them before final release unless Ivan chooses to keep test fixtures.
