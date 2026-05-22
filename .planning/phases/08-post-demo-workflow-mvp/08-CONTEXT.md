# Phase 8: Post-demo Workflow MVP - Context

**Gathered:** 2026-05-22
**Status:** Ready for research and planning
**Source:** PRD Express Path (`.planning/briefs/2026-05-22-founder-demo-actions.md`)

<domain>

## Phase Boundary

Phase 8 converts founder demo feedback into the next usable Re-New operating workflow. The phase should make real opportunity creation/editing clearer, make matching visible from both opportunity and repreneur directions, and reduce Bertrand's manual coordination when a repreneur interest becomes an M&A firm NDA/info memo request.

The phase is not a broad V3 expansion. It must stay close to the workflows observed during the live demo and preserve the current staff-first operating model.

</domain>

<decisions>

## Locked Decisions

### Immediate Usability

- Fix the portal access enablement error before expanding the portal workflow.
- Add search to repreneur selectors where staff need to pick or preview a repreneur, especially portal preview and opportunity recommendation screens.
- Fix opportunity edit save feedback so successful saves do not leave the UI looking stuck.
- Slow dashboard navigation was handled as a separate architecture stabilization session on 2026-05-22. Keep the Cache Components, cached dashboard snapshot loaders, route loading boundaries, and targeted index pattern; do not reintroduce dashboard route remount wrappers or broad repeated Supabase reads.
- Future Phase 8 screens should reuse the cached snapshot/data-loader pattern when they need dashboard/list data, and should invalidate the matching cache tag after writes.

### Opportunity Creation and Intake

- Add a clear opportunity creation entry point if the current one is hidden or missing.
- Use the existing Excel structure as the source for mandatory opportunity fields.
- Required opportunity fields should warn before save.
- M&A firm, contact name, and contact email should be reliably stored for each opportunity. This is believed to already exist, so verify before changing.
- Add or expose a simple teaser/summary text field for entrepreneur-visible opportunity information.
- Do not add info memo storage in this phase.
- Do not build full PDF-to-opportunity AI ingestion in this phase.
- Keep JSON/ChatGPT-assisted opportunity import in the parking lot for V4 unless research proves it is a tiny, low-risk extension.

### Matching and Repreneur View

- Each repreneur profile should show associated opportunities/matches with scores and statuses.
- Recommended repreneurs should be visible prominently on the opportunity overview, not only inside a deeper recommendation tab.
- Verify whether `opportunity_matches` already supports the reverse view before adding schema.

### NDA and Info Memo Workflow

- Add an "info memo received" pursuit stage, or a shorter equivalent label.
- The new stage belongs before intermediary meeting.
- When a repreneur expresses interest and staff validates pursuit, staff should be able to prepare and send an email to the M&A firm requesting NDA/info memo.
- The email should include repreneur profile or fiche de cadrage context where available.
- Staff should receive reminders if the NDA/info memo process has not moved after a few days.
- Keep the legal rule: M&A firms require the candidate/repreneur to sign their NDA; Re-New cannot replace this with a generic Re-New NDA.

### Field Cleanup

- Review "anonymized description"; remove or rename it if teasers are already anonymous.
- Review "source notes", "visibility", "staff only", and "approved/revealed" fields.
- Remove, rename, or hide confusing fields when they do not support the current workflow.
- Confirm whether internal staff notes remain useful now that Colin is joining the workflow.

### Verification

- Build and lint must pass after implementation.
- For navigation-sensitive work, record measured browser timings rather than relying on perceived lag alone. The 2026-05-22 navigation session records its before/after data in `08-NAVIGATION-PERFORMANCE.md` and `docs/solutions/navigation-performance-before-after.svg`.
- Browser UAT must cover portal access enablement, opportunity creation/editing, search selectors, repreneur reverse match view, opportunity overview recommendations, and NDA/info memo request flow.
- Production or production-like testing should use the stored Re-New test credentials from `AGENTS.md`.
- Deferred items must be recorded in roadmap/backlog rather than left as hidden assumptions.

## Agent Discretion

- Choose the exact UI placement for buttons, search inputs, and match summaries based on existing page structure.
- Choose whether to improve slow loading in this phase or record it as a follow-up after profiling.
- Choose the final short label for the "info memo received" stage if a shorter label fits the existing UI better.
- Choose the safest data migration shape if pursuit-stage enum/check constraints require database changes.

</decisions>

<references>

## Source Files

- `.planning/briefs/2026-05-22-founder-demo-actions.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/CONCERNS.md`

## Likely Implementation Areas

- `lib/actions/portal-access.ts`
- `components/repreneurs/portal-access-card.tsx`
- `app/(dashboard)/portal-preview/page.tsx`
- `lib/actions/repreneur-portal-preview.ts`
- `app/(dashboard)/opportunities/[id]/page.tsx`
- `app/(dashboard)/opportunities/page.tsx`
- `app/(dashboard)/opportunities/find/page.tsx`
- `lib/actions/opportunities.ts`
- `lib/actions/opportunity-import.ts`
- `lib/actions/opportunity-matches.ts`
- `lib/actions/ma-workflows.ts`
- `app/(dashboard)/repreneurs/[id]/page.tsx`
- `lib/types/opportunity.ts`
- `lib/utils/opportunity-journey.ts`
- `lib/utils/opportunity-match-scoring.ts`
- `supabase/migrations/`

</references>
