---
status: pending
priority: p1
issue_id: "005"
tags: [typescript, bug, code-review, critical]
dependencies: []
---

# Missing Type Property - requiresConsent

## Problem Statement

The `sendEmail` function is called with a `requiresConsent` property that doesn't exist in the type definition. TypeScript should catch this, but if it doesn't, the consent checking feature won't work.

**Why it matters (non-technical):** The system is supposed to check if someone agreed to receive marketing emails before sending them. But because the code uses a property that doesn't exist, this check might be silently skipped, potentially sending emails to people who didn't consent (which could violate GDPR).

## Findings

**Location:**
- Caller: `app/api/cron/abandoned-forms/route.ts` line 92
- Type: `lib/email/send-email.ts` lines 8-15

**Evidence:**
```typescript
// CALLER uses requiresConsent:
await sendEmail({
  to: repreneur.email,
  subject: "Reprenez votre inscription Re-New",
  repreneurId: repreneur.id,
  templateKey: "abandoned_reminder",
  requiresConsent: true,  // Property does NOT exist in type!
  react: AbandonedReminderEmail({...}),
})

// TYPE definition is missing this property:
interface SendEmailParams {
  to: string
  subject: string
  repreneurId: string
  templateKey: EmailTemplateKey
  react: ReactElement
  metadata?: Record<string, unknown>
  // Missing: requiresConsent?: boolean
}
```

**Discovery:** kieran-typescript-reviewer agent

## Proposed Solutions

### Option A: Add Property to Type and Implement Logic (Recommended)
- **Pros:** Makes consent checking work properly
- **Cons:** Need to implement the actual consent check
- **Effort:** Medium (1 hour)
- **Risk:** Low

### Option B: Remove Property from Caller
- **Pros:** Quick fix
- **Cons:** Loses consent checking functionality
- **Effort:** Small (5 min)
- **Risk:** Medium (GDPR compliance issue)

## Recommended Action

Option A - Add the property and implement consent checking

## Technical Details

**Affected files:**
- `lib/email/send-email.ts` - Add to interface and implement

**Fix:**
```typescript
interface SendEmailParams {
  to: string
  subject: string
  repreneurId: string
  templateKey: EmailTemplateKey
  react: ReactElement
  metadata?: Record<string, unknown>
  requiresConsent?: boolean  // Add this
}

export async function sendEmail(params: SendEmailParams) {
  // Add consent check at start of function
  if (params.requiresConsent) {
    const supabase = createAdminClient()
    const { data: repreneur } = await supabase
      .from("repreneurs")
      .select("marketing_consent")
      .eq("id", params.repreneurId)
      .single()

    if (!repreneur?.marketing_consent) {
      console.log(`Skipping email to ${params.repreneurId}: no marketing consent`)
      return { success: false, reason: "no_consent" }
    }
  }

  // ... rest of function
}
```

## Acceptance Criteria

- [ ] `SendEmailParams` interface includes `requiresConsent?: boolean`
- [ ] When `requiresConsent: true`, function checks repreneur's consent
- [ ] Email not sent if consent not given
- [ ] TypeScript compiles without errors
- [ ] GDPR-compliant email sending

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during TypeScript audit |

## Resources

- TypeScript review from kieran-typescript-reviewer agent
- GDPR Article 7 (Consent)
