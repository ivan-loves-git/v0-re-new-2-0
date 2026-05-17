# Phase 1 UAT Results

**Status:** Not started
**Environment:** TBD
**Branch:** `codex/gsd-v2-phase1-20260516`
**Worktree:** `_worktrees/renew-platform-gsd-v2-phase1`

## Environment Decision

Pending Ivan decision:

1. Separate test Supabase project.
2. Current Supabase with manual backup.
3. Local UI-only check.

## Migration Checklist

- [ ] Confirm target database.
- [ ] Confirm backup/rollback route.
- [ ] Apply `scripts/044_create_opportunities_foundation.sql`.
- [ ] Apply `scripts/045_setup_opportunity_documents_storage.sql`.
- [ ] Confirm app can connect to the target database.

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
| Environment | Not started | - | - |

## Release Recommendation

Pending UAT.
