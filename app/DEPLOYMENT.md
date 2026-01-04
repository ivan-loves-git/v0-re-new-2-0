# Re-New Platform Deployment Guide

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase project
- Vercel account (for hosting)
- Resend account (for emails)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Automation - Resend (Required for email features)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@your-domain.com
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Cron Jobs (Required for abandoned form reminders)
CRON_SECRET=your-random-secret-here
```

---

## Email System Setup

### 1. Get Resend API Key

1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Go to **API Keys** → **Create API Key**
3. Copy the key (starts with `re_`)
4. Add to `RESEND_API_KEY` in your environment

### 2. Configure Sender Email

**Option A: Use Resend's test sender (development only)**
```
RESEND_FROM_EMAIL=onboarding@resend.dev
```
This works immediately but:
- Only sends to your own email address
- Shows "via resend.dev" in recipient inbox
- Not suitable for production

**Option B: Verify your own domain (recommended for production)**
1. In Resend dashboard → **Domains** → **Add Domain**
2. Add the DNS records Resend provides (SPF, DKIM, DMARC)
3. Wait for verification (usually 5-15 minutes)
4. Update `RESEND_FROM_EMAIL` to use your domain:
   ```
   RESEND_FROM_EMAIL=noreply@re-new.com
   ```

### 3. Set Up Webhook Tracking (optional but recommended)

To track email opens, clicks, and bounces:

1. In Resend dashboard → **Webhooks** → **Add Webhook**
2. Endpoint URL: `https://your-domain.vercel.app/api/webhooks/resend`
3. Select events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`
4. Copy the signing secret
5. Add to `RESEND_WEBHOOK_SECRET` in Vercel environment variables

### 4. Database Migration

Run the email tables migration in Supabase SQL Editor:
```sql
-- File: scripts/013_create_email_tables.sql
-- Creates: email_templates, email_logs, intake_abandonment_tracking, email_daily_counts
```

---

## Vercel Deployment

### 1. Connect Repository

1. Import your GitHub repository in Vercel
2. Framework preset: Next.js
3. Root directory: `app`

### 2. Environment Variables

Add all variables from `.env.local` to Vercel:
- Go to Project Settings → Environment Variables
- Add each variable for Production (and Preview if needed)

### 3. Cron Jobs

The `vercel.json` file configures automatic cron jobs:
- **Abandoned form reminders**: Runs every 6 hours
- Requires `CRON_SECRET` to be set

To test the cron job manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/abandoned-forms
```

---

## Email Templates

10 automated email templates are configured:

| Template | Trigger | Type |
|----------|---------|------|
| Welcome | Step 1 of intake completed | Transactional |
| Form Step Complete | After step 1 (contact captured) | Marketing* |
| Abandoned Reminder | 48h after partial completion | Marketing* |
| Thank You | Full form completed | Transactional |
| High Score Alert | Tier 1 score >= 70 | Marketing* |
| Offer Received | Offer assigned to repreneur | Transactional |
| Milestone Completed | Any milestone marked complete | Transactional |
| Offer Accepted | Offer status = "accepted" | Transactional |
| Offer Activated | Offer status = "active" | Transactional |
| Rejection | Lifecycle status = "rejected" | Transactional |

*Marketing emails require `marketing_consent = true` on the repreneur record.

---

## Troubleshooting

### Emails not sending
1. Check `RESEND_API_KEY` is set correctly
2. Verify sender domain is verified (for custom domains)
3. Check email logs in Email Cockpit (`/emails`)
4. Look for errors in Vercel function logs

### Cron job not running
1. Verify `CRON_SECRET` is set in Vercel
2. Check Vercel dashboard → Cron Jobs tab
3. Test manually with curl command above

### Webhook events not updating
1. Verify `RESEND_WEBHOOK_SECRET` matches Resend dashboard
2. Check webhook endpoint is accessible (not blocked by auth)
3. Review Resend webhook logs for delivery attempts
