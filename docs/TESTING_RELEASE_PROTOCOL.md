# Re-New Testing and Release Protocol

**Status:** Draft for Phase 1.1
**Owner:** Ivan decides product risk. Codex/Claude execute technical setup and testing.
**Purpose:** Prevent Re-New from mixing product development, database changes, and release decisions in the same informal step.

## Simple Mental Model

The product has three different things:

1. **Code**: screens, logic, routes, and components. GitHub can roll this back.
2. **Database**: real records and table structure. Supabase backup/restore or rollback SQL protects this.
3. **Release**: the moment a tested branch becomes part of the app people use.

Worktrees are for code isolation. They do not automatically isolate the database.

## Environment Options

### Option A: Separate Test Supabase

Use a dedicated Supabase project for fake data and migration testing.

**Pros**
- Safest option.
- We can create/delete fake opportunities freely.
- Mistakes do not touch real Re-New data.
- Best foundation for a professional process.

**Cons**
- Requires setup time.
- Needs separate `.env.local` values.
- Test data may differ from production unless we deliberately copy samples.

**Recommendation:** Best default for Re-New now.

### Option B: Current Supabase With Manual Backup

Use the existing database after taking a manual backup and confirming it is acceptable to touch.

**Pros**
- Faster.
- Tests against the real app configuration.
- Less environment maintenance.

**Cons**
- Higher risk.
- Test records can pollute real data.
- Rollback is heavier than Git rollback.
- A bad migration may require downtime or manual cleanup.

**Recommendation:** Acceptable only if the database is still prototype-level or the team explicitly accepts the risk.

### Option C: Local UI Only

Run the app without applying database migrations.

**Pros**
- No database risk.
- Useful for checking whether pages visually load.

**Cons**
- Not enough for Phase 1 because create/edit/import/documents depend on the database.
- Gives false confidence.

**Recommendation:** Not sufficient for release validation.

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
- Approved database/environment is documented.
- Backup/rollback route is documented.
- Worktree app can run against the chosen environment.

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
- Production migration order is known.
- Rollback notes exist.
- Team knows what changed and what did not change.

## Default Rule

Do not start Phase 2 product features until Phase 1 has passed the test environment and UAT gate.

