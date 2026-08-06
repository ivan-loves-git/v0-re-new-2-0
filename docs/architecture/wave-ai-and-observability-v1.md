# WAVE AI and product observability v1

**Status:** Approved for implementation by the CTO on 6 August 2026  
**Scope:** Re-New WAVE platform  
**Canonical business contract:** `docs/data-models/ma-advisory-data-model-v1.md`

## Outcome

WAVE gains a small, staff-only AI assistance layer and enough product telemetry to decide whether it is useful. The AI drafts and recommends; it never performs a business action. Existing deterministic workflow rules remain authoritative.

This is an experimental startup implementation. It deliberately uses one provider, one model, a narrow server-side integration and three operational dashboards. It is not an autonomous agent platform, a data warehouse or a second workflow engine.

## Release scope

The first release contains three bounded deliveries:

1. Replace the active Wavy/Claude email-drafting flow with WAVE AI on the OpenAI Responses API.
2. Instrument staff, repreneur and public WAVE surfaces in an isolated EU PostHog project.
3. Store metadata-only AI runs in Supabase and show staff a WAVE AI usage dashboard.

Two later capabilities reuse the same runtime after the observable foundation is production-verified:

- contextual next-action recommendations for staff;
- qualitative review ordering inside an existing deterministic match candidate set.

AI capabilities remain staff-only. Repreneurs and anonymous users generate product telemetry but do not see or invoke WAVE AI.

## Authority and human control

- Every AI request is initiated by an authenticated staff user.
- The model receives a purpose-specific server projection, never a database connection, SQL tool or general query capability.
- The model may populate an editable draft only after an explicit staff action.
- Copying, sending, confirming a match or changing a workflow state remains a separate human action through an existing deterministic path.
- The model cannot send email, create or update CRM records, add match candidates, change authoritative scores, confirm a match or advance a workflow.
- Recommendations must distinguish recorded facts from inference and label missing information as unknown.
- The server validates model output against a strict schema before it reaches the UI.

Telemetry writes and the AI audit ledger are operational evidence, not business mutations.

## Provider and model contract

All AI requests use:

- provider: OpenAI;
- API: Responses API;
- model: `gpt-5.6-luna`;
- reasoning effort: `max`;
- provider storage: `store: false`;
- structured output with a versioned JSON schema;
- no provider Conversations, background mode, Files API or provider-side response history;
- no automatic fallback, routing or model downgrade.

`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` usage and active Claude references are removed. Historical archives may retain truthful historical references.

The provider's default abuse-monitoring retention may still apply. Zero Data Retention is not a launch dependency.

## Purpose-specific data projections

The server builds the smallest projection needed for the selected feature. Service-role access must never be forwarded to the model.

### Email drafting

Allowed when required by the chosen template:

- recipient role and lifecycle category;
- language and channel;
- approved public or staff-visible opportunity fields;
- the staff-selected purpose, tone and bounded instructions;
- canonical workflow state and allowed next step;
- an allowlisted recipient display name only when necessary for the requested salutation.

Excluded:

- internal notes not selected for the draft;
- source-review evidence and audit metadata;
- unrelated opportunities or repreneurs;
- passwords, tokens, secrets and authentication data;
- fields hidden from the requesting staff role;
- raw database rows or schema metadata.

The generated subject and body are returned to the staff editor. Neither is written to the AI ledger or PostHog.

### Next-action recommendations

Allowed inputs are canonical workflow state, dates, ownership, completed gates and bounded stale/freshness signals. The model returns up to three ranked recommendations with rationale, confidence and explicit unknowns. Each recommendation points to an existing deterministic action identifier; it cannot invent a new mutation.

### Matching review ordering

The deterministic matching service first produces the candidate set and authoritative numeric scores. WAVE AI may add a temporary qualitative review order and short rationale inside that set. It cannot add or remove a candidate, change or duplicate the score, persist a match or expose confidential source identity.

## AI run ledger

Supabase is the canonical source for AI usage, reliability, cost and reviewed outcomes. The ledger stores metadata only.

### `ai_generation_runs`

One row per attempted generation:

- opaque `generation_id` and `trace_id` UUIDs;
- initiating Better Auth user UUID and application role;
- feature, workflow, surface, prompt version and output-schema version;
- provider, model and reasoning effort;
- request start/completion timestamps and latency;
- status and allowlisted error code;
- input, cached-input, output and reasoning token counts when supplied;
- estimated cost in USD using a versioned price table;
- environment, release/build number and test flag.

It must not store prompts, output text, names, email addresses, notes, CRM entity IDs, URLs containing identifiers, content hashes or provider response bodies.

### `ai_generation_events`

Append-only lifecycle events linked by `generation_id`:

- rendered;
- edit started;
- copied;
- send review opened;
- send succeeded or failed;
- confirmed workflow action;
- optional helpful/not-helpful feedback;
- discarded.

Negative feedback uses an allowlist such as `wrong_fact`, `not_relevant`, `poor_wording`, `missing_context` or `other_without_text`. No free-text feedback is stored in PostHog. Product content remains in the canonical business tables only when a human completes the corresponding business action.

### Access and retention

- Writes occur server-side after staff authorization.
- Reads are staff-only and served through staff-authorized server code.
- `anon` and ordinary Data API clients receive no table privileges or RLS policy.
- Service-role use stays server-only.
- Row-level metadata is retained for 12 rolling months; older detail is deleted after aggregate counts are retained.

## Useful-outcome definitions

A generation is useful only when it results in a verified human action:

- email: staff copies the reviewed draft or an existing send path reports successful delivery;
- match: staff confirms or saves the match through the existing deterministic action;
- next action: staff completes the corresponding existing workflow action.

Views, renders, edits and ratings are diagnostic signals, not useful outcomes.

The initial review gate is 30 reviewed outcomes. Model routing, fallback or reasoning-effort changes are considered only after that evidence exists.

## PostHog contract

### Project and environments

- Create a separate EU project named `Re-New WAVE` in the existing PostHog organization.
- Never reuse the Mappatella project token, project data or literal configuration.
- Use direct EU ingestion at `https://eu.i.posthog.com`.
- Keep Vercel Analytics for coarse operational traffic.
- Tag every event with `environment`, `release` and `is_test`; exclude local development by default.

### Identity

- Before login, use PostHog's anonymous identity.
- After login, derive a deterministic analytics-only UUID from the Better Auth user ID and identify only with that UUID plus the application role. Never send the raw authentication ID to PostHog.
- Merge the anonymous pre-login journey after authentication.
- Never identify or set person properties with name, email address, CRM ID, company, opportunity or repreneur ID.
- Reset analytics identity on logout.

### Coverage

Instrumentation covers public, authentication, staff and repreneur surfaces. Prefer a small allowlisted event vocabulary and normalized route templates over per-screen bespoke events.

Core product events:

- `wave_page_viewed`;
- `wave_action_started`;
- `wave_action_succeeded`;
- `wave_action_failed`;
- `wave_validation_failed`;
- `wave_auth_succeeded` and `wave_auth_failed`;
- `wave_ai_generation_requested`;
- `$ai_generation` for server-side model usage;
- `wave_ai_generation_rendered`;
- `wave_ai_outcome_recorded`;
- `wave_ai_feedback_submitted`.

Allowlisted properties include schema version, environment, release, route template, surface, role, workflow, action, outcome, generation ID, trace ID, prompt version, model key, latency bucket and test flag. Business record identifiers and content are excluded.

### Session replay and automatic diagnostics

- Session replay is enabled for 100% of sessions with 30-day retention and a hard usage/billing cap.
- Text inputs, form values, media and known sensitive DOM regions are masked or blocked.
- Query strings and identifier-bearing URL segments are normalized or excluded.
- Automatic exception, console and network diagnostics are enabled across the platform.
- AI generation endpoints, prompts, generated content, authorization headers, cookies, request/response bodies and sensitive headers are excluded from diagnostic payload capture.
- Existing console statements that emit personal or business data are removed before diagnostics are enabled.

This is the CTO-approved higher-observability setting. The exclusions above remain mandatory even though automatic diagnostics are enabled.

## Dashboards

### Staff in-app dashboard

The staff-only WAVE AI dashboard reads the Supabase ledger and shows:

- attempts, successes and errors;
- useful-outcome rate by feature;
- copy/send/confirmed-action counts;
- input/output/reasoning token totals;
- estimated cost and cost per useful outcome;
- median and 95th-percentile latency;
- optional feedback distribution;
- instrumented coverage and most recent successful run.

Default time windows are 7 and 30 days. Small counts are shown directly; no forecasting or statistical claims are added.

### PostHog dashboards

Create three operational dashboards:

1. `WAVE — Product adoption`: anonymous-to-auth journey, active staff/repreneurs and key workflow completion.
2. `WAVE AI — Outcomes and cost`: generation-to-render-to-human-action funnel, model usage, latency and failures.
3. `WAVE — Instrumentation health`: event coverage, unknown routes, client/server gaps and error/replay health.

A `200 OK` from ingestion is not acceptance evidence. At least one synthetic event for each critical path must be confirmed as stored and queryable in the isolated project.

## Security and failure behavior

- Every AI route uses the existing staff authorization guard before reading data or calling OpenAI.
- Request bodies are bounded and schema-validated; client-supplied business context is not trusted as canonical.
- Rate limits and timeouts fail closed.
- A provider, ledger or PostHog failure never blocks the underlying deterministic WAVE workflow.
- AI errors return a safe retry state without provider payloads or sensitive detail.
- Analytics and replay are disabled when the PostHog public key is absent.
- A PostHog failure is swallowed after safe local diagnostics; no product action is retried because analytics failed.
- Correlation IDs are opaque and shared between safe application logs, the ledger and PostHog.

## Migration and rollback

- `/tools/wavy` redirects to `/tools/wave-ai` so saved staff links continue to work.
- Active UI, routes, prompts and code use `WAVE AI`; historical sent-email archives may keep `Wavy`.
- Existing custom templates are preserved and read through the renamed service until a later migration explicitly changes their table.
- The ledger migration is additive and does not alter M&A business tables.
- Removing PostHog environment variables disables capture without affecting WAVE.
- Disabling the WAVE AI feature flag hides generation controls while leaving the deterministic workflows available.

## Acceptance trace

The implementation Work Cards link to this contract. A candidate release is acceptable only when:

- Anthropic is absent from runtime dependencies and active code;
- every generation uses the exact OpenAI/model/storage contract above;
- staff authorization and purpose-specific projections have negative tests;
- no prompt or generated content is present in Supabase or PostHog fixtures;
- ledger token/cost/outcome calculations pass unit and integration tests;
- WAVE AI routes and dashboard reject repreneur and anonymous personas;
- public and repreneur product analytics work without exposing WAVE AI;
- replay masking and the diagnostic denylist are browser-verified;
- stored/queryable PostHog events are verified in the isolated project;
- build, lint, tests, data-model check and `pnpm design:check` pass;
- desktop and mobile browser QA passes with the owned staff, repreneur, empty-repreneur and unassigned personas.

Production publication, migration application, PDR completion and stakeholder communication remain a separate release approval gate.
