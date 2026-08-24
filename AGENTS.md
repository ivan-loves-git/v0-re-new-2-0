<!-- Canonical shared instructions for AI-assisted work in this repository. -->

# Re-New Platform Project

## Codex owns delivery

Codex is the single accountable development owner. Ivan is the product owner and is not expected to translate requests into developer language, supervise pull requests, follow deployment internals, or coordinate AI tools.

Codex must understand the request, clarify only material ambiguity, align scope with the PDR, implement once, check it works, ship it, and report the result in plain language.

Use one agent at a time on this repository. Running Codex, Cursor and others against the same branches in parallel produced days of duplicated and conflicting work in August 2026. If another tool is genuinely needed for a self-contained job, give it one bounded task and merge the result before starting anything else.

## Testing and credentials

`docs/TESTING_RELEASE_PROTOCOL.md` describes the whole process: branch, `pnpm verify`, PR, green `Verify`, merge. It is short on purpose. Read it once and follow it; do not reintroduce risk tiers, QA leases, evidence packets, or build-number rituals.

`Verify` is the only required status check on `main`.

Credentials are secrets. Load them only from the approved local source, GitHub environment, or provider project settings without printing them. Never put a secret value or bearer URL in a tracked file, commit, pull request, log, screenshot, agent packet, or chat. Do not stop at a login wall before checking the approved secret source, but do not improvise access or ask Ivan to expose credentials in conversation.

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
- **Production path:** merge to `main`, then the Git-connected production project deploys that main SHA.
- **Cron Jobs:** Daily at 9 AM (Hobby plan limits to once/day)

## Environment Variables (Quick Reference)

| Variable                         | Purpose                                                         | Default       |
| -------------------------------- | --------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SHOW_TEST_AUTOFILL` | Show autofill/test buttons on public intake form (`/intake-v2`) | `false` (off) |

To enable test mode on the intake form: add `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` to `.env.local` and restart dev server. This shows yellow "Autofill" buttons on each form step for quick testing with dummy data. **Must be off in production** (it is off by default since build 335).

## Current implementation authority

The live WAVE Strategic PDR at `https://codex-sites-test-flight-20260715.ivanpaudice.chatgpt.site/` is the source of truth for scope, Work Cards, status and decisions. `docs/data-models/ma-advisory-data-model-v1.md` is the business and data contract for M&A records.

`.planning/`, `TASKS.md`, old PDR drafts, dated backlogs, proposals and action plans are historical only. Do not execute or update them.

Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

A proposal or `Ready for decision` item is not authority to build. It has to be accepted first.

Founder calls, emails and supplied documents are important evidence inputs, but they change current scope only after the decision is recorded in the PDR and, for a material data or operating rule, in the canonical artifact.

Cross-session Pushapp commitments may still be surfaced through `/to-COS`, but product scope and delivery state remain in the PDR.

## shadcn UI

Use shadcn/ui for new feature surfaces and dashboard sections. Check installed `components/ui` components first, then use the shadcn MCP for search/examples before adding anything new. Follow the local shadcn config: Next.js App Router, RSC, Tailwind v4, `new-york` style, Radix base, Lucide icons, and imports from `@/components/ui`.

For dashboards and operational pages, prefer shadcn `Card`, `Table`, `Badge`, `Tabs`, `Sheet`, `Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`, and `Chart` over custom markup.

## Design quality

`pnpm design:check` is available and worth running when you finish a batch of UI work. It is a helper, not a gate: use judgement on what it reports, and do not loop on it or block a change because it has findings.

- Approved defaults are encoded in `DESIGN.md`, `app/globals.css`, and `components/wave/visual-foundations.tsx`: neutral full borders, quiet persistent panels, restrained semantic tints, segmented metric summaries, flat page/header surfaces, semantic product colors, and state-only motion.
- Ivan explicitly retained compact uppercase labels. `.wave-micro-label` and `WaveMicroLabel` are approved for KPI labels, table-style labels, short categories, and compact navigation. Do not flag them, and do not improvise local uppercase/tracking variants.
- Preserve valid product semantics. Standard tab underlines, navigation selection markers, status meaning, and the WAVE tide marker are not decorative accents merely because they use a border.
- Design tooling does not change product logic, KPIs, workflows, hierarchy, information architecture, filters, or strategy.
- Look at the changed screens in a browser at desktop and mobile widths. That matters more than the detector.

## External decisions

Current founder and operator decisions live only in PDR Work Cards or decision items with a named owner. Do not rely on a static question list in this repository, and do not infer approval from an old meeting note, email, Notion page or completed implementation card.

## Data Model Summary

- **Repreneur:** Profile with lifecycle status (lead/qualified/client)
- **Offer:** Consulting packages (price, duration, hours included)
- **Repreneur_Offer:** Junction tracking offer status per repreneur
- **Note:** Free-text notes with author tracking

## Canonical M&A Data Contract

- `docs/data-models/ma-advisory-data-model-v1.md` is the only human-readable source of truth for M&A firms, offices, contacts, affiliations, opportunities, interactions, visibility and cutover mapping.
- Keep that document in step with changes to the M&A schema, business validation, visibility rules or import mapping. This covers SQL migrations, opportunity and M&A types, server actions, form validation, import code, exports and role-specific API or UI projections.
- `pnpm data-model:check` reports when a relevant change is missing the contract update. It no longer runs inside lint; run it when you touch M&A code.
- Supabase enforces the released implementation; the document owns the approved business meaning and target model. If they disagree, stop the release and reconcile the difference explicitly.
- W-061 owns the data foundation and W-062 owns relationship history. Do not create a parallel M&A model document.

## Verification

Run `pnpm verify`. It covers lint, typecheck, tests and build. For UI work, also look at the changed screens in a browser. Fix root causes; do not suppress failures.

Documentation-only changes need review, not a test run.

## Git workflow

GitHub is the project's memory. Commit format, types and the push-immediately rule → `docs/commit-style.md`.

## Roadmap updates

In-app roadmap (`/guide/roadmap`) documents milestones for the Re-New team. When to update, how to update, entry format, founder-friendly language → `docs/roadmap-workflow.md`.

## WAVE AI — staff assistance

WAVE AI is staff-only and uses OpenAI `gpt-5.6-luna` with maximum reasoning. It may create editable drafts and recommendations after an explicit staff request, but it must not send messages, mutate business data, or replace deterministic rules. A human reviews and performs the separate operational action.

The binding runtime, data, privacy, observability, and acceptance contract is `docs/architecture/wave-ai-and-observability-v1.md`. Historical Wavy communication files and archives may retain their original names, but they do not define the active product runtime.
