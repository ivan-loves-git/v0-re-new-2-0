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

## Start from the intended revision

At the start of a task, run `pnpm agent:context` (or `node scripts/agent-context.mjs`
before installing dependencies). Use `--json` for structured output and `--offline`
for local inspection. It reports repository identity, local changes, the current
GitHub default-branch revision and differences in the designated instruction files.
A difference is evidence to review, not permission to overwrite local work or a
claim that local instructions are wrong. If GitHub is unavailable, remote facts
remain unknown; follow the authority-outage rule below.

Use the checkout whose baseline and Ticket are recorded for the task. A directory
named `platform/`, a saved worktree or a cached `origin/main` is not proof of freshness.
Preserve unrelated changes; reconcile any instruction conflict before the affected work.

For technical configuration, inspect `package.json`, routes under `app/`, shared
components under `components/`, and domain/auth code under `lib/`. Product orientation
is in `docs/project-status.md`; current delivery state is in GitHub. Authentication
uses Better Auth, not Supabase Auth. The Supabase service role bypasses RLS, so the
server's authorization checks remain essential.

The application repository is `ivan-loves-git/v0-re-new-2-0`; production is
`app.re-new.team`. An authorized merge to `main` triggers the Git-connected Vercel
production deployment. Inspect provider settings when deployment behavior matters.

## Current implementation authority

The binding governance decisions are [D-GOV-002](https://github.com/re-new-team/renew-governance/issues/27), [D-GOV-003](https://github.com/re-new-team/renew-governance/issues/36), and [D-GOV-004](https://github.com/re-new-team/renew-governance/issues/70). GitHub is the canonical product-development authority; WAVE's Strategic PDR is an authenticated intake, history, and read-only presentation surface. It does not own delivery status or current specifications.

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

Use shadcn/ui for new feature surfaces and dashboard sections. Check installed
`components/ui` components first, then use the available shadcn skill, CLI,
documentation or MCP for relevant examples before adding anything new. Follow
the local configuration and component-composition guidance in `DESIGN.md`.

## Design quality

Follow `DESIGN.md`, `app/globals.css`, and `components/wave/visual-foundations.tsx`
for WAVE defaults, approved micro-label semantics, preserved product markers and
design-tool scope. `pnpm design:check` is advisory, not a gate; use judgement
on its findings and inspect changed screens at desktop and mobile widths.

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

Run `pnpm verify`. It covers lint, typecheck, tests and build. For sandbox restrictions, follow [Local environment limitations](docs/TESTING_RELEASE_PROTOCOL.md#local-environment-limitations); the exact candidate still needs full CI verification. For UI work, also look at the changed screens in a browser. Fix root causes; do not suppress failures.

Documentation-only changes need review, not a test run.

## Git workflow

GitHub is the project's memory. Commit format and authorized branch publication → `docs/commit-style.md`.

## Roadmap updates

In-app roadmap (`/guide/roadmap`) documents milestones for the Re-New team. When to update, how to update, entry format, founder-friendly language → `docs/roadmap-workflow.md`.

## WAVE AI — staff assistance

WAVE AI is staff-only and uses OpenAI `gpt-5.6-luna` with maximum reasoning. It may create editable drafts and recommendations after an explicit staff request, but it must not send messages, mutate business data, or replace deterministic rules. A human reviews and performs the separate operational action.

The binding runtime, data, privacy, observability, and acceptance contract is `docs/architecture/wave-ai-and-observability-v1.md`. Historical Wavy communication files and archives may retain their original names, but they do not define the active product runtime.
