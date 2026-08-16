# WAVE product observability v1

- **Status:** Foundation in progress; platform-wide coverage and cockpit are planned delivery slices
- **Scope:** Product learning and iteration across public, authenticated, staff, repreneur and staff M&A workflows
- **Related AI contract:** [wave-ai-assistance-v1.md](./wave-ai-assistance-v1.md)
- **Canonical business contract:** [../data-models/ma-advisory-data-model-v1.md](../data-models/ma-advisory-data-model-v1.md)

## Outcome

WAVE uses PostHog to understand how the product is actually used and to turn observed friction, drop-off, adoption and reliability evidence into product iterations. The goal is broad behavioural coverage across every WAVE stakeholder surface, not a generic "analytics integration".

"Capture everything useful" means complete, semantic, metadata-only coverage of user journeys and workflow outcomes. It does **not** mean copying product content or the underlying CRM into an analytics platform. Supabase remains the system of record for people, deals, M&A records, documents and AI usage/cost detail.

## Product-intelligence operating model

| Question | Source of truth | Where it is read |
| --- | --- | --- |
| How users move through WAVE, where they drop off and which workflows complete | PostHog event data and saved insights | PostHog and the staff WAVE product-intelligence cockpit |
| AI reliability, token use, cost and reviewed usefulness | Supabase AI generation ledger | WAVE AI Usage dashboard; selected aggregates may be linked from the cockpit |
| Business records, workflow state, matching scores, M&A evidence and documents | Supabase business tables and deterministic services | Existing WAVE operational views |

PostHog is the product-learning plane. It never becomes an alternate CRM, content store or authority for business actions.

## Stakeholder coverage

Instrumentation is designed around semantic journeys and confirmed outcomes—not merely page views.

### Public and authentication

Track the anonymous journey through public pages, intake, assessment, upload, registration, sign-in and role-routing outcomes. The goal is to understand acquisition, activation and validation friction without collecting form contents or identity data.

### Repreneur/client portal

Track the authenticated repreneur journey through deal discovery, proposed/active pursuit views, interest expression, NDA/document gates, profile activity and relevant success/failure states. The goal is to learn where clients activate, progress or disengage.

### Staff CRM and operating work

Track staff workflows across repreneur records, pipeline, offers, email operations and review queues. The goal is to identify operational bottlenecks, recurring failures, unused tooling and workflow completion rates.

### Staff M&A workflows

Track staff use of opportunity, source, office, relationship, interaction, outreach and review workflows. "M&A usage" currently means staff use of WAVE’s M&A surfaces; external M&A contacts are not WAVE product users unless a future product surface gives them access.

### WAVE AI funnel

Track request, generation, render, review and human outcome using opaque generation/trace correlations. AI cost and token detail remain in the Supabase ledger; PostHog measures product adoption and funnel behaviour.

## PostHog project and environments

- Use a separate EU PostHog project named Re-New WAVE in the existing organization.
- Use direct EU ingestion at https://eu.i.posthog.com.
- Never reuse the Mappatella token, project data or configuration.
- Tag all events with environment, release and is_test; local development is excluded by default.
- Keep event data for the longest period supported by the selected PostHog plan.
- Use billing alerts, spike detection and regular usage monitoring rather than an organisation-wide hard cutoff, because that cutoff would discard data for both Re-New and Mappatella.
- Keep Vercel Analytics only for its separate coarse traffic purpose.

## Identity and correlation

- Before login, PostHog uses its anonymous device identity.
- After login, WAVE derives a deterministic analytics-only UUID from the Better Auth user ID and identifies only with that UUID plus the application role.
- The raw authentication ID, name, email address and CRM IDs never enter PostHog.
- Anonymous pre-login activity merges into the authenticated journey after login.
- Logout resets the analytics identity.
- Opaque generation_id and trace_id link relevant AI lifecycle events without revealing a person or business record.

## Event contract

Use a small, explicit event vocabulary with normalized route templates and reusable workflow/action names:

- wave_page_viewed;
- wave_action_started;
- wave_action_succeeded;
- wave_action_failed;
- wave_validation_failed;
- wave_auth_succeeded;
- wave_auth_failed;
- wave_ai_generation_requested;
- $ai_generation for server-side model usage;
- wave_ai_generation_rendered;
- wave_ai_outcome_recorded;
- wave_ai_feedback_submitted.

Every event is validated against an allowlist before transport. The implementation expands semantic action/outcome coverage per stakeholder workflow rather than inventing a new bespoke event for every screen.

Allowed properties include schema version, environment, release, route template, surface, role, workflow, action, outcome, model key, prompt/schema version, status, allowlisted error code, latency bucket, opaque generation/trace IDs and test flag.

Do not send raw prompts, generated drafts, notes, names, email addresses, company names, CRM or business-record IDs, document IDs, identifier-bearing URLs, free-text feedback, provider responses, request/response bodies, cookies, tokens or headers.

### M2 controlled-opening funnel

The M2 technical-readiness release adds a narrow, **server-confirmed** funnel for
the controlled repreneur opening. It uses the existing event names and
allowlisted properties only:

| Confirmed point | Metadata-only contract |
| --- | --- |
| Portal entry | `portal_access` + `access` + `success` |
| Deal list or detail read | `portal_deals` + `open` + `success` |
| Interest or decline saved | `portal_deals` + `express_interest` or `decline` + `success`, `failure`, or `validation_error` |
| Signed NDA upload | `portal_pursuit` + `upload` + `success`, `failure`, or `validation_error` |
| Staff starts/progresses a pursuit, records a gate, or grants/revokes confidential access | `portal_pursuit` + `confirm` or `update` + `success`, `failure`, or `validation_error` |

Failure events may include only one fixed category: `access_denied`,
`validation_failed`, `unavailable`, `persistence_failed`,
`notification_failed`, `upload_failed`, or `internal_error`. They never include
an error message. Server capture runs after the underlying action is committed
or rejected and is swallowed if PostHog is unavailable; analytics cannot change
the outcome of an access, response, document, or pursuit action.

### M2.1 External Pursuit workflow

External Pursuits use the same allowlisted event names and never send dossier,
company, contact, attachment, note, URL, idempotency or database identifiers.
The client page-view and started markers use the normalized `/portal/pursuits`
or `/opportunities/pursuits` route and `external_pursuit` workflow.
The UI emits a completed outcome only after it receives the server action's
successful durable response. This deliberately avoids double-counting a server
action whose first response was lost and then exactly retried.

| Confirmed point | Metadata-only contract |
| --- | --- |
| Create a dossier | `external_pursuit` + `submit` + `success` |
| Edit details, stage, follow-up or contacts | `external_pursuit` + `update` + `success` |
| Add a private attachment | `external_pursuit` + `upload` + `success` |
| Request or fulfil deletion; remove an attachment | `external_pursuit` + `delete` + `success` |

No External Pursuit failure event is currently emitted: the server cannot
always distinguish a rejected mutation from a committed mutation whose response
was lost. Analytics remains optional and never changes access, persistence,
storage or deletion behaviour.

### Client transport recovery

WAVE has no user-facing analytics opt-out. A legacy client fail-safe could
persistently opt a browser out after a transient transport failure; it is
migrated once, at enabled PostHog initialization, by clearing that application-
owned stale state and writing a namespaced recovery marker. The marker prevents
WAVE from overriding any later deliberate PostHog opt-out. Future transient
transport failures detach the local WAVE transport and stop replay only; they
never persist an opt-out. Product actions remain independent of this recovery.

## Replay and automatic diagnostics

Replay and diagnostics are useful for product-learning only when they preserve the same content boundary:

- session replay is masked and retained for 30 days; the current operating choice is 100% capture subject to the mandatory masking boundary;
- text inputs, form values, media and known sensitive DOM regions are masked or blocked;
- query strings and identifier-bearing URL segments are normalized or excluded;
- automatic exception, console and network diagnostics may be enabled;
- AI endpoints, prompts, generated content, authorization headers, cookies, request/response bodies and sensitive headers are always denied from diagnostic capture;
- console statements that emit personal or business data must be removed before diagnostics are enabled.

The current PostHog foundation is not closed until plan-supported event retention, 30-day masked replay, billing alerts/spike monitoring, and live masking/identity proof are recorded.

## Dashboards and staff cockpit

### Current PostHog operational dashboards

1. **WAVE — Product adoption** — public-to-auth journey, active staff/repreneurs and key workflow completion.
2. **WAVE AI — Outcomes and cost** — request-to-render-to-human-action funnel, model reliability, latency and failures.
3. **WAVE — Instrumentation health** — event coverage, unknown routes, client/server gaps and error/replay health.

A transport 200 OK is not evidence of observability. Critical events must be confirmed stored and queryable in the isolated project.

### Planned WAVE product-intelligence cockpit

A staff-only WAVE view will present PostHog aggregates, not raw events, for:

- 7- and 30-day role, route, workflow and funnel views;
- public/auth acquisition and activation;
- repreneur portal activation, deal discovery, interest and gate completion;
- staff CRM and operational workflows;
- staff M&A workflow usage;
- AI request-to-reviewed-outcome adoption, alongside the Supabase ledger’s cost and reliability aggregates;
- instrumentation health and an explicit "as of" time.

The cockpit must not duplicate raw event storage or display prompts, drafts, notes, CRM IDs or diagnostic payloads. It is a decision surface for staff, not a new analytics warehouse.

## Iteration cadence

Product intelligence turns usage data into controlled change:

1. Review saved 7- and 30-day views on a regular product cadence.
2. Identify a concrete friction, drop-off, reliability or adoption signal.
3. Record the evidence, hypothesis and proposed experiment or change in the PDR.
4. Implement only accepted scope through the normal WAVE release controls.
5. Recheck the same cohort/funnel after release and record whether the hypothesis held.

Small counts are shown directly. WAVE does not present forecasts or causal claims without adequate evidence.

## Failure and safety behaviour

- Analytics is optional: absent PostHog configuration disables capture without affecting product workflows.
- A PostHog failure is swallowed after safe local diagnostics; no business action is retried because analytics failed.
- Client-provided context is never treated as canonical business data.
- Correlation IDs are opaque and shared only between safe application logs, the AI ledger and PostHog.

## Acceptance trace

The observability stream is acceptable when:

- the isolated EU project, environment configuration and longest plan-supported event retention are verified;
- stored/queryable events—not only ingestion responses—exist for each critical stakeholder journey;
- anonymous-to-auth merge and logout reset are verified in production;
- 30-day masked replay, billing alerts/spike monitoring and the diagnostic denylist are verified against public, repreneur, staff and AI surfaces;
- public/repreneur instrumentation cannot expose WAVE AI or business content;
- server-confirmed success/failure coverage exists for defined staff CRM and M&A workflows;
- the WAVE cockpit is staff-only and sources product aggregates from saved PostHog queries;
- AI cost and reliability remain sourced from the Supabase ledger;
- the product-review cadence has produced a traceable PDR proposal from observed evidence;
- build, lint, tests, data-model check and pnpm design:check pass.

The AI-specific provider, model, projection, ledger and human-control requirements remain in [wave-ai-assistance-v1.md](./wave-ai-assistance-v1.md).
