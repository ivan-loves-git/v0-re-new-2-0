---
status: pending
priority: p2
issue_id: "014"
tags: [performance, code-review]
dependencies: []
---

# No Pagination on Repreneurs/Pipeline Lists

## Problem Statement

The repreneurs and pipeline pages fetch ALL records without any limit. As the database grows, these pages will become very slow.

**Why it matters (non-technical):** Right now with 50 clients, loading the page takes 1 second. With 500 clients, it might take 5 seconds. With 5,000 clients, it could take 30+ seconds. Users will think the app is broken. Pagination shows data in chunks (like Google search results with pages) to keep things fast.

## Findings

**Location:**
- `app/(dashboard)/pipeline/page.tsx` lines 16-25
- `app/(dashboard)/repreneurs/page.tsx`

**Evidence:**
```typescript
const { data: repreneurs } = await supabase
  .from("repreneurs")
  .select(`*, repreneur_offers(offer:offers(name))`)
  .order("created_at", { ascending: false })
  // No .limit() or .range() !
```

**Discovery:** performance-oracle agent

**Projected impact:**
- 100 repreneurs: ~500ms (OK)
- 1,000 repreneurs: ~2 seconds (slow)
- 5,000 repreneurs: ~10+ seconds (unusable)

## Proposed Solutions

### Option A: Server-Side Pagination (Recommended)
- **Pros:** Handles any scale
- **Cons:** Need to add pagination UI
- **Effort:** Medium (2-3 hours)
- **Risk:** Low

### Option B: Virtual Scrolling
- **Pros:** Seamless UX
- **Cons:** More complex, needs client-side library
- **Effort:** High (4-6 hours)
- **Risk:** Medium

### Option C: Limit to Recent Records
- **Pros:** Quick fix
- **Cons:** Users can't see older records
- **Effort:** Small (30 min)
- **Risk:** Low (may frustrate users)

## Recommended Action

Start with Option C as immediate fix, then implement Option A properly

## Technical Details

**Quick fix (Option C):**
```typescript
const { data: repreneurs } = await supabase
  .from("repreneurs")
  .select(`*, repreneur_offers(offer:offers(name))`)
  .order("created_at", { ascending: false })
  .limit(100)  // Add limit for now
```

**Proper fix (Option A) - Add pagination:**
```typescript
// In page.tsx
const page = searchParams.page ? parseInt(searchParams.page) : 1
const pageSize = 50
const offset = (page - 1) * pageSize

const { data: repreneurs, count } = await supabase
  .from("repreneurs")
  .select(`*, repreneur_offers(offer:offers(name))`, { count: 'exact' })
  .order("created_at", { ascending: false })
  .range(offset, offset + pageSize - 1)

const totalPages = Math.ceil((count || 0) / pageSize)
```

## Acceptance Criteria

- [ ] Repreneurs page loads in <1 second regardless of data size
- [ ] Pipeline page loads in <1 second regardless of data size
- [ ] Users can navigate to view all records (if pagination implemented)
- [ ] UI shows total count and current page

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during performance audit |

## Resources

- Performance review from performance-oracle agent
- [Supabase Pagination](https://supabase.com/docs/reference/javascript/range)
