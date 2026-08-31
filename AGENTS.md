<!-- Canonical shared instructions for AI-assisted work in this repository. -->

# Re-New Platform Project

## Codex owns delivery

Codex is the single accountable development owner. Ivan is the product owner and is not expected to translate requests into developer language, supervise pull requests, follow deployment internals, or coordinate AI tools.

Codex must understand the request, clarify only material ambiguity, align scope with the current GitHub authority, implement once, check it works, release it under the standing authority below when eligible, and report the result in plain language.

Use controlled parallelism, not unbounded concurrent coding. The August 2026 incident—Codex, Cursor and other tools editing the same branches in parallel—produced days of duplicated and conflicting work. There may be at most two proven-independent, isolated application-code lanes at once. Each lane needs its own clean worktree and branch from the same recorded `origin/main` baseline, an assigned GitHub Ticket, non-overlapping ownership, and its own verification path. A single supervising Codex agent owns GitHub state, integration, merges, releases, and the final production proof. Merges and releases are always serial.

Two lanes are independent only when neither touches the same route, component, server action, data model, migration, package/configuration file, shared test fixture, authorization/visibility rule, external integration, or production-data surface. When in doubt, use one lane. Read-only research and review may run alongside a code lane, but they must not edit the worktree or advance GitHub delivery state. If `origin/main` moves, a lane has unexplained changes, or an overlap appears, stop that lane; the supervisor reconciles it before any integration continues.

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

The binding governance decisions are [D-GOV-002](https://github.com/re-new-team/renew-governance/issues/27) and [D-GOV-003](https://github.com/re-new-team/renew-governance/issues/36). GitHub is the canonical product-development authority; WAVE's Strategic PDR is an authenticated intake, history, and read-only presentation surface. It does not own delivery status or current specifications.

Before changing a Product Change, Decision, Ticket, Bug, strategy mapping, data contract, or implementation, read in this order:

1. [`re-new-team/renew-governance` `CONTEXT.md`](https://github.com/re-new-team/renew-governance/blob/main/CONTEXT.md) for the governance boundary and current operating rules.
2. The GitHub [`strategy/registry.yaml`](https://github.com/re-new-team/renew-governance/blob/main/strategy/registry.yaml) for canonical Goals, Outcome Milestones, KPI definitions/targets, guardrails, and their stable IDs.
3. The target GitHub Product Change and its linked active Decisions for the authorised current scope, dependencies, and strategic mapping.
4. `docs/data-models/ma-advisory-data-model-v1.md` for the released M&A business and data contract, including confidentiality, visibility, retention, and cutover mapping.
5. This file and the applicable platform technical documentation for security, QA, release, and implementation guardrails.
6. The current code, migrations, and production evidence.

If sources conflict, are unavailable, or do not identify a valid current authority, stop and report the conflict to Ivan. Do not reconcile it by copying status into PDR, inferring a decision from Slack/email/meeting notes, or choosing the most convenient source.

A Strategy Registry with status `proposed` is review-only: it must not authorise work, determine a current Product Change placement, or be presented to a model as an approved strategic claim. Only a registry with status `accepted` and its recorded approval may supply those current governance facts.

### Authority boundaries

- GitHub `re-new-team/renew-governance` owns the Strategy Registry, Product Changes, Decisions, Tickets, Bugs, current specifications, discussion, delivery status, assignees, dependencies, pull-request links, tests, and release evidence.
- WAVE Strategic PDR owns founder/staff request intake, original wording, AI screening, Ivan's disposition, intake attachments, and the historical proposal record. Its delivery view is a timestamped, read-only projection of GitHub; it cannot be used to advance delivery.
- An Ivan-authorised Product Change may be created directly in GitHub without a PDR record. An unapproved direct GitHub request remains `Unrouted` until Ivan explicitly authorises it.
- If GitHub cannot be reached or its required record cannot be verified, stop the affected delivery work and warn Ivan. Never create or advance a PDR Work Card as a fallback execution record.
- **Standing Ready authority:** D-GOV-004 and GitHub Decision #70 authorize routine end-to-end delivery when the governing Product Change is `Ready` and `ready-for-agent`, Ivan's approved scope authority is recorded on that Product Change or Decision, and no narrower instruction on the issue says otherwise. That authority covers implementation, verification, pull request, merge to `main`, automatic deployment, live verification, GitHub closure, and one standard Slack product-update-card message in `#product-updates-stream` after live proof. An implementation Ticket may be created and advanced during autonomous shaping; it must be linked to that Product Change, bounded, unblocked, and claimed under the parent's inherited authority. The authority does not permit work outside the stated issue scope or a new material decision.
- A narrower Product Change, Ticket, or Decision instruction always wins. Stop and ask Ivan only when the work would create a new material product, operating, data, security, commercial, legal, or external-side-effect decision; expands or contradicts approved scope; requires unspecified authorization, confidentiality, visibility, security, payment, secret, credential, billing, or real-account treatment; contains an unapproved destructive or irreversible migration, deletion, backfill, or real-record correction; cannot be safely verified or rolled back within the stated contract; or encounters a failed verification, production incident, duplicate lane, changed baseline, or authoritative-source conflict. Do not add a separate approval gate merely because a ready item touches a known technical risk already explicitly covered by its approved scope and acceptance criteria.
- `.planning/`, `TASKS.md`, old PDR Work Cards, dated backlogs, proposals, launch plans, and action plans are historical evidence only unless a current GitHub Product Change explicitly cites them.
- Notion and Linear are inactive for Re-New product planning. Do not consult, update, mirror to, or link them unless Ivan explicitly reactivates one of them.

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

Slack, email, meeting notes, and supplied documents are evidence inputs, not canonical decisions. A material product, data, operating-model, or governance decision is closed only when its canonical specification or qualifying Decision is updated in GitHub, affected Product Changes and Tickets link to it, and acceptance tests trace back to it. Do not infer approval from an old message, a completed implementation card, or a PDR status.

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
