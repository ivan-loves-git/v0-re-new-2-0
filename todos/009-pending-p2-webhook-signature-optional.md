---
status: pending
priority: p2
issue_id: "009"
tags: [security, code-review]
dependencies: []
---

# Webhook Signature Verification is Optional

## Problem Statement

The Resend webhook endpoint only verifies signatures if `RESEND_WEBHOOK_SECRET` is configured. If the secret is missing, anyone can send fake webhook events to manipulate email tracking data.

**Why it matters (non-technical):** Webhooks are like delivery notifications - "email was delivered" or "email was opened." If someone can send fake notifications, they could make it look like emails were delivered when they weren't, or mess up your email statistics.

## Findings

**Location:** `app/api/webhooks/resend/route.ts` lines 51-55

**Evidence:**
```typescript
// Verification is SKIPPED if secret not configured!
if (webhookSecret && !verifyWebhookSignature(payload, signature, webhookSecret)) {
  console.error("Invalid webhook signature")
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
}
// If webhookSecret is undefined, this check is bypassed entirely
```

**Discovery:** security-sentinel agent

## Proposed Solutions

### Option A: Make Signature Verification Mandatory (Recommended)
- **Pros:** Prevents fake webhooks
- **Cons:** Webhook won't work until secret is configured
- **Effort:** Small (15 min)
- **Risk:** None

## Recommended Action

Option A - Require the webhook secret

## Technical Details

**Affected files:**
- `app/api/webhooks/resend/route.ts`

**Fix:**
```typescript
export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  // Make secret mandatory
  if (!webhookSecret) {
    console.error("RESEND_WEBHOOK_SECRET not configured")
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    )
  }

  const payload = await request.text()
  const signature = request.headers.get("svix-signature")

  if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
    console.error("Invalid webhook signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // ... rest of handler
}
```

**Environment variable to set:**
- Add `RESEND_WEBHOOK_SECRET` to Vercel environment variables
- Get value from Resend dashboard > Webhooks > Signing Secret

## Acceptance Criteria

- [ ] Webhook returns 500 if secret not configured
- [ ] Invalid signatures return 401
- [ ] Valid webhooks from Resend are processed correctly
- [ ] `RESEND_WEBHOOK_SECRET` is set in Vercel

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during security audit |

## Resources

- Security review from security-sentinel agent
- [Resend Webhook Security](https://resend.com/docs/dashboard/webhooks/introduction)
