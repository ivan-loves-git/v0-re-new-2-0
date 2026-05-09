---
status: pending
priority: p1
issue_id: "006"
tags: [data-integrity, bug, code-review, critical]
dependencies: []
---

# Race Condition in Daily Email Counter

## Problem Statement

When two emails are sent at the same time, they might both read the same count, both add 1, and both write the same number back. This means one email doesn't get counted, and you could exceed your daily email limit.

**Why it matters (non-technical):** Imagine two cashiers at a store both check the inventory at 10 items, both sell 1 item and write "9 items left." Now the computer thinks there are 9 items, but really there are only 8. In your case, this means the daily email count could be wrong, letting you accidentally send more emails than your limit allows.

## Findings

**Location:** `lib/email/send-email.ts` lines 36-61

**Evidence:**
```typescript
// Read current count
const { data: existing } = await supabase
  .from("email_daily_counts")
  .select("count")
  .eq("date", today)
  .single()

// Write new count (not atomic!)
if (existing) {
  await supabase
    .from("email_daily_counts")
    .update({ count: existing.count + 1 })  // Race condition here!
    .eq("date", today)
}
```

**Discovery:** data-integrity-guardian agent

## Proposed Solutions

### Option A: Use Database Atomic Increment (Recommended)
- **Pros:** Guaranteed accurate, no race condition possible
- **Cons:** Need to create/use RPC function
- **Effort:** Medium (1 hour)
- **Risk:** None

### Option B: Use UPSERT with count = count + 1
- **Pros:** Single SQL statement, atomic
- **Cons:** Supabase JS syntax is tricky
- **Effort:** Small (30 min)
- **Risk:** Low

## Recommended Action

Option A - Use Supabase RPC for atomic increment

## Technical Details

**Affected files:**
- `lib/email/send-email.ts`
- New SQL function in Supabase

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION increment_email_count(target_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO email_daily_counts (date, count)
  VALUES (target_date, 1)
  ON CONFLICT (date)
  DO UPDATE SET count = email_daily_counts.count + 1;
END;
$$ LANGUAGE plpgsql;
```

**Updated TypeScript:**
```typescript
async function incrementDailyCount() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.rpc("increment_email_count", {
    target_date: today
  })

  if (error) {
    console.error("Failed to increment email count:", error)
  }
}
```

## Acceptance Criteria

- [ ] Email counter uses atomic database operation
- [ ] Concurrent emails both get counted correctly
- [ ] Daily limit enforcement is accurate
- [ ] No duplicate or missing counts

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during data integrity audit |

## Resources

- Data integrity review from data-integrity-guardian agent
- [PostgreSQL UPSERT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
