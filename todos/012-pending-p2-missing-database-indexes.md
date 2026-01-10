---
status: pending
priority: p2
issue_id: "012"
tags: [performance, database, code-review]
dependencies: []
---

# Missing Database Indexes

## Problem Statement

The database is missing indexes on columns that are frequently filtered or sorted. As data grows, queries will slow down significantly.

**Why it matters (non-technical):** Imagine a library where books are just piled randomly. Finding a book means looking through every single one. An index is like a card catalog - it lets you find things quickly. Right now, some of your "card catalogs" are missing, so as your data grows, searches get slower and slower.

## Findings

**Discovery:** performance-oracle agent

**Missing indexes based on query patterns:**
1. `activities` - queries filter by `repreneur_id` AND sort by `created_at`
2. `notes` - same pattern
3. `email_logs` - queries filter by `sent_at` AND `status`
4. `repreneurs` - queries filter by `lifecycle_status` AND sort by `created_at`

**Impact:**
- 100 records: ~10ms queries (OK)
- 1,000 records: ~50ms queries (noticeable)
- 10,000 records: ~500ms+ queries (slow)

## Proposed Solutions

### Option A: Add Composite Indexes (Recommended)
- **Pros:** Significant query speedup
- **Cons:** Slightly slower writes (negligible)
- **Effort:** Small (30 min)
- **Risk:** None

## Recommended Action

Option A - Add indexes via SQL migration

## Technical Details

**New migration file:** `scripts/020_add_performance_indexes.sql`

```sql
-- Index for activity queries (filter by repreneur, sort by date)
CREATE INDEX IF NOT EXISTS idx_activities_repreneur_created
ON public.activities(repreneur_id, created_at DESC);

-- Index for notes queries (filter by repreneur, sort by date)
CREATE INDEX IF NOT EXISTS idx_notes_repreneur_created
ON public.notes(repreneur_id, created_at DESC);

-- Index for email log queries (filter by status and date)
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_status
ON public.email_logs(sent_at DESC, status);

-- Index for email log analytics by template
CREATE INDEX IF NOT EXISTS idx_email_logs_template
ON public.email_logs(template_key);

-- Index for repreneur filtering and sorting
CREATE INDEX IF NOT EXISTS idx_repreneurs_lifecycle_created
ON public.repreneurs(lifecycle_status, created_at DESC);

-- Index for repreneur email lookups (intake duplicate check)
CREATE INDEX IF NOT EXISTS idx_repreneurs_email
ON public.repreneurs(email);
```

**To run:**
Execute this SQL in Supabase Dashboard > SQL Editor

## Acceptance Criteria

- [ ] All indexes created successfully
- [ ] Query performance improved (measure before/after)
- [ ] No impact on application functionality
- [ ] Indexes visible in Supabase table info

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during performance audit |

## Resources

- Performance review from performance-oracle agent
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
