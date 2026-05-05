# Re-New Platform Project

## ⚠️ CRITICAL: Claude's Role
**Claude is the lead architect and technical guide for this project.**

Ivan is a business/product person, NOT a developer. Claude must:
- **Be proactive**: Don't wait for Ivan to ask - anticipate what's needed
- **Guide the process**: Tell Ivan what to do next, don't assume he knows
- **Validate before advancing**: NEVER mark tasks "done" without testing the actual app
- **Be critical**: Point out problems, risks, and missing pieces early
- **Explain simply**: No jargon, clear steps, assume zero dev knowledge
- **Test everything**: Before moving to new features, verify existing ones work

**Anti-patterns to avoid:**
- Marking tasks done based on code existing (must test in browser)
- Assuming Ivan knows dev workflows (npm, env vars, deployment)
- Moving forward without validating the foundation works

## Project Context
- **What:** Internal CRM replacing Flatchr ATS for managing repreneurs
- **Timeline:** 8-10 FTE working days
- **Client:** Re-New (Bertrand + 2 part-time team members)
- **Ivan's role:** Product owner, non-technical

## Tech Stack
- **Frontend:** Next.js 16 + Tailwind + shadcn/ui
- **Backend/Database:** Supabase (PostgreSQL + API) - uses service role key (bypasses RLS)
- **Hosting:** Vercel (Hobby plan)
- **Auth:** Better Auth (email/password) - NOT Supabase Auth

## Project Structure (Cleaned Jan 2026)
```
emba--renew-platform/
├── app/                 # Next.js App Router (routes only)
│   ├── (dashboard)/     # Dashboard routes (repreneurs, pipeline, offers, emails, guide, etc.)
│   ├── api/             # API routes
│   ├── auth/            # Login/error pages
│   ├── intake/          # Public intake form
│   ├── layout.tsx
│   └── page.tsx
├── components/          # React components (single source of truth)
├── lib/                 # Utilities, actions, email templates
├── public/              # Static assets
├── scripts/             # SQL migrations
├── supabase/            # Supabase config
├── package.json
├── tsconfig.json
├── vercel.json          # Cron jobs config
└── .env.local           # Secrets (not in git)
```

## Deployment (Vercel)
- **GitHub Repo:** `ivan-loves-git/v0-re-new-2-0`
- **Production URL:** `app.re-new.team`
- **Deploy Hook (manual trigger):**
  ```bash
  curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c/bOKHVh8XZL"
  ```
- **Cron Jobs:** Daily at 9 AM (Hobby plan limits to once/day)
- **Backup Branch:** `backup/pre-restructure-20260104`

## Environment Variables (Quick Reference)
| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_SHOW_TEST_AUTOFILL` | Show autofill/test buttons on public intake form (`/intake-v2`) | `false` (off) |

To enable test mode on the intake form: add `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` to `.env.local` and restart dev server. This shows yellow "Autofill" buttons on each form step for quick testing with dummy data. **Must be off in production** (it is off by default since build 335).

## Task Management

Per-project work → `TASKS.md` in this folder. Cross-session items Ivan is tracking → `/to-COS`. Never use Claude Code's native TaskCreate/TaskList (retired 2026-04-23).

## Open Questions (Waiting on Bertrand)
- Notes structure: free text vs structured (call/email/meeting + outcome)
- Flatchr export format and fields
- Current offers/packages details
- Repreneur acquisition journey mapping

## Data Model Summary
- **Repreneur:** Profile with lifecycle status (lead/qualified/client)
- **Offer:** Consulting packages (price, duration, hours included)
- **Repreneur_Offer:** Junction tracking offer status per repreneur
- **Note:** Free-text notes with author tracking

## Verification

After code changes:
```bash
npm run build && npm run lint
```
Fix root causes, don't suppress errors.

## Git workflow

GitHub is the project's memory. Commit format, types, push-immediately rule, browser testing constraints, build-number reporting → `docs/commit-style.md`.

## Roadmap updates

In-app roadmap (`/guide/roadmap`) documents milestones for the Re-New team. When to update, how to update, entry format, founder-friendly language → `docs/roadmap-workflow.md`.

## Wavy — team communications

Wavy is the platform's AI mascot for internal team updates. Always test-send to `ivanpaudice@me.com` first; only after Ivan confirms, send to team.

| Item | Location |
|------|----------|
| Personality + voice | `docs/communications/WAVY.md` |
| Email template rules | `docs/communications/PRODUCT_UPDATE_TEMPLATE.md` |
| Sent archive | `docs/emails-sent/` |
| Send script | `scripts/send-roadmap-email.ts` |
| Team list | `lib/distribution-lists.ts` |
