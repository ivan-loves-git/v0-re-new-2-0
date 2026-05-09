---
status: pending
priority: p1
issue_id: "007"
tags: [data-integrity, bug, code-review, critical]
dependencies: []
---

# Non-Atomic Cascade Delete for Repreneurs

## Problem Statement

When deleting a repreneur, the code deletes related data (notes, offers, activities) one by one. If the final delete fails, the related data is already gone, leaving the database in a broken state.

**Why it matters (non-technical):** It's like tearing down parts of a building before confirming you have permission to demolish it. If something goes wrong midway, you're left with a half-demolished building. In your case, you could end up with orphaned data or a repreneur record stuck in the system after all their related info was already deleted.

## Findings

**Location:** `lib/actions/repreneurs.ts` lines 212-229

**Evidence:**
```typescript
// Deletes happen one by one - if any fail after others succeed, data is inconsistent
await supabase.from("notes").delete().eq("repreneur_id", id)
await supabase.from("repreneur_offers").delete().eq("repreneur_id", id)
await supabase.from("activities").delete().eq("repreneur_id", id)
const { error } = await supabase.from("repreneurs").delete().eq("id", id)
// Also missing: email_logs, intake_abandonment_tracking
```

**Discovery:** data-integrity-guardian + architecture-strategist agents

## Proposed Solutions

### Option A: Remove Manual Cascades, Rely on Database (Recommended)
- **Pros:** Database handles it atomically, simpler code
- **Cons:** Need to verify FK cascades are set up correctly
- **Effort:** Small (30 min to verify, then delete code)
- **Risk:** Low (need to check existing FKs first)

### Option B: Wrap in Database Transaction via RPC
- **Pros:** Full control, atomic operation
- **Cons:** More complex, need SQL function
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

## Recommended Action

Option A - The database already has `ON DELETE CASCADE` on foreign keys. Remove the manual deletions and let the database handle it properly.

## Technical Details

**Affected files:**
- `lib/actions/repreneurs.ts`

**Current cascade FKs (verify these exist):**
- `notes.repreneur_id` -> `repreneurs.id` ON DELETE CASCADE
- `repreneur_offers.repreneur_id` -> `repreneurs.id` ON DELETE CASCADE
- `activities.repreneur_id` -> `repreneurs.id` ON DELETE CASCADE
- `email_logs.repreneur_id` -> `repreneurs.id` ON DELETE CASCADE (need to verify)

**Simplified code:**
```typescript
export async function deleteRepreneur(id: string) {
  const supabase = await createServerClient()

  // Database cascades handle related data automatically
  const { error } = await supabase
    .from("repreneurs")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)

  revalidatePath("/repreneurs")
  revalidatePath("/pipeline")
}
```

## Acceptance Criteria

- [ ] Verify all child tables have `ON DELETE CASCADE`
- [ ] Remove manual cascade deletions from code
- [ ] Deleting a repreneur removes all related data atomically
- [ ] No orphaned records after deletion
- [ ] Deletion either fully succeeds or fully fails

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during data integrity audit |

## Resources

- Data integrity review from data-integrity-guardian agent
- Architecture review from architecture-strategist agent
