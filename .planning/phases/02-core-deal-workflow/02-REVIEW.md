---
gsd_type: code_review
phase: "02-core-deal-workflow"
phase_number: "02"
status: issues_found
depth: standard
files_reviewed: 34
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
reviewed_at: "2026-05-17T11:20:00Z"
review_scope: git diff 29fdefe7352f6bd7526378d838ab6d4550b9124c^..HEAD
---

# Code Review: Phase 02 Core Deal Workflow

## Scope

Reviewed source files changed in Phase 02:

- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/my-opportunities/[matchId]/page.tsx`
- `app/(dashboard)/my-opportunities/page.tsx`
- `app/(dashboard)/opportunities/[id]/page.tsx`
- `app/(dashboard)/opportunities/reviews/page.tsx`
- `app/auth/login/page.tsx`
- `app/page.tsx`
- `app/portal/deals/[matchId]/page.tsx`
- `app/portal/deals/page.tsx`
- `app/portal/layout.tsx`
- `app/portal/page.tsx`
- `app/portal/profile/page.tsx`
- `app/routing/page.tsx`
- `components/app-sidebar.tsx`
- `components/opportunities/opportunity-detail.tsx`
- `components/opportunities/opportunity-matches-panel.tsx`
- `components/opportunities/opportunity-response-review-table.tsx`
- `components/opportunities/repreneur-opportunity-detail.tsx`
- `components/opportunities/repreneur-opportunity-list.tsx`
- `components/portal/portal-shell.tsx`
- `components/portal/repreneur-profile-summary.tsx`
- `docs/PHASE2_UAT_RESULTS.md`
- `docs/V7_STATUS_UPDATE.md`
- `lib/access-control.ts`
- `lib/actions/opportunity-matches.ts`
- `lib/actions/repreneur-opportunities.ts`
- `lib/actions/repreneur-profile.ts`
- `lib/actions/repreneurs.ts`
- `lib/auth-server.ts`
- `lib/types/opportunity.ts`
- `middleware.ts`
- `scripts/046_create_opportunity_matches.sql`
- `scripts/047_create_app_user_roles.sql`
- `scripts/048_opportunity_active_pursuit_lock.sql`

## Findings

### WR-001: Generic match save can overwrite an active pursuit and silently release the lock

**Severity:** Warning  
**File:** `lib/actions/opportunity-matches.ts:201`  
**Related UI:** `components/opportunities/opportunity-matches-panel.tsx:123`

`saveOpportunityMatch` uses an upsert on `(opportunity_id, repreneur_id)` and writes the submitted `status` directly. The add-recommendation form still lists all repreneurs, including those that already have a match, and defaults status to `draft`.

That means a staff user can select the repreneur currently in `active_pursuit`, save the form, and overwrite the active row to `draft`, `shortlisted`, `proposed`, `interested`, `declined`, or `dropped` without using the explicit `Drop` flow. The database unique index only prevents a second active row; it does not preserve the current active row from being downgraded by this generic upsert.

This breaks the Phase 02 workflow guarantee that a validated pursuit is released through the deliberate drop/reopen path.

**Recommended fix:** Before upsert, fetch any existing match for `(opportunity_id, repreneur_id)`. If it is `active_pursuit`, reject generic saves and require `dropOpportunityPursuit`. Alternatively split create vs edit flows and exclude existing matches from the add form.

### WR-002: Active pursuits can be deleted directly from the recommendations table

**Severity:** Warning  
**File:** `lib/actions/opportunity-matches.ts:240`  
**Related UI:** `components/opportunities/opportunity-matches-panel.tsx:343`

`removeOpportunityMatch` deletes any match by id, and the recommendations table renders the trash action for every row, including `active_pursuit`.

Deleting the active match bypasses `dropOpportunityPursuit`, immediately releases the database lock, and removes the historical pursuit record instead of preserving it as `dropped`. This creates a second path around the staff decision gate and makes it harder to understand why a pursuit disappeared.

**Recommended fix:** Block deletion of `active_pursuit` in `removeOpportunityMatch`, and hide or disable the trash action for active rows with copy that directs staff to use `Drop` first.

## Notes

- The role split is enforced at the route-layout level for the new portal and dashboard shells.
- Repreneur-facing opportunity queries avoid selecting staff-only source/contact fields and raw staff descriptions.
- The active-pursuit partial unique index correctly protects against two simultaneous `active_pursuit` rows for the same opportunity.

