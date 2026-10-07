<!-- Canonical shared instructions for AI-assisted work in this repository. -->
# Re-New platform

Codex owns implementation and delivery; Ivan owns product decisions. Application code is `ivan-loves-git/v0-re-new-2-0`; production is `app.re-new.team`. Preserve unrelated local work.

## Start and route

Run `pnpm agent:context` (or `node scripts/agent-context.mjs` before dependencies). `--offline` inspects local evidence; `--json` returns structured output. Read reported instruction drift rather than overwriting it. Use the current baseline and owning Product Change or Ticket, not the saved directory name, as checkout authority.

For product work or direct Matt calls, read the [Re-New routing adapter](https://github.com/re-new-team/renew-governance/blob/main/docs/agents/renew-direct-calls.md). It owns tracker/context discovery, source handling, current card summaries, progress links and closeout. Governance is `re-new-team/renew-governance`; use the existing Product Change as the specification, native Decision children for material decisions, and Ticket children when Ivan selects decomposition. Analysis may start without a card. [Decision #210](https://github.com/re-new-team/renew-governance/issues/210) governs the GitHub-only flow; historical PDR links are provenance. GitHub unavailable or conflicting: stop affected delivery and report the exact missing authority.

State analysis without a card once at the start or a scope/phase change. Keep useful active-card links during implementation; do not query GitHub just for a status footer or link.

## Implementation and release

Before writing code, read [TESTING_RELEASE_PROTOCOL.md](docs/TESTING_RELEASE_PROTOCOL.md). It supplies the application-specific authority, checkout, verification and release requirements; the selected Matt skill owns its development method. Preserve narrower issue-specific boundaries. Shared risky surfaces and releases remain serial.

Run the Matt skill Ivan selected from the installed managed plugin, including its built-in steps: `implement` retains TDD and Standards/Spec code-review. Do not invoke Renew Sprint, create Tickets, select the next skill, or add coordinator/model/quota duties automatically. A bounded authorized Product Change can be implemented directly. Reuse valid verification evidence; specs, PRs and review findings belong to the same record.

For technical configuration, inspect `package.json`, `app/`, `components/` and `lib/`. Authentication uses Better Auth, not Supabase Auth. Supabase service role bypasses RLS; server authorization checks are essential. An authorized main merge triggers Git-connected Vercel deployment; verify its exact commit and changed behavior before release claims.

## Domain and confidentiality

For Strategic PDR retirement, [the #212 contract](docs/architecture/strategic-pdr-retirement-v1.md) owns removed application surfaces, private historical preservation and on-request summaries; [#214](https://github.com/re-new-team/renew-governance/issues/214) owns archive and cutover proof. No historical request migration or purge is authorized.

Read [ma-advisory-data-model-v1.md](docs/data-models/ma-advisory-data-model-v1.md) before changing M&A business meaning, schema, validation, visibility, imports, exports or role-specific projections. It owns the released contract; keep relevant code and that contract in step. Run `pnpm data-model:check` for those changes with the intended comparison, using `DATA_MODEL_BASE_REF` when needed. It stays outside lint and does not prove business correctness. Resolve a contract/implementation conflict explicitly before release.

A material product, data, operating or governance decision requires a current canonical specification or qualifying GitHub Decision, links from affected cards, and acceptance traceability. Slack, email and meetings supply evidence rather than changing canonical rules by themselves. `.planning/`, local task/backlog files and old PDR Work Cards are historical unless a current card cites them; Notion and Linear are inactive.

Load credentials only from the approved local source, GitHub environment or provider project settings. Secret values and bearer URLs never enter commits, logs, screenshots, packets or chat. Check the approved source before treating a login wall as a blocker; never ask Ivan to paste credentials.

## UI and staff AI

For UI work read [DESIGN.md](DESIGN.md). WAVE tokens live in `app/globals.css` and shared foundations in `components/wave/visual-foundations.tsx`. Reuse installed WAVE/shadcn controls; inspect ReUI MCP for an applicable new pattern. Design guidance cannot change product semantics. `pnpm design:check` is advisory; inspect changed screens at desktop/mobile widths.

WAVE AI is staff-only, using `gpt-5.6-luna` with maximum reasoning. It creates editable drafts/recommendations after an explicit staff request; a human performs any separate operational action. Read [wave-ai-and-observability-v1.md](docs/architecture/wave-ai-and-observability-v1.md) before changing its runtime, data, privacy or observability. Historical Wavy files do not define the active runtime.

Commit conventions: [commit-style.md](docs/commit-style.md). For a roadmap milestone change: [roadmap-workflow.md](docs/roadmap-workflow.md). Current delivery state lives in GitHub, not `docs/project-status.md`.
