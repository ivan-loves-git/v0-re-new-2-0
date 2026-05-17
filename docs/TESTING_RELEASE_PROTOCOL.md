# Re-New Testing and Release Protocol

**Status:** Approved direction for Phase 1.1
**Decision:** Option A selected - separate Supabase test project.
**Owner:** Ivan approves product risk. Codex/Claude execute technical setup and testing.
**Purpose:** Prevent Re-New from mixing product development, database changes, and release decisions in the same informal step.

## Simple Mental Model

The product has three different things:

1. **Code**: screens, logic, routes, and components. GitHub can roll this back.
2. **Database**: real records and table structure. Supabase backup/restore or rollback SQL protects this.
3. **Release**: the moment a tested branch becomes part of the app people use.

Worktrees are for code isolation. They do not automatically isolate the database.

## Locked Environment Policy

### Selected Path: Separate Test Supabase

Use a dedicated Supabase project for fake data and migration testing.

**Rules**
- Phase 1 migrations are applied first to the test Supabase project only.
- The current/shared Supabase database is not touched during Phase 1.1.
- The worktree `.env.local` must point to the test Supabase project before the app is started for UAT.
- Real secrets stay local and are never committed.
- Test records can be fake, minimal, and disposable.

**Why this path**
- It is the safest option.
- We can create, edit, import, attach, and delete fake opportunities freely.
- Mistakes do not touch real Re-New data.
- It creates the professional habit we need before Phase 2 adds repreneur-facing workflow.

**Known tradeoff**
- Setup takes longer than using the current database.
- Test data may differ from production unless we deliberately copy safe samples.
- We need one separate set of Supabase credentials for the test project.

## Rejected Paths For Phase 1.1

### Current Supabase With Manual Backup

This is faster, but it can pollute or damage real/shared data. We are not using it for Phase 1.1.

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
- Test Supabase project exists.
- `.env.local` in the worktree points to the test Supabase project.
- `scripts/044_create_opportunities_foundation.sql` is applied to the test project.
- `scripts/045_setup_opportunity_documents_storage.sql` is applied to the test project.
- Worktree app can run on `http://localhost:3011` against the test project.
- `git status --short` confirms no secrets were committed.

### Gate 2: UAT Passed

Pass when:
- UAT checklist is completed.
- Issues are classified as blocker, fix-before-merge, or acceptable follow-up.
- Any blocker is fixed and retested.

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
- Apply migrations to the separate test Supabase project once credentials are available.
- Start the worktree app against the test project.
- Run technical checks and record UAT findings.

## What Requires Ivan Approval

- Supplying or approving test Supabase credentials.
- Deciding whether UAT findings block merge or become follow-up tasks.
- Approving push/PR/merge.
- Approving any later production database migration.
