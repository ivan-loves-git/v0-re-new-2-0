---
phase: 2
reviewers: [claude]
reviewed_at: 2026-05-17T11:19:26.566384+00:00
plans_reviewed: [02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md]
attempted_reviewers: [gemini, claude, cursor]
blocked_reviewers:
  gemini: model capacity exhausted
  cursor: authentication required
  codex: skipped because current session is Codex and review should be independent
---

# Cross-AI Plan Review — Phase 2

## Claude Review

# Cross-AI Plan Review: Phase 2 Core Deal Workflow

## Plan 02-02: Repreneur Opportunity Access and Anonymized Detail

### Summary
Solid foundation plan that scopes correctly to read-only anonymized access via email matching. Already executed (all tasks checked). Main residual risk is the email-matching coupling — fine for June but fragile if a repreneur changes their auth email or has multiple identities.

### Strengths
- Explicit allowlist of statuses (`proposed`, `interested`, `active_pursuit`) prevents leaking drafts.
- Negative acceptance criteria ("login with no matching profile sees no data") is the right shape — proves isolation, not just functionality.
- Clear field-level exclusion list (source/contact, raw description, notes, documents).

### Concerns
- **MEDIUM** — Email matching has no fallback if `user.email` ≠ `repreneurs.email` (case sensitivity, plus-addressing, email change). Not stated whether comparison is normalized.
- **LOW** — No mention of how the `[matchId]` route validates ownership server-side. Should be enforced in the data loader, not just by listing UI.
- **LOW** — No explicit test for "repreneur sees opportunity that was once proposed but later set to `staff_only`" — visibility toggle race not covered.

### Suggestions
- Add server-side ownership check at the action/loader layer: `match.repreneur_id` must resolve back to the current user's email lookup, independent of route param.
- Normalize email comparison (`lower(email)`) on both sides.
- Add a row to acceptance criteria covering opportunity visibility flip from proposed → `staff_only`.

### Risk: **LOW** (already executed; verification looks complete)

---

## Plan 02-03: Split Staff Dashboard and Repreneur Portal

### Summary
Good architectural split that future-proofs the product for distinct user surfaces. Introduces an `app_user_role` table — small piece of scope creep but defensible given REP-05 explicitly calls for portal separation. Profile page (REP-06) bundled here, which is reasonable since it shares the portal shell.

### Strengths
- Explicit non-goals (no `/staff/*` migration, no seller portals) prevent the refactor from sprawling.
- Adding role table now is cheaper than retrofitting later when third-party access arrives.
- Read-only profile correctly sidesteps the REP-04 self-service trap.

### Concerns
- **MEDIUM** — "Route logged-in users to the correct surface after login" — the routing logic source of truth isn't specified. Is it role table, email match, or both? If both, what wins on conflict?
- **MEDIUM** — Profile "scores, strengths, improvement points, calls to action" is vague. What data source? If derived from existing repreneur scoring, fine; if new fields needed, that's hidden schema work.
- **LOW** — Legacy `/my-opportunities` redirect strategy unclear. 301? Server redirect in middleware? Bookmarks/emails containing old URLs will break silently if not handled.
- **LOW** — No mention of what happens to a user with BOTH a staff role and a `repreneurs.email` match (Bertrand testing as a repreneur, etc.).

### Suggestions
- Add an explicit precedence rule: staff role wins over repreneur email match, OR a UI affordance to switch.
- Lock the profile page data contract before building UI — list exactly which fields/scores are sourced.
- Redirect old `/my-opportunities` → `/portal/deals` at middleware level with 308 to preserve bookmarks.
- Add acceptance criterion: "User with staff role accessing `/portal/*` is redirected to staff dashboard" (and vice versa).

### Risk: **MEDIUM** (routing/auth boundaries are easy to get subtly wrong; affects all later plans)

---

## Plan 02-04: Interest / Reject Actions and Staff Review Flow

### Summary
Tight, well-scoped plan that correctly resists the temptation to chain interest → auto active-pursuit. The `reviewed_by`/`reviewed_at` reset pattern is the right primitive for a queue. Risk surface is small.

### Strengths
- Explicit out-of-scope list (no NDA gating, no notifications, no free-text) — this is the discipline the PROJECT.md asks for.
- Reusing existing `opportunity_matches.status` values rather than inventing new ones keeps the data model coherent.
- "Mark reviewed without changing status" — correctly separates acknowledgement from progression.

### Concerns
- **MEDIUM** — No idempotency story. What happens if a repreneur double-clicks "I'm interested"? Or toggles interested → declined → interested? Does that reset `reviewed_at` each time and flood the queue?
- **MEDIUM** — No audit trail. If a repreneur changes their mind, the prior state is lost. Even a single `responded_at` timestamp would help, but it's not mentioned.
- **LOW** — "Staff can mark reviewed" — single boolean? Or per-staff-user acknowledgement? Multi-staff teams will collide.
- **LOW** — No mention of what the portal shows AFTER the repreneur responds. Does the action button disappear? Does it show "you said: interested"? UI feedback gap.

### Suggestions
- Add toggle/idempotency rule: explicit acceptance criterion for what happens on re-clicks and status flips.
- Add `responded_at` timestamp on the match, separate from `reviewed_at`, to preserve the response history.
- Define post-response portal UI state explicitly.
- Consider whether `declined → interested` should re-queue or be blocked.

### Risk: **MEDIUM** (the state-machine edges are where this will leak)

---

## Plan 02-05: Validated Pursuit, Active Lock, and Reopen Logic

### Summary
The most critical plan in the phase — it's the actual business control point Bertrand needs. Database-level lock is the right call. Plan is already executed per the roadmap. Main concern is whether the lock truly handles all reopen edge cases atomically.

### Strengths
- **DB-level uniqueness guard, not UI-only** — exactly right. This is the single most important architectural decision in the phase.
- Reopen path is explicit, not an afterthought.
- Repreneur portal state correctly frozen once active.
- Lock state surfaced in recommendations UI — staff won't blindly try to validate a second match.

### Concerns
- **HIGH** — Partial unique index implementation isn't specified. The right pattern is `UNIQUE (opportunity_id) WHERE status = 'active_pursuit'`. If implemented as full unique on `(opportunity_id, status)`, dropping creates a row that conflicts with future reopens. Worth verifying against the actual migration.
- **MEDIUM** — Race condition on validate: if two staff click validate on different interested matches simultaneously, only one wins at DB level — but does the loser get a clear error? Or a 500?
- **MEDIUM** — "Repreneur portal access read-only once active" — but the *active* repreneur presumably still needs to see status. Plan doesn't distinguish "the active repreneur" vs "other proposed repreneurs whose match is now stale."
- **MEDIUM** — Reopen path: when a dropped match reopens, what state does it return to? `interested`? `proposed`? If interested, it reappears in the review queue — good. But is the prior `reviewed_at` cleared so staff sees it as new?
- **LOW** — No mention of what happens to other `interested` matches on the same opportunity when one is validated. Do they auto-decline? Stay interested but hidden? Stay visible but un-validatable?

### Suggestions
- Verify the SQL uses a partial unique index, not a composite unique on status.
- Add explicit error UX for lock-conflict on simultaneous validation.
- Define the "other interested repreneurs" state during active pursuit — likely: stay `interested`, but UI hides the deal from their portal until pursuit drops.
- Specify reopen target state (recommend: `interested` with `reviewed_at` cleared).
- Add an acceptance criterion: "After validate → drop → reopen → validate-different-repreneur, the original repreneur's match status is preserved correctly."

### Risk: **MEDIUM-HIGH** (correctness of the lock + reopen interaction is the load-bearing piece for the whole phase; needs the most verification)

---

## Phase-Level Assessment

### Cross-Plan Risks
- **HIGH** — `opportunity_matches.status` is now a small state machine driven by 4 plans (02-02 reads it, 02-04 writes interested/declined, 02-05 writes active_pursuit/dropped). No single document defines the full transition graph. Recommend extracting a one-page state diagram before completing the phase.
- **MEDIUM** — Auth/role precedence (02-03) flows downstream into every portal action (02-04, 02-05). If the role resolution logic isn't pinned down, every "is this user the right repreneur" check repeats the ambiguity.
- **MEDIUM** — No mention of indexes on `opportunity_matches.status` or `repreneur_id`. Review queues and portal lists will scan if not indexed; cheap to add now.

### Phase Goal Coverage
- ✅ Goal items 1, 2, 3, 4 are addressed by plans 02-01 through 02-05.
- ⚠️ Goal item 5 ("NDA/document status visible on the relevant pursuit") — covered only by 02-07 which is still pending. The phase is not complete until that ships.
- ⚠️ DEAL-04 (stage tracking) and NDA-01/02/DOC-01 still pending — roughly 40% of the phase requirement set.

### Overall Phase Risk: **MEDIUM**
The completed plans are well-scoped and the lock-based design is sound. Residual risk concentrates in (a) the unified state machine across plans, (b) routing/role precedence, and (c) verification that the active-pursuit DB constraint is a partial unique index, not a full composite. The remaining two plans (02-06 stages, 02-07 NDA/docs) are non-trivial and currently unwritten.

### Recommended Pre-Completion Actions
1. Write a one-page state diagram of `opportunity_matches.status` showing all legal transitions and which plan/action owns each edge.
2. Verify the 02-05 migration uses a partial unique index.
3. Document the role-precedence rule from 02-03 in a single place all downstream plans reference.
4. Draft 02-06 and 02-07 before declaring the phase ready for UAT — the success criteria explicitly require NDA visibility.

---

## Gemini Review

Gemini review failed.
Loaded cached credentials.
Attempt 1 failed: You have exhausted your capacity on this model.. Retrying after 10000ms...
Attempt 2 failed: You have exhausted your capacity on this model.. Retrying after 10000ms...
Error when talking to Gemini API Full report available at: /var/folders/4g/j_m45c8n2f38m610kjz1thd00000gn/T/gemini-client-error-Turn.run-sendMessageStream-2026-05-17T11-15-55-441Z.json
[API Error: You have exhausted your capacity on this model.]
An unexpected critical error occurred:
[object Object]

---

## Cursor Review

Cursor review failed.
Error: Authentication required. Please run 'cursor agent login' first, or set CURSOR_API_KEY environment variable.

---

## Consensus Summary

Only Claude returned a substantive review. Gemini was available but could not run because the configured Gemini account exhausted capacity on the selected model. Cursor was installed but could not run because `cursor agent` requires login or `CURSOR_API_KEY`. Codex was intentionally skipped because this session is already Codex and the review is meant to bring in independent judgment.

Because there is only one substantive review, the points below are not a true cross-reviewer consensus. They are the main planning risks raised by Claude and should be treated as high-signal review input for the next planning pass.

### Agreed Strengths

- The phase plans are generally well-scoped and resist premature expansion into AI matching, seller portals, full CRM, or automated deal progression.
- The staff/repreneur access split is directionally strong and supports the June workflow without exposing staff-only deal data.
- Active pursuit validation and lock handling are focused on the right business invariant: one live pursuit per opportunity until it is dropped or closed.

### Agreed Concerns

- Role and identity resolution need explicit precedence rules, especially when a user can be staff and also match a repreneur email.
- Repreneur response state needs clearer edge-case behavior for repeated clicks, status changes, and re-queueing after a declined or changed response.
- Route-level and loader-level ownership checks should be explicit so direct URL access cannot expose another repreneur's match.
- Stage tracking and active-pursuit transitions need a tight state machine so dropped, closed, reopened, and hidden matches stay consistent.

### Divergent Views

No divergent views could be assessed because only one reviewer returned substantive feedback.
