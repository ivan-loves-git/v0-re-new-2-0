# Re-New Development and Release Operating Model

**Status:** Canonical technical operating contract

**Owner:** Codex owns delivery; Ivan owns product intent and the decisions reserved below.

**Purpose:** Make development feel like “built, tested, released” or “blocked for one clear reason” while keeping scope, code, evidence, environments, and authority distinct.

## One accountable owner

Ivan speaks primarily with Codex. Codex owns the path from a rough request to a verified release:

1. Understand the non-developer request and inspect current facts.
2. Clarify only ambiguity that materially changes behaviour, risk, cost, authority, or an irreversible action.
3. Translate the intent into a developer-grade specification. Before changing product behaviour, record the approved scope and acceptance criteria in the current PDR Work Card; the specification remains subordinate to that card.
4. Keep the implementation aligned with the PDR and the relevant canonical contract.
5. Implement once on an isolated development branch.
6. Classify risk and run proportional checks and QA.
7. Review the evidence, publish when authorised, and verify production.
8. Report one integrated result in plain language.

Codex remains accountable when it uses temporary reviewers, subagents, humans, or external coding tools. These are bounded tools, not parallel project managers. They return a completion packet and terminate; their live conversations are not project state.

Do not create a second tracker, duplicate backlog, permanent supervisor agent, AI-to-AI messaging loop, or competing status vocabulary.

## Sources of truth

Keep each concern in its proper system:

| Concern | Source of truth | What it proves |
| --- | --- | --- |
| Approved product scope and status | Live WAVE Strategic PDR | Acceptance criteria, dependencies, owners, decisions, and product status |
| Durable business, data, permission, and lifecycle rules | Relevant canonical contract, including `docs/data-models/ma-advisory-data-model-v1.md` | The meaning the implementation must preserve |
| Implementation candidate | Exact GitHub branch, commit, and pull-request diff | The code proposed for release |
| Automated verification | CI results for the exact commit | The checks that ran and their result |
| Candidate behaviour | Exact-candidate QA deployment plus browser, persistence, read-back, and cleanup evidence | What the candidate did in the isolated environment |
| Deployed environment | Vercel and Supabase state | Which code and data environment are actually present |
| Released user behaviour | Production deployment identity plus live browser proof | What users can use now |

One layer never substitutes for another. A PDR approval is not implementation proof; green tests are not browser proof; a Ready deployment is not behaviour proof; an agent message is not merge proof; and a QA failure must be attributed to the product, test, data, controller, or provider layer before drawing a product conclusion.

The PDR remains the only current backlog and product-status surface. GitHub and QA retain technical evidence; do not copy their internal run-by-run state into a parallel tracker.

## Development and release ladder

All production code is written once:

1. Start from current `origin/main` in a clean isolated branch or worktree. Preserve dirty or unrelated worktrees.
2. Implement the approved behaviour once.
3. Run focused local checks, then CI for the exact candidate.
4. When its risk tier requires it, deliberately admit that exact candidate to the isolated QA environment. Random branch pushes must not enter QA automatically.
5. Use QA-only synthetic fixtures, verify persisted results where applicable, and prove cleanup and zero residue.
6. Review the exact diff and evidence. Do not rebuild a different QA or production version.
7. Merge the same approved code into `main` when release authority exists.
8. Allow the normal production deployment and verify its exact main SHA.
9. Prove the changed live journey in a production browser, within safe production-data boundaries.

QA holds the latest candidate deliberately admitted for testing, not every branch. Production must not receive a significant feature before required QA, except for a documented emergency incident decision with explicit authority and a rollback path.

Branch protection remains enabled with `Verify` as the required status during the pre-beta phase. `P1-P3 protected pilot` is selective Tier 3 release evidence, not a branch-protection requirement. This separation lets controller repairs merge after green code verification without weakening high-consequence product-release proof. Any temporary exception to the remaining protection must be explicitly authorised, limited to the named requirement and exact commit, restored immediately after the operation, and read back before proceeding.

## Proportional QA

Classify the highest consequence introduced by the change. `Verify` is the universal automated check for runtime code. The permanent protected P1-P3 lane is selective: use it only for Tier 3. Tier 2 uses its relevant exact-candidate journey, while Tier 0 and Tier 1 do not dispatch Golden Journeys.

### Tier 0 — no runtime code

Examples: strategy, communication, PDR wording, and internal documentation.

Required: review the changed document and its authority links. No software QA or production deployment proof is required solely for the document change.

### Tier 1 — low-risk presentation

Examples: copy, labels, colour, spacing, or an isolated harmless layout.

Required: a focused test or contract check where relevant; typecheck, lint, design check, and build as appropriate; and an automated preview or lightweight visual check. Do not create an elaborate synthetic-data programme unless behaviour is affected.

### Tier 2 — behavioural product change

Examples: bug fixes, forms, navigation, new user actions, and state transitions.

Required: focused automated tests; an exact-candidate preview or other bounded test surface; the relevant browser journey; persistence/read-back proof for writes; and cleanup proof. Do not invoke the full permanent P1-P3 lane solely because runtime code changed.

### Tier 3 — high-consequence change

Examples: authentication, authorization, confidentiality, visibility, data models, migrations, destructive actions, lifecycle rules, and production data operations.

Required: the full QA environment and protected P1-P3 lane on the exact candidate; synthetic fixtures; direct-URL and role-boundary tests; persistence and cleanup invariants; independent review; a rollback plan; and separate explicit authority for any production migration, backfill, or other production-data mutation.

Do not inflate a low-risk UI edit into a high-risk release programme. Do not reduce a high-consequence change to unit tests.

### GitHub enforcement

- `Verify` is the only universal required status check on `main`.
- `P1-P3 protected pilot` is selective Tier 3 release evidence, not a universal branch-protection requirement.
- Codex records `QA tier: <0-3> — <reason>` in the pull request before merge and remains accountable for applying the required evidence. A direct-main emergency or documentation-only exception retains the same classification in an explicitly linked release record.
- A Tier 3 candidate must not merge until its exact-candidate protected P1-P3 check succeeds. Tier 2 requires its named relevant journey; Tier 0 and Tier 1 do not require P1-P3.
- Do not add a second classifier bot, label workflow, or approval system while Codex remains the single merge owner. Revisit conditional automation only if independent merge authority materially expands.

## Release authority and hard boundaries

A request to build authorises scoped branch implementation, normal verification, and a reviewed candidate. Publication to `main` and production requires explicit publication authority, unless Ivan has already granted a clearly scoped release window. During such a window, do not repeatedly ask for the same approval; apply it only to candidates that are independently ready and within the stated scope.

Publication authority never silently includes:

- production migrations, backfills, destructive changes, or other production-data mutations;
- credential, access, billing, provider, or security-posture changes;
- external stakeholder messages; or
- scope beyond the approved cards or specification.

These require their own explicit authority. A Tier 3 data operation must name the exact manifest or migration, preflight, rollback, and post-operation checks before execution.

## External coding specialists

Codex is the default implementation environment. Cursor, another AI, or a human developer may be recommended only when a package is code-heavy, self-contained, independently testable, and likely to save meaningful capacity without excessive handoff cost.

Appropriate packages include one bounded implementation, one reproducible bug, a focused test suite, a mechanical refactor or dependency upgrade, a measurable performance investigation, or an independent read-only review of an exact PR, module, or architecture decision.

Do not delegate overall product ownership, vague strategy, PDR management, product decisions, production publishing, production data, stakeholder communication, agent coordination, or open-ended “improve everything” work. Security delegation is bounded and normally read-only; generic work packets never receive production credentials or live-scanning authority. Architecture review and architecture implementation are separate by default.

When Ivan accepts the recommendation, Codex provides one vendor-neutral Markdown work packet with these exact sections:

```markdown
# TASK
One sentence describing the required outcome.

## SOURCE OF TRUTH
Exact PDR card, specification, contract, baseline SHA, or PR.

## ALLOWED SCOPE
The precise modules, files, or workflow that may change.

## ACCEPTANCE CRITERIA
Observable conditions proving completion.

## FORBIDDEN
No unrelated refactoring, main merge, production deployment, production data,
PDR mutation, access changes, or external communication.

## VERIFICATION
Exact focused tests, typecheck, lint, design check, build, and browser checks.

## RETURN
Branch, full commit SHA, PR, exact changed files, test evidence, residual risk,
and unresolved questions.

## STOP
Stop when the reviewed candidate is ready. Do not publish unless this packet
explicitly grants publication authority.
```

The specialist works in one isolated environment and returns one completion packet. GitHub commits, tests, and the final diff are the supervision mechanism. No permanent Codex conversation watches it type. If the provider disappears, the same packet must remain executable without changing the project architecture.

## Temporary reviewers and subagents

Use temporary agents only for concrete, bounded work such as an independent risk review, an exact evidence audit, or a parallel test lane. Codex gives each one a narrow input and receives a finite completion packet. When the packet is integrated or rejected, the agent terminates. No agent owns a second backlog, publishes independently, or becomes a permanent control room.

## QA data, credentials, and infrastructure

- QA uses the isolated validation Vercel project and the isolated QA Supabase environment. Synthetic fixtures must be identifiable, least-privileged, and removed or intentionally retained under an approved invariant.
- Production personas and real customer or team records are not the primary test harness. Production verification is scoped to safe proof of the released behaviour; any write requires explicit production-data authority.
- Secret values live only in the approved local secret source, GitHub environment `qa-pilot`, or the appropriate Vercel/Supabase project settings. Never put values in code, tracked documents, PR text, logs, screenshots, agent packets, or chat.
- Ivan is the access authority. An authorised repository or provider administrator performs storage and rotation; Codex may coordinate and verify names, scopes, expiry, and successful use without revealing values.
- QA deployment tokens must be least-privileged, scoped to the validation project where the provider supports it, and rotated after exposure, suspected compromise, ownership change, or the agreed expiry. Production credentials are never shared with a generic specialist packet.
- Provider configuration, branch protection, aliases, and cleanup invariants are verified without exposing values. A successful controller run does not prove the product feature; it proves only the lane used to test it.

Once the core QA lane has one clean end-to-end run and its protection/configuration is restored, it becomes background machinery. Freeze further QA-infrastructure development unless a defect directly blocks a real Tier 3 release or creates a security or data risk.

One automatic retry may be used only for the same candidate SHA and a documented transient provider or controller category, such as rate limiting, temporary provider unavailability, or a bounded readiness or alias-propagation timeout. Contract, schema, isolation, authentication, authorization, cleanup, or residue mismatches are not retryable and require diagnosis. A second same-SHA failure in an eligible transient category stops the release; it does not authorize continued controller development or bypass required Tier 3 evidence. A bounded manual isolated proof or another controller repair or simplification requires an explicit decision.

## Completion and reporting

Before calling a release complete, reconcile the PDR status, exact merged code, required CI/QA evidence, deployed environment identity, and live production proof. Preserve technical details in GitHub and CI.

Default report to Ivan:

- **PRODUCT:** what users can now do.
- **STATUS:** built, tested, released, or blocked.
- **EVIDENCE:** one or two plain-language facts.
- **NEXT:** the next already-authorised PDR or release action, or none.
- **DECISION NEEDED:** none, or one precise material decision.

PR numbers, SHAs, workflow runs, controller internals, and sanitizer details belong in a compact technical-evidence section only when needed or requested.
