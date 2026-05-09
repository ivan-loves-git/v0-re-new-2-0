---
status: pending
priority: p1
issue_id: "002"
tags: [security, architecture, code-review, critical]
dependencies: []
---

# Missing Authentication Middleware

## Problem Statement

There is no `middleware.ts` file to protect dashboard routes. Authentication checks happen inside pages, not at the edge, which means unauthorized users might see partial page content or loading states before being redirected.

**Why it matters (non-technical):** It's like having a security guard inside each room instead of at the building entrance. Someone could walk through the lobby and hallways before being stopped. In your case, people might glimpse your CRM data before being kicked out.

## Findings

**Location:** Missing `/middleware.ts` file at project root

**Evidence:**
- Dashboard layout at `app/(dashboard)/layout.tsx` has comment: "Auth check is now handled by middleware"
- But no middleware.ts file exists
- Fallback code allows access when `VERCEL_ENV` is undefined

**Discovery:** security-sentinel + architecture-strategist agents

## Proposed Solutions

### Option A: Create Next.js Middleware (Recommended)
- **Pros:** Industry standard, blocks at edge before page renders
- **Cons:** Need to handle Supabase session properly
- **Effort:** Medium (1-2 hours)
- **Risk:** Low

### Option B: Keep Layout-Level Auth
- **Pros:** No change needed
- **Cons:** Not secure, pages partially render before redirect
- **Effort:** None
- **Risk:** HIGH (not recommended)

## Recommended Action

Option A - Create proper middleware.ts

## Technical Details

**File to create:** `middleware.ts` at project root

**Implementation:**
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/(dashboard)/:path*', '/repreneurs/:path*', '/pipeline/:path*', '/offers/:path*']
}
```

**Affected files:**
- New: `middleware.ts`
- Update: `app/(dashboard)/layout.tsx` (remove fallback code)

## Acceptance Criteria

- [ ] `middleware.ts` exists and runs on all dashboard routes
- [ ] Unauthenticated users are redirected to login immediately
- [ ] No partial page content visible before redirect
- [ ] Authenticated users can access all dashboard pages

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security + architecture audit |

## Resources

- [Next.js Middleware Docs](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
