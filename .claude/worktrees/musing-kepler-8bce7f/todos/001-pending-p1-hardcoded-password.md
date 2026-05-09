---
status: pending
priority: p1
issue_id: "001"
tags: [security, code-review, critical]
dependencies: []
---

# Hardcoded Password in Login Page

## Problem Statement

The production password `Wave2025!` is hardcoded in client-side JavaScript code. Anyone viewing the page source can see this password and log into the system.

**Why it matters (non-technical):** It's like writing your house key code on a sign outside your door. Anyone who visits the website can find the password and access all your client data.

## Findings

**Location:** `app/auth/login/page.tsx` lines 294-295

```typescript
setSelectedUser(member.email)
setEmail(member.email)
setPassword("Wave2025!")
```

**Discovery:** security-sentinel agent

**Evidence:** The "Quick Access" feature for team members pre-fills the password field with the actual production password, which is visible in the JavaScript bundle.

## Proposed Solutions

### Option A: Remove Quick Access Feature (Recommended)
- **Pros:** Simple, completely eliminates the risk
- **Cons:** Team needs to type password each time
- **Effort:** Small (15 min)
- **Risk:** None

### Option B: Use Magic Links Instead
- **Pros:** Better UX, more secure
- **Cons:** Requires Supabase magic link setup
- **Effort:** Medium (2-3 hours)
- **Risk:** Low

### Option C: Move to Environment Variable
- **Pros:** Password not in code
- **Cons:** Still exposed in client bundle if used client-side
- **Effort:** Small
- **Risk:** Medium (doesn't fully solve the problem)

## Recommended Action

Option A - Remove the Quick Access feature entirely before any public deployment.

## Technical Details

**Affected files:**
- `app/auth/login/page.tsx`

**Changes needed:**
1. Remove the `teamMembers` array or remove password auto-fill
2. Remove the `handleQuickLogin` function that sets the password

## Acceptance Criteria

- [ ] Password `Wave2025!` does not appear anywhere in client-side code
- [ ] Quick Access buttons removed or modified to not include password
- [ ] Team can still log in using normal email/password flow

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security audit |

## Resources

- Security audit report from security-sentinel agent
