---
status: pending
priority: p2
issue_id: "013"
tags: [typescript, code-quality, code-review]
dependencies: []
---

# Widespread Use of `any` Type

## Problem Statement

Over 10 files use TypeScript's `any` type, which disables type checking and can hide bugs until runtime.

**Why it matters (non-technical):** TypeScript is like a spell-checker for code - it catches mistakes before they cause problems. Using `any` is like turning off the spell-checker for certain words. You might not notice typos until a user encounters a bug.

## Findings

**Location:** Multiple files

| File | Line | Code |
|------|------|------|
| `app/(dashboard)/repreneurs/[id]/page.tsx` | 104 | `Record<string, any[]>, m: any` |
| `app/(dashboard)/repreneurs/[id]/page.tsx` | 123 | `notes.map((note: any)` |
| `app/(dashboard)/repreneurs/[id]/page.tsx` | 135 | `activities.map((activity: any)` |
| `app/(dashboard)/pipeline/page.tsx` | 27-30 | `(r: any)`, `(ro: any)` |
| `app/(dashboard)/repreneurs/page.tsx` | 30-33 | `(r: any)`, `(ro: any)` |
| `lib/actions/activities.ts` | 57 | `(activity: any)` |
| `app/(dashboard)/dashboard/page.tsx` | 236 | `(a: any)` |

**Discovery:** kieran-typescript-reviewer agent

## Proposed Solutions

### Option A: Generate Supabase Types (Recommended)
- **Pros:** Auto-generated, always in sync with database
- **Cons:** Setup time, need to regenerate when schema changes
- **Effort:** Medium (2 hours initial, 5 min per update)
- **Risk:** None

### Option B: Create Manual Interfaces
- **Pros:** Can do incrementally
- **Cons:** Can drift from database schema
- **Effort:** Medium (spread over time)
- **Risk:** Low

## Recommended Action

Option A first, then replace `any` with generated types

## Technical Details

**Step 1: Generate Supabase types**
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/types/database.ts
```

**Step 2: Create helper types**
```typescript
// lib/types/database.ts (generated, then add helpers)
import { Database } from './database'

export type Repreneur = Database['public']['Tables']['repreneurs']['Row']
export type Note = Database['public']['Tables']['notes']['Row']
export type Activity = Database['public']['Tables']['activities']['Row']
export type RepreneurOffer = Database['public']['Tables']['repreneur_offers']['Row']
```

**Step 3: Replace any types**
```typescript
// Before:
notes.map((note: any) => ...)

// After:
notes.map((note: Note) => ...)
```

**Files to update:**
- `app/(dashboard)/repreneurs/[id]/page.tsx`
- `app/(dashboard)/pipeline/page.tsx`
- `app/(dashboard)/repreneurs/page.tsx`
- `lib/actions/activities.ts`
- `app/(dashboard)/dashboard/page.tsx`

## Acceptance Criteria

- [ ] Supabase types generated and committed
- [ ] All `any` replaced with proper types
- [ ] TypeScript compiles with strict mode
- [ ] No new `any` added without justification

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during TypeScript audit |

## Resources

- TypeScript review from kieran-typescript-reviewer agent
- [Supabase Type Generation](https://supabase.com/docs/guides/api/generating-types)
