# Phase 1 UAT Results

**Status:** Not started
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

- [ ] Confirm target Supabase project URL/ref is the intended current Re-New project.
- [ ] Confirm backup route: dashboard backup, manual logical dump, or explicitly accepted risk.
- [ ] Confirm `scripts/044_create_opportunities_foundation.sql` is additive-only.
- [ ] Confirm `scripts/045_setup_opportunity_documents_storage.sql` is additive-only for the opportunity documents bucket/policies.
- [ ] Confirm worktree `.env.local` points to the approved project and remains uncommitted.
- [ ] Apply `scripts/044_create_opportunities_foundation.sql`.
- [ ] Apply `scripts/045_setup_opportunity_documents_storage.sql`.
- [ ] Confirm app can connect to the approved database.
- [ ] Confirm app can use the opportunity documents storage bucket.
- [ ] Confirm `git status --short` shows no committed secrets.
- [ ] Prepare UAT cleanup route for records marked `UAT-` or `phase-1.1-uat`.

## UAT Checklist

### Opportunity Management

- [ ] Create opportunity manually.
- [ ] Edit locked June fields.
- [ ] Archive opportunity.
- [ ] Confirm status/visibility labels are understandable.

### Staff-Only vs Repreneur-Visible

- [ ] Source/contact appears only in staff-only area.
- [ ] Public/anonymized fields appear in repreneur-visible area.
- [ ] Source details do not leak to repreneur-visible content.

### Import Review

- [ ] Prepare a small CSV/TSV export from Bertrand workbook.
- [ ] Preview rows.
- [ ] Confirm valid rows, warnings, and blockers.
- [ ] Commit approved valid rows only.

### Documents

- [ ] Attach a document.
- [ ] Confirm default visibility is staff-only.
- [ ] Change visibility to approved for repreneur.
- [ ] Remove document.

### Scope Boundaries

- [ ] No automatic PDF parsing.
- [ ] No full M&A CRM.
- [ ] No AI matching.
- [ ] No repreneur portal exposure yet.

## Findings

| Area | Result | Severity | Notes |
|------|--------|----------|-------|
| Environment | Not started | - | Same Supabase project selected; controlled migration plan pending execution. |

## Release Recommendation

Pending UAT.
