---
status: pending
priority: p1
issue_id: "004"
tags: [typescript, bug, code-review, critical]
dependencies: []
---

# Function Signature Mismatch - wasEmailSent

## Problem Statement

The `wasEmailSent` function is called with 3 arguments, but it only accepts 2. The third argument (24-hour window check) is silently ignored, meaning the abandoned form reminder feature doesn't work correctly.

**Why it matters (non-technical):** The system is supposed to check "was an email sent in the last 24 hours?" before sending a reminder. But because of this bug, it actually checks "was ANY email ever sent?" This means people who abandoned the form days ago won't get reminders, or people might get duplicate reminders.

## Findings

**Location:**
- Caller: `app/api/cron/abandoned-forms/route.ts` lines 75-78
- Definition: `lib/email/send-email.ts` lines 276-279

**Evidence:**
```typescript
// CALLER expects 3 arguments with time window:
const alreadySent = await wasEmailSent(
  repreneur.id,
  "abandoned_reminder",
  24 * 60 // 24 hour window - THIS IS IGNORED!
)

// DEFINITION only accepts 2 arguments:
export async function wasEmailSent(
  repreneurId: string,
  templateKey: EmailTemplateKey
): Promise<boolean>  // No third parameter for time window!
```

**Discovery:** kieran-typescript-reviewer agent

## Proposed Solutions

### Option A: Add Time Window Parameter (Recommended)
- **Pros:** Makes the feature work as intended
- **Cons:** Need to update function logic
- **Effort:** Small (30-45 min)
- **Risk:** Low

### Option B: Remove Third Argument from Caller
- **Pros:** Quick fix
- **Cons:** Loses the time-window functionality
- **Effort:** Small (5 min)
- **Risk:** None (but feature won't work as designed)

## Recommended Action

Option A - Update the function to accept and use the time window parameter

## Technical Details

**Affected files:**
- `lib/email/send-email.ts` - Update function signature and implementation
- `app/api/cron/abandoned-forms/route.ts` - Caller is already correct

**Fix for send-email.ts:**
```typescript
export async function wasEmailSent(
  repreneurId: string,
  templateKey: EmailTemplateKey,
  withinMinutes?: number
): Promise<boolean> {
  const supabase = createAdminClient()

  let query = supabase
    .from("email_logs")
    .select("id")
    .eq("repreneur_id", repreneurId)
    .eq("template_key", templateKey)

  // Add time filter if specified
  if (withinMinutes) {
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes)
    query = query.gte("sent_at", cutoffTime.toISOString())
  }

  const { data } = await query.limit(1)
  return (data?.length ?? 0) > 0
}
```

## Acceptance Criteria

- [ ] `wasEmailSent` accepts optional third parameter for time window
- [ ] When called with time window, only checks emails within that period
- [ ] When called without time window, checks all emails (backward compatible)
- [ ] Abandoned form reminder only sends if no reminder sent in last 24 hours
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during TypeScript audit |

## Resources

- TypeScript review from kieran-typescript-reviewer agent
