---
status: pending
priority: p2
issue_id: "011"
tags: [performance, code-review]
dependencies: []
---

# Dashboard Fetches Data 3x (Duplicate Queries)

## Problem Statement

The dashboard page makes 3 separate database requests for the same repreneurs data in different components. This wastes database resources and slows down page load.

**Why it matters (non-technical):** Imagine asking someone "What time is it?" three times in a row instead of once. The dashboard asks the database for the same client list 3 times, making the page load slower and wasting server resources.

## Findings

**Location:** `app/(dashboard)/dashboard/page.tsx`

**Evidence:**
- Line ~100: `StatsAndTiersRow` fetches all repreneurs
- Line ~175: `MiddleRow` fetches all repreneurs AGAIN
- Line ~280: `ChartsRow` fetches repreneurs AGAIN

```typescript
// Each section does this independently:
const { data: repreneurs } = await supabase
  .from("repreneurs")
  .select("*")
  .order("created_at", { ascending: false })
```

**Discovery:** performance-oracle agent

**Impact:** 3x database roundtrips, ~200-400ms added latency

## Proposed Solutions

### Option A: Fetch Once at Page Level (Recommended)
- **Pros:** Simple, immediate improvement
- **Cons:** Need to restructure components to accept props
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

### Option B: Use React Cache
- **Pros:** No component restructuring needed
- **Cons:** More complex, cache management
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

## Recommended Action

Option A - Fetch data once and pass to child components

## Technical Details

**Affected files:**
- `app/(dashboard)/dashboard/page.tsx`
- `components/dashboard/stats-and-tiers-row.tsx`
- `components/dashboard/middle-row.tsx`
- `components/dashboard/charts-row.tsx`

**Approach:**
```typescript
// dashboard/page.tsx - fetch once
export default async function DashboardPage() {
  const supabase = await createServerClient()

  // Single fetch for all components
  const { data: repreneurs } = await supabase
    .from("repreneurs")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsAndTiersRow repreneurs={repreneurs} />
      </Suspense>
      <Suspense fallback={<MiddleSkeleton />}>
        <MiddleRow repreneurs={repreneurs} />
      </Suspense>
      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsRow repreneurs={repreneurs} />
      </Suspense>
    </div>
  )
}
```

## Acceptance Criteria

- [ ] Database is queried only once for repreneurs
- [ ] All dashboard components receive the same data
- [ ] Page load time reduced by ~200ms
- [ ] Dashboard functionality unchanged

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during performance audit |

## Resources

- Performance review from performance-oracle agent
