# WAVE AI assistance v1

- **Status:** Released foundation; bounded capability expansion remains planned
- **Scope:** Staff-only assistance in the Re-New WAVE platform
- **Related product-intelligence contract:** [wave-product-observability-v1.md](./wave-product-observability-v1.md)
- **Canonical business contract:** [../data-models/ma-advisory-data-model-v1.md](../data-models/ma-advisory-data-model-v1.md)

## Outcome

WAVE AI helps staff prepare and review work. It drafts and recommends after an explicit staff request; it does not take a business action. Deterministic WAVE rules, access controls and human decisions remain authoritative.

This is a deliberately narrow AI layer: one provider, one model, server-owned context, editable output and human-in-the-loop completion. It is not an autonomous agent, a database browser, a second workflow engine or an authority on matching decisions.

## Current release and planned capabilities

### Released foundation

The current staff surface is /tools/wave-ai.

- Staff can request an editable email draft for an authorised repreneur and purpose.
- The draft may be copied into an existing operational workflow, but WAVE AI does not send it.
- The staff-only usage view reads the metadata-only AI ledger for volume, reliability, useful outcomes, token use, cost and latency.
- The historical /tools/wavy path redirects to /tools/wave-ai; historical records can keep the truthful name "Wavy".

### Reuse of the same foundation

The next capabilities use the same guardrails and do not widen the model’s authority:

1. **Next-action recommendations** — up to three ranked suggestions that point to existing deterministic actions.
2. **Match-review ordering** — a temporary qualitative order and short rationale inside a deterministic candidate set; it never changes the candidate set or authoritative score.

No repreneur, public user or external M&A contact sees or invokes WAVE AI in this version.

## Human control and authority boundary

- Every request starts with an authenticated staff user.
- The server owns retrieval, authorization and projection. The model never receives a database connection, SQL tool, general search tool or service-role credential.
- The model returns a strict, versioned structured response that the server validates before the UI receives it.
- Staff review, edit and separately choose whether to copy, send, confirm or change a workflow state through existing deterministic paths.
- The model cannot send email, create or update CRM records, add match candidates, change authoritative scores, confirm a match or advance a workflow.
- Recommendations distinguish recorded facts from inference and label missing information as unknown.

AI ledger and telemetry writes are operational evidence, not business mutations.

## Provider and runtime contract

All WAVE AI requests use:

- provider: OpenAI;
- API: Responses API;
- model: gpt-5.6-luna;
- reasoning effort: max;
- provider storage: store: false;
- structured output through a versioned JSON schema;
- no provider Conversations, background mode, Files API or provider-side response history;
- no automatic fallback, routing or model downgrade.

Active runtime code and dependencies do not use Anthropic. Historical archives may retain truthful historical references.

The provider’s default abuse-monitoring retention may still apply. Zero Data Retention is not a launch dependency.

## Purpose-specific data projections

The server builds the smallest projection required for the selected feature. Service-role access and raw business rows are never forwarded to the model.

### Email drafting

When required by the selected template, the projection may contain:

- recipient role and lifecycle category;
- language and channel;
- approved public or staff-visible opportunity fields;
- staff-selected purpose, tone and bounded instructions;
- canonical workflow state and allowed next step;
- an allowlisted recipient display name only when necessary for the requested salutation.

It excludes internal notes not selected for the draft, source-review evidence, audit metadata, unrelated records, secrets, authentication data, hidden fields, raw database rows and schema metadata.

The generated subject and body return only to the staff editor. They are not written to the AI ledger or PostHog.

### Next-action recommendations

Inputs are limited to a server-built opportunity projection: status, computed source-review flag, profile completeness, date precision and age buckets, match counts, active-pursuit state, derived readiness or gate booleans, last canonical interaction age or next-due bucket, as-of time, and the server-derived allowed actions. It excludes raw rows, notes, audit data, secrets and identifiers. The model returns at most three unique ordered recommendations with rationale, confidence, recorded-fact references and explicit unknowns. Each recommendation references an existing deterministic action identifier and cannot invent a mutation, URL or identifier. In v1 the only confirmable actions are `resolve_source_review` and `complete_opportunity_profile`; match review and pursuit continue remain deterministic-only because they do not have one unambiguous completion boundary. The server gives each recommendation a short-lived, domain-separated HMAC outcome token. Only the matching successful staff mutation can append the confirmed outcome; a ledger failure never rolls back that mutation. The Opportunity Overview keeps the deterministic Next Best Action primary. Staff must explicitly select Ask WAVE AI to request this advisory output.

### Match-review ordering

The deterministic matching service first supplies the candidate set and authoritative numeric scores. WAVE AI may add a temporary qualitative review order and short rationale inside that set. It cannot add or remove a candidate, change or duplicate a score, persist a match or expose confidential source identity.

## AI run ledger

Supabase is the source of truth for AI usage, reliability, cost and reviewed outcomes. The ledger stores metadata only.

### ai_generation_runs

One row exists per attempted generation and includes:

- opaque generation_id and trace_id UUIDs;
- initiating staff identity represented by the application’s authorised user reference and role;
- feature, workflow, surface, prompt version and output-schema version;
- provider, model and reasoning effort;
- timestamps, latency, status and allowlisted error code;
- supplied input, cached-input, output and reasoning token counts;
- estimated USD cost using a versioned price table;
- environment, release/build number and test flag.

It must not store prompts, output text, names, email addresses, notes, CRM entity IDs, identifier-bearing URLs, content hashes or provider response bodies.

### ai_generation_events

Append-only events link to generation_id:

- rendered;
- edit started;
- copied;
- send review opened;
- send succeeded or failed through an existing deterministic route;
- confirmed workflow action;
- optional helpful/not-helpful feedback;
- discarded.

Negative feedback uses a fixed reason code such as wrong_fact, not_relevant, poor_wording, missing_context or other_without_text. Free-text feedback is not stored in the ledger or PostHog.

### Access and retention

- Writes occur server-side after staff authorization.
- Reads are staff-only and flow through authorised server code.
- Browser roles have no direct table privileges or RLS policy.
- Service-role use stays server-only.
- Row-level metadata is retained for 12 rolling months; older detail is deleted after aggregate counts are retained.

## Useful-outcome rule

A generation is useful only when it produces a verified human action:

- email: staff copies the reviewed draft or an existing send path reports successful delivery;
- match: staff confirms or saves the match through an existing deterministic action;
- next action: staff completes the corresponding existing workflow action.

Views, renders, edits and ratings are diagnostic signals rather than useful outcomes.

The initial review gate is 30 reviewed outcomes. Any decision to add model routing, fallback or a different reasoning effort requires that evidence.

## Product-intelligence interface

WAVE AI exposes only the minimum evidence needed for product learning to PostHog:

- an opaque analytics identity and application role;
- opaque generation and trace IDs;
- feature, workflow, route template, prompt/schema version, model key;
- status, allowlisted error code, latency bucket and test flag;
- lifecycle milestones such as requested, rendered, copied, feedback and confirmed outcome.

Prompts, drafts, recipient names, record IDs, notes, provider payloads and raw token-bearing content do not leave the AI ledger boundary. The complete PostHog event, identity, replay and cockpit contract is [wave-product-observability-v1.md](./wave-product-observability-v1.md).

## Failure behaviour and rollback

- Every AI route authorizes staff before any ledger, business-data or provider access.
- Request bodies are bounded and schema-validated; client-supplied business context is never trusted as canonical.
- Rate limits and timeouts fail closed.
- Provider, ledger or analytics failure never blocks an underlying deterministic WAVE workflow.
- AI errors return a safe retry state without provider payloads or sensitive detail.
- Removing PostHog configuration disables product capture without affecting WAVE AI.
- Disabling the WAVE AI feature flag hides generation controls while leaving deterministic workflows available.

## Acceptance trace

The implementation is acceptable when:

- every generation uses the OpenAI/Luna/store:false contract above;
- active runtime dependencies and code do not use Anthropic;
- staff authorization and purpose-specific projections have negative tests;
- no prompt or generated content occurs in ledger or PostHog fixtures;
- ledger token, cost and outcome calculations pass unit and integration tests;
- WAVE AI routes and usage dashboard reject repreneur and anonymous personas;
- build, lint, tests, data-model check and pnpm design:check pass;
- desktop and mobile browser QA passes with owned staff, repreneur, empty-repreneur and unassigned personas.

Production publication, migration application, PDR completion and stakeholder communication remain separate release gates.
