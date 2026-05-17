# Phase 1 UAT Results

**Status:** Not started
**Environment:** Separate Supabase test project
**Branch:** `codex/gsd-v2-phase1-20260516`
**Worktree:** `_worktrees/renew-platform-gsd-v2-phase1`

## Environment Decision

Approved by Ivan on 2026-05-17:

- Use a separate Supabase test project.
- Do not apply Phase 1 migrations to the current/shared Supabase database during Phase 1.1.
- Use fake or sanitized opportunity data for UAT.
- Keep secrets local and uncommitted.

## Migration Checklist

- [ ] Create or identify the Re-New test Supabase project.
- [ ] Confirm worktree `.env.local` points to the test project.
- [ ] Confirm no production/current Supabase credentials are used in the worktree.
- [ ] Apply `scripts/044_create_opportunities_foundation.sql`.
- [ ] Apply `scripts/045_setup_opportunity_documents_storage.sql`.
- [ ] Confirm app can connect to the test database.
- [ ] Confirm app can use the test storage bucket for opportunity documents.
- [ ] Confirm `git status --short` shows no committed secrets.

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
| Environment | Not started | - | Separate test Supabase selected; setup pending. |

## Release Recommendation

Pending UAT.
