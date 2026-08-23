<!-- Canonical shared instructions for AI-assisted work in this repository. -->

# Re-New Platform Project

## ⚠️ CRITICAL: Cursor's Role

**Cursor is the coding agent for this repository.** Codex may still appear in historical notes, QA lanes, and the PDR host. It does not own implementation.

Ivan is a business/product person, NOT a developer. Cursor must:

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

**Credentials are local secrets.** They live in `.env.local` and the approved
CI secret store. Never add a password or production login to a tracked file,
commit message, terminal output, screenshot, or report.

**Production QA personas (owned test accounts):**
| Coverage | Email variable | Password variable | Expected behavior |
| --- | --- | --- | --- |
| Staff/admin access | `QA_STAFF_EMAIL` | `QA_STAFF_PASSWORD` | Routes to `/dashboard_re`; redirects away from `/portal/*`. |
| Repreneur portal with demo deals | `QA_REPRENEUR_EMAIL` | `QA_REPRENEUR_PASSWORD` | Routes to `/portal/deals`; shows populated proposed and active pursuit cards. |
| Repreneur portal empty state | `QA_REPRENEUR_EMPTY_EMAIL` | `QA_REPRENEUR_EMPTY_PASSWORD` | Routes to `/portal/deals`; shows the no-opportunities state. |
| Authenticated but no app role | `QA_UNASSIGNED_EMAIL` | `QA_UNASSIGNED_PASSWORD` | Is rejected by `/routing` and returns to `/auth/login`. |

**Rule:** When verifying any change to this platform, load the relevant local
environment variables without printing them and click through the actual UI.
Never stop at the login wall before checking the approved secret source.

**Role QA rule:** Routine regression testing must use the owned QA personas above before touching real team/client accounts. Real accounts such as Bertrand's are for final user confirmation only, not the primary test harness.

**Where to test:**

- Default: production app at `app.re-new.team` after deploy. Real data, the live deploy.
- Fallback: local `pnpm dev` at `localhost:3000` for changes that are not yet deployed. Use Cursor browser tooling when a login wall is involved, with QA personas from the local secret store.

After Vercel auto-deploys a push to `main` (typically 1–3 min), test on production. The app footer shows the build number — confirm it matches your push (`git rev-list --count HEAD`).

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

| Variable                         | Purpose                                                         | Default       |
| -------------------------------- | --------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SHOW_TEST_AUTOFILL` | Show autofill/test buttons on public intake form (`/intake-v2`) | `false` (off) |

To enable test mode on the intake form: add `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` to `.env.local` and restart dev server. This shows yellow "Autofill" buttons on each form step for quick testing with dummy data. **Must be off in production** (it is off by default since build 335).

## Current implementation authority

Use this order. If two sources disagree, stop and reconcile the higher-authority source before implementation.

1. The live WAVE Strategic PDR at `https://codex-sites-test-flight-20260715.ivanpaudice.chatgpt.site/` is the canonical source for current Goals, Milestones, accepted scope, Work Cards, owners, dependencies, status and stakeholder decisions.
2. `docs/data-models/ma-advisory-data-model-v1.md` is the canonical released business and data contract for M&A records, confidentiality, visibility and cutover mapping.
3. This file owns technical, security, QA and release guardrails.
4. `.planning/`, `TASKS.md`, old PDR drafts, dated backlogs, proposals, launch plans and action plans are historical evidence only. Do not execute or update their old queues unless a current PDR Work Card explicitly cites them as implementation evidence.

Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

GSD may be used to create a bounded implementation plan only after a current PDR Work Card authorizes the work. A GSD plan never changes PDR scope, status, ownership or stakeholder approval by itself.

Problem Proposals, `Ready for decision` items and `Review` Work Cards are not implementation or release authority. A proposal must be accepted and converted to scope; a review card must pass its stated human or UAT gate.

Founder calls, emails and supplied documents are important evidence inputs, but they change current scope only after the decision is recorded in the PDR and, for a material data or operating rule, in the canonical artifact.

Cross-session Pushapp commitments may still be surfaced through `/to-COS`, but product scope and delivery state remain in the PDR.

## shadcn UI

Use shadcn/ui for new feature surfaces and dashboard sections. Check installed `components/ui` components first, then use the shadcn MCP for search/examples before adding anything new. Follow the local shadcn config: Next.js App Router, RSC, Tailwind v4, `new-york` style, Radix base, Lucide icons, and imports from `@/components/ui`.

For dashboards and operational pages, prefer shadcn `Card`, `Table`, `Badge`, `Tabs`, `Sheet`, `Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`, and `Chart` over custom markup.

## Impeccable design quality gate

Impeccable is the mandatory implementation-quality gate for every UI change. It is a linter and correction loop, not the product strategist.

- Treat every Impeccable hook finding as blocking. Correct the implementation immediately, then continue. Never dismiss, suppress, or ignore a finding without Ivan's explicit approval.
- Before completing any UI task, run `pnpm design:check`. Fix every high-confidence artifact and rerun until the detector returns clean. A UI task cannot be called done while this command reports findings.
- For broad, multi-screen, or design-system changes, also run an Impeccable `polish` pass on the changed surfaces. The deterministic detector cannot recognize every higher-order pattern.
- The correction scope includes recognizable AI implementation artifacts across the product, not only side stripes: repeated equal-card grids, decorative accent borders, ghost cards, decorative gradients or stripes, excessive glass or rounding, repeated decorative eyebrow scaffolding, invented affordances, and other Impeccable anti-patterns.
- Ivan explicitly retained compact uppercase labels. `.wave-micro-label` and `WaveMicroLabel` are approved for KPI labels, table-style labels, short categories, and compact navigation. Do not report this governed pattern as an Impeccable defect, and do not improvise local uppercase/tracking variants.
- Approved defaults are encoded in `DESIGN.md`, `app/globals.css`, and `components/wave/visual-foundations.tsx`: neutral full borders, quiet persistent panels, restrained semantic tints, segmented metric summaries, flat page/header surfaces, semantic product colors, and state-only motion.
- Preserve valid product semantics. Standard tab underlines, navigation selection markers, status meaning, and the WAVE tide marker are not decorative card accents merely because they use a border.
- Impeccable is forbidden from proposing or changing product logic, KPIs, workflows, hierarchy, information architecture, filters, or strategy. Its authority ends at implementation-level visual polish.
- After corrections, perform browser QA on the actual changed surfaces at desktop and mobile widths. The detector passing is necessary, not sufficient.

## External decisions

Current founder and operator decisions live only in PDR Work Cards or decision items with a named owner. Do not rely on a static question list in this repository, and do not infer approval from an old meeting note, email, Notion page or completed implementation card.

## Data Model Summary

- **Repreneur:** Profile with lifecycle status (lead/qualified/client)
- **Offer:** Consulting packages (price, duration, hours included)
- **Repreneur_Offer:** Junction tracking offer status per repreneur
- **Note:** Free-text notes with author tracking

## Canonical M&A Data Contract

- `docs/data-models/ma-advisory-data-model-v1.md` is the only human-readable source of truth for M&A firms, offices, contacts, affiliations, opportunities, interactions, visibility and cutover mapping.
- Any change to the M&A schema, business validation, visibility rule or import mapping must update that document in the same commit before release.
- This rule applies to relevant SQL migrations, opportunity and M&A types, server actions, form validation, import code, exports and role-specific API or UI projections.
- `pnpm data-model:check` runs inside lint and blocks a relevant M&A code or SQL change when the contract is missing from the same change.
- Supabase enforces the released implementation; the document owns the approved business meaning and target model. If they disagree, stop the release and reconcile the difference explicitly.
- W-061 owns the data foundation and W-062 owns relationship history. Do not create a parallel M&A model document.

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

## WAVE AI — staff assistance

WAVE AI is staff-only and uses OpenAI `gpt-5.6-luna` with maximum reasoning. It may create editable drafts and recommendations after an explicit staff request, but it must not send messages, mutate business data, or replace deterministic rules. A human reviews and performs the separate operational action.

The binding runtime, data, privacy, observability, and acceptance contract is `docs/architecture/wave-ai-and-observability-v1.md`. Historical Wavy communication files and archives may retain their original names, but they do not define the active product runtime.
