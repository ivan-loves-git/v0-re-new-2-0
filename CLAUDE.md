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
- **Stopping at the login wall and saying "I don't have credentials"** — see Testing Credentials below.

## ⚠️ Testing Credentials (READ BEFORE stopping at any login screen)

**Login at `app.re-new.team` (production) or `http://localhost:3000` (local dev):**
- Email: `ivanpaudice@icloud.com`
- Password: `Ciaociao01`

**Production QA personas (owned test accounts):**
| Coverage | Email | Password | Expected behavior |
| --- | --- | --- | --- |
| Staff/admin access | `qa.staff@re-new.team` | `Stromboli.1` | Routes to `/dashboard_re`; redirects away from `/portal/*`. |
| Repreneur portal with demo deals | `myworkmail4@gmail.com` | `Stromboli.1` | Routes to `/portal/deals`; shows populated proposed and active pursuit cards. |
| Repreneur portal empty state | `qa.repreneur.empty@re-new.team` | `Stromboli.1` | Routes to `/portal/deals`; shows the no-opportunities state. |
| Authenticated but no app role | `qa.unassigned@re-new.team` | `Stromboli.1` | Is rejected by `/routing` and returns to `/auth/login`. |

**Rule:** When verifying any change to this platform, log in with these credentials and click through the actual UI. **Never report "I don't have credentials" or stop at the login wall** — Ivan has explicitly approved storing them in plain text in this file. Wasting his time by halting at login is the #1 anti-pattern in this project.

**Role QA rule:** Routine regression testing must use the owned QA personas above before touching real team/client accounts. Real accounts such as Bertrand's are for final user confirmation only, not the primary test harness.

**Where to test:**
- Default: production app at `app.re-new.team` via the `claude-in-chrome` MCP (`mcp__Claude_in_Chrome__*` tools — load via `ToolSearch` if deferred). Real data, the live deploy.
- Fallback: local dev via `preview_*` MCP at `localhost:3000` (run `preview_start renew-dev`). Use only when testing changes that aren't yet deployed.

After Vercel auto-deploys a push to `main` (typically 1–3 min), test on production. The app footer shows the build number — confirm it matches your push (`git rev-list --count HEAD`).

## Project Context
- **What:** Internal CRM replacing Flatchr ATS for managing repreneurs
- **Timeline:** 8-10 FTE working days
- **Client:** Re-New (Bertrand + 2 part-time team members)
- **Ivan's role:** Product owner, non-technical

## Deal Context (June 2026)
Ivan is negotiating fractional-CTO terms with Bertrand. The sent proposal is `PROPOSAL_2026-06_PLATFORM_ROADMAP_AND_CTO.md` (V5; earlier versions in `_archive/`). A local-only monetary logic and negotiation note may exist at `docs/BERTRAND_PROPOSAL_2026-06_MONETARY_LOGIC.md`; if present, read it before any session touching the Bertrand relationship, pricing, or contracts. Keep that note out of git and do not surface its contents in Bertrand-facing material.

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

## GSD and Linear

GSD is the shared execution system for Claude Code and Codex. Use the repo `.planning/` folder as the common GSD memory: requirements, roadmap, phases, decisions, state, verification notes.

Linear is the team-facing project tracker. Mirror GSD into Linear with this mapping:
- GSD milestone → Linear project milestone.
- GSD phase → Linear parent issue or milestone workstream.
- GSD implementation task → Linear issue.
- GSD verification or UAT item → Linear issue checklist/comment, or a separate issue when it can block release.
- GSD deferred scope → Linear backlog issue labelled as postponed/V3, not mixed into the June build.

Do not let Linear replace GSD planning files. Do not let GSD hide team commitments from Linear. When a phase is planned, executed, verified, blocked, or descoped, update the matching Linear item or status update.

## shadcn UI

Use shadcn/ui for new feature surfaces and dashboard sections. Check installed `components/ui` components first, then use the shadcn MCP for search/examples before adding anything new. Follow the local shadcn config: Next.js App Router, RSC, Tailwind v4, `new-york` style, Radix base, Lucide icons, and imports from `@/components/ui`.

For dashboards and operational pages, prefer shadcn `Card`, `Table`, `Badge`, `Tabs`, `Sheet`, `Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`, and `Chart` over custom markup.

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
