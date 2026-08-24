<!-- Canonical shared instructions for AI-assisted work in this repository. -->

# Re-New Platform Project

## Codex owns delivery

Codex is the single accountable development owner. Ivan is the product owner and is not expected to translate requests into developer language, supervise pull requests, follow deployment internals, or coordinate AI tools.

Codex must understand the request, clarify only material ambiguity, align scope with the PDR and canonical contracts, implement once, apply proportional QA, publish when authorised, verify production, and report the result simply. Do not mark work complete because code exists, tests are green, or a deployment says Ready; prove the layer required by the change.

Temporary reviewers and subagents may perform bounded independent work and return a completion packet. They do not own a second backlog or remain as permanent supervisors. Cursor or any replacement coding provider is optional and may be used only through the bounded specialist contract in `docs/TESTING_RELEASE_PROTOCOL.md`; Codex remains accountable for the final diff, evidence, release, and report.

## Testing and credentials

The binding QA-to-production ladder, evidence boundaries, risk tiers, release authority, specialist work-packet format, and credential ownership rules are in `docs/TESTING_RELEASE_PROTOCOL.md`. Follow it for every change.

Required GitHub configuration: branch protection requires `Verify` universally, while `P1-P3 protected pilot` remains selective Tier 3 release evidence and is never a universal required check. Codex may classify and execute Tier 0–2 autonomously. A Tier 3 candidate stays `Tier 3 proposed — awaiting Ivan authorization` until Ivan explicitly authorizes that exact candidate; only then may the owner-only manual controller dispatch P1-P3. Codex records the QA tier and a one-sentence reason in the pull request before merge and applies only that tier's evidence.

Candidate behaviour is tested in the isolated QA environment with synthetic data when the risk tier requires it. Production is verified only after the exact approved code reaches `main`; real team or customer records are not the primary test harness, and production writes require separate authority.

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
- **Production path:** the reviewed exact candidate merges to `main`, then the Git-connected production project deploys that exact main SHA.
- **QA path:** only the trusted owner-dispatched controller may admit an Ivan-authorized exact Tier 3 candidate to the isolated validation project. Ordinary branch pushes and API dispatches must not deploy there.
- **Cron Jobs:** Daily at 9 AM (Hobby plan limits to once/day)

## Environment Variables (Quick Reference)

| Variable                         | Purpose                                                         | Default       |
| -------------------------------- | --------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SHOW_TEST_AUTOFILL` | Show autofill/test buttons on public intake form (`/intake-v2`) | `false` (off) |

To enable test mode on the intake form: add `NEXT_PUBLIC_SHOW_TEST_AUTOFILL=true` to `.env.local` and restart dev server. This shows yellow "Autofill" buttons on each form step for quick testing with dummy data. **Must be off in production** (it is off by default since build 335).

## Current implementation authority

Use this order. If two sources disagree, stop and reconcile the higher-authority source before implementation.

1. The live WAVE Strategic PDR at `https://codex-sites-test-flight-20260715.ivanpaudice.chatgpt.site/` is the canonical source for current Goals, Milestones, accepted scope, Work Cards, owners, dependencies, status and stakeholder decisions.
2. `docs/data-models/ma-advisory-data-model-v1.md` is the canonical released business and data contract for M&A records, confidentiality, visibility and cutover mapping.
3. `docs/TESTING_RELEASE_PROTOCOL.md` owns the development and release operating model, source-of-truth boundaries, proportional QA tiers, specialist handoff, and release/data authority boundaries.
4. This file owns repository-specific technical, security and quality guardrails.
5. `.planning/`, `TASKS.md`, old PDR drafts, dated backlogs, proposals, launch plans and action plans are historical evidence only. Do not execute or update their old queues unless a current PDR Work Card explicitly cites them as implementation evidence.

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

Classify the change using `docs/TESTING_RELEASE_PROTOCOL.md` and run the evidence required by that risk tier. Tier 0 documentation changes need document and authority-link review, not software QA. Runtime code normally needs focused tests plus `pnpm typecheck`, `pnpm lint`, `pnpm design:check` for UI, and `pnpm build` as appropriate, followed by the exact-candidate QA and production proof required by its tier. Fix root causes; do not suppress failures.

## Git workflow

GitHub is the project's memory. Commit format, types, push-immediately rule, browser testing constraints, build-number reporting → `docs/commit-style.md`.

## Roadmap updates

In-app roadmap (`/guide/roadmap`) documents milestones for the Re-New team. When to update, how to update, entry format, founder-friendly language → `docs/roadmap-workflow.md`.

## WAVE AI — staff assistance

WAVE AI is staff-only and uses OpenAI `gpt-5.6-luna` with maximum reasoning. It may create editable drafts and recommendations after an explicit staff request, but it must not send messages, mutate business data, or replace deterministic rules. A human reviews and performs the separate operational action.

The binding runtime, data, privacy, observability, and acceptance contract is `docs/architecture/wave-ai-and-observability-v1.md`. Historical Wavy communication files and archives may retain their original names, but they do not define the active product runtime.
