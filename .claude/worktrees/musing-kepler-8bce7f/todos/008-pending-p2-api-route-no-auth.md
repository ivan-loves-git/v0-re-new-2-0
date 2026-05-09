---
status: pending
priority: p2
issue_id: "008"
tags: [security, code-review]
dependencies: ["002"]
---

# API Route Missing Authentication Check

## Problem Statement

The `/api/repreneurs/[id]` endpoint returns repreneur data without verifying the user is logged in. Anyone who knows a repreneur ID could access their information.

**Why it matters (non-technical):** It's like having a filing cabinet where you can get any file by knowing its number, but no one checks if you work there. If someone guesses or finds a repreneur ID, they can see all that person's private information.

## Findings

**Location:** `app/api/repreneurs/[id]/route.ts`

**Evidence:**
```typescript
export async function GET(request: Request, { params }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("id", id)
    .single()

  // No authentication check before returning data!
  return NextResponse.json(data)
}
```

**Discovery:** security-sentinel agent

## Proposed Solutions

### Option A: Add Auth Check to Route (Recommended)
- **Pros:** Quick fix for this specific endpoint
- **Cons:** Need to add to every API route
- **Effort:** Small (15 min)
- **Risk:** None

### Option B: Rely on Middleware (if #002 is done)
- **Pros:** Centralized auth
- **Cons:** Depends on middleware being implemented first
- **Effort:** None (covered by middleware)
- **Risk:** Low

## Recommended Action

Do both - add auth check to route AND implement middleware for defense in depth.

## Technical Details

**Affected files:**
- `app/api/repreneurs/[id]/route.ts`

**Fix:**
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()

  // Add authentication check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}
```

## Acceptance Criteria

- [ ] Unauthenticated requests return 401 Unauthorized
- [ ] Authenticated requests work as before
- [ ] Invalid IDs return 404 Not Found

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security audit |

## Resources

- Security review from security-sentinel agent
