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
- **Backend/Database:** Supabase (PostgreSQL + Auth + API)
- **Hosting:** Vercel (Hobby plan)
- **Auth:** Email/password (users created manually in Supabase)

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
- **Production URL:** `v0-re-new-2-0.vercel.app`
- **Deploy Hook (manual trigger):**
  ```bash
  curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_oCfBq06JCw4KKkPeMGrHX9M7Jt4c/bOKHVh8XZL"
  ```
- **Cron Jobs:** Daily at 9 AM (Hobby plan limits to once/day)
- **Backup Branch:** `backup/pre-restructure-20260104`

## Key Documents
- **PRD:** `.taskmaster/docs/prd.txt`
- **Tasks:** `.taskmaster/tasks/tasks.json`
- **V0 Prompts:** `V0_PROMPTS.md`

## Task Master Commands
```bash
task-master list              # View all tasks
task-master show <id>         # Task details
task-master next              # See recommended next task
task-master set-status --id=<id> --status=in-progress  # Start task
task-master set-status --id=<id> --status=done         # Complete task
```

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

## Git Commits: Project Memory

**CRITICAL:** GitHub is the project's memory. Every commit must tell a complete story.

### When to Commit
- After completing a Task Master task
- After any meaningful change (even mid-task if significant)
- Before switching to a different task

### Commit Format
```
<type>(task-<id>): <short description>

## What Changed
- Detailed bullet points of actual changes

## Why
- The reasoning/context behind these changes
- Reference Task Master task: task-<id>

## Files Modified
- List of files with brief notes
```

### Types
- **feat:** New feature
- **fix:** Bug fix
- **refactor:** Code restructuring
- **style:** Formatting/UI changes
- **docs:** Documentation
- **chore:** Build/config changes

### Rules
- First line under 72 characters
- Include Task Master task ID when applicable
- Include enough context that someone reading later understands WHY, not just WHAT
- NO "Generated with Claude Code" attribution
- Use `/commit` command for guided process
- **ALWAYS push immediately after committing** - Ivan prefers commit + push as one action
- **ALWAYS report build number after push** - Tell Ivan the build number (from `lib/version.ts`) so he knows what version to look for in the deployed app to confirm it's live

## Browser Testing Rules
- **NEVER test animations** - The browser plugin is too slow to capture animations. Always ask Ivan to test animations on his device.
- Push changes first, then Ivan tests on mobile/actual device
- Only use browser automation for static content verification or form interactions

### Why This Matters
Ivan is non-technical. Months from now, the git history should explain the entire development journey without needing to ask anyone. Each commit should be a self-contained story.
