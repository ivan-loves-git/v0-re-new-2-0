# Re-New Testing and Release Protocol

**Status:** Approved direction for Phase 1.1
**Decision:** Same Supabase project selected - controlled additive testing.
**Owner:** Ivan approves product risk. Codex/Claude execute technical setup and testing.
**Purpose:** Prevent Re-New from mixing product development, database changes, and release decisions in the same informal step.

## Simple Mental Model

The product has three different things:

1. **Code**: screens, logic, routes, and components. GitHub can roll this back.
2. **Database**: real records and table structure. Supabase backup/restore or rollback SQL protects this.
3. **Release**: the moment a tested branch becomes part of the app people use.

Worktrees are for code isolation. They do not automatically isolate the database.

## Locked Environment Policy

### Selected Path: Same Supabase Project, Controlled Migration

Use the current Re-New Supabase project for Phase 1.1 because creating another Supabase project would add cost.

**Rules**
- Phase 1.1 is treated as a controlled production-style migration, not a disposable sandbox.
- Only the reviewed additive Phase 1 migrations may be applied: `scripts/044_create_opportunities_foundation.sql` and `scripts/045_setup_opportunity_documents_storage.sql`.
- No destructive SQL is allowed in Phase 1.1: no dropping existing tables, dropping existing columns, or deleting existing non-UAT data.
- Before migration, the target Supabase project URL/ref must be confirmed and recorded without secrets.
- Before migration, the available backup route must be confirmed. If no dashboard backup is available, create a manual logical dump with Supabase CLI/connection string where possible, or record the accepted risk before proceeding.
- UAT data must be clearly marked with `UAT-` references and/or `imported_from = 'phase-1.1-uat'`.
- UAT cleanup must be planned before fake records are created.
- The worktree `.env.local` may point to the current Supabase project only because Ivan explicitly approved this on 2026-05-17.
- Real secrets stay local and are never committed.
- Phase 2 remains blocked until Phase 1.1 migration, UAT, and cleanup/release notes are complete.

**Why this path**
- It avoids paying for another Supabase project.
- It keeps the process simple enough to execute now.
- The Phase 1 migrations are additive, so the risk is lower than a destructive schema change.
- It still creates a professional release habit before Phase 2 adds repreneur-facing workflow.

**Known tradeoff**
- This is not a true isolated test environment.
- GitHub cannot undo database changes.
- Backup/rollback and UAT cleanup matter more because the current/shared database is involved.

## Rejected Paths For Phase 1.1

### Separate Supabase Test Project

This is the cleanest professional setup, but it currently adds Supabase cost. We are not using it for Phase 1.1.

### Local Docker Supabase

This avoids touching the shared database, but it adds technical setup complexity. Ivan rejected this as overcomplicated for now.

### Local UI Only

This is useful for quick visual checks, but it is not enough because Phase 1 depends on database migrations, import, and document storage.

## Roles

**Ivan**
- Chooses the environment risk level.
- Tests whether the workflow makes product sense.
- Approves push/PR/merge/release.

**Codex/Claude**
- Prepare the worktree.
- Apply migrations only to the approved environment.
- Create fake test data.
- Run checks and document results.
- Fix issues in the worktree branch.

**Team / Bertrand**
- Validates whether the fields, import behavior, and scope boundaries match operational reality.

## Phase 1 UAT Checklist

### Opportunity Management

- Create an opportunity manually.
- Edit all locked June fields: reference, source, location, sector, description, revenue, EBITDA, headcount, date added.
- Archive an opportunity.
- Confirm opportunity status and visibility badges are understandable.

### Staff-Only vs Repreneur-Visible

- Confirm M&A source/contact appears only in the staff-only area.
- Confirm repreneur-visible section uses public title/anonymized description.
- Confirm no source details leak into repreneur-visible content.

### Import Review

- Export a small sample from Bertrand's workbook as CSV or TSV.
- Preview import rows.
- Confirm valid rows, warnings, and blockers are visible.
- Commit only approved valid rows.

### Documents

- Attach one teaser/PDF to an opportunity.
- Confirm the default visibility is staff-only.
- Change visibility to approved for repreneur.
- Remove a document.

### Scope Boundaries

- Confirm no automatic PDF parsing exists.
- Confirm no full M&A CRM exists.
- Confirm no AI matching exists in Phase 1.
- Confirm no repreneur portal exposure exists yet.

## Release Decision Gates

### Gate 1: Test Environment Ready

Pass when:
- Ivan's same-project approval is recorded.
- Target Supabase URL/ref is confirmed as the intended current Re-New project.
- Backup/rollback route is recorded before migration.
- `scripts/044_create_opportunities_foundation.sql` is applied to the approved Supabase project.
- `scripts/045_setup_opportunity_documents_storage.sql` is applied to the approved Supabase project.
- Worktree app can run on `http://localhost:3011` against the approved project.
- `git status --short` confirms no secrets were committed.

### Gate 2: UAT Passed

Pass when:
- UAT checklist is completed.
- Issues are classified as blocker, fix-before-merge, or acceptable follow-up.
- Any blocker is fixed and retested.
- Fake UAT records are either cleaned up or intentionally kept with `UAT-` labels.

### Gate 3: Merge Ready

Pass when:
- Branch is pushed.
- PR describes scope and deferred items.
- Ivan approves merge.

### Gate 4: Release Ready

Pass when:
- Production migration order is known and reviewed.
- Rollback notes exist.
- Team knows what changed and what did not change.

## Default Rule

Do not start Phase 2 product features until Phase 1 has passed the test environment and UAT gate.

## What Codex Can Do Without More Product Decisions

- Create/update the GSD plan.
- Prepare local test configuration templates.
- Confirm the reviewed migrations are additive.
- Apply migrations to the approved same Supabase project once the connection path is available.
- Start the worktree app against the approved project.
- Run technical checks and record UAT findings.

## What Requires Ivan Approval

- Supplying or approving current Supabase credentials/connection path.
- Deciding whether UAT findings block merge or become follow-up tasks.
- Approving push/PR/merge.
- Approving any later production database migration.
