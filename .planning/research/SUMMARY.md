# Project Research Summary

**Project:** Wave CRM (Re-New Platform) - v2 Questionnaire Launch Readiness
**Domain:** Internal CRM with file uploads, scoring system, and candidate pipeline
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

The Re-New Platform is an internal CRM built on Next.js 16 + Supabase, currently blocked by three critical bugs preventing v2 questionnaire launch. Research reveals these are **well-documented issues with proven fixes**: file uploads fail due to a routing mismatch (calling `/api/upload` instead of `/api/upload-cv`) and missing Buffer conversion; admin scoring edits don't persist due to RLS silent failures; and the platform needs proper database export before any data cleanup.

The recommended approach follows **existing patterns already in the codebase**. The `Tier1InlineEditor` component demonstrates the exact popup editing pattern needed for WHO/WHEN parameter editors. The `scoring-v2.ts` library shows how to calculate and persist scores atomically. The challenge is not technical complexity but systematic elimination of bugs that have clear, documented solutions.

Key risks center on **data integrity during launch**: file uploads that appear successful but produce corrupted 15-byte files, score edits that seem to save but silently fail due to RLS policies, and cascade deletes during cleanup that could destroy more data than intended. Mitigation requires following strict checklists (export before cleanup, verify with `.select()` after mutations, convert Files to Buffers before upload) and testing with production-sized data before mass launch.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, Supabase, shadcn/ui) is well-suited for this milestone. No new technologies needed.

**Stack validation:**
- **Next.js 16 App Router** — Server Actions already in use for mutations, requires `bodySizeLimit` config increase to 10MB for file uploads
- **Supabase Storage** — CV/document storage working but needs Buffer conversion fix in upload route
- **shadcn/ui Dialog** — Modal pattern proven in `Tier1InlineEditor`, ready for reuse
- **Supabase RLS** — Active but causing silent failures; admin operations should use `createAdminClient()` to bypass

**Critical configuration needed:**
- `next.config.mjs`: Set `serverActions.bodySizeLimit: "10mb"` (default 1MB fails silently for larger files)
- `/api/upload-cv/route.ts`: Convert `File` to `Buffer` before Supabase upload to prevent 15-byte garbage files

### Expected Features

Research focused on **bug fixes and polish** for relaunch, not new features. All core functionality exists but needs reliability improvements.

**Must have (P0 - blocking launch):**
- File upload fix — CV uploads currently fail, need routing correction and Buffer conversion
- Score persistence fix — Admin edits don't save due to RLS silent failures
- Database export — Pre-cleanup backup before any data operations
- Declined status — Add to pipeline taxonomy (distinct from Rejected)

**Should have (P1 - polish for relaunch):**
- WHO/WHEN popup editors — Allow admin correction of answers with automatic recalculation
- Two-field score pattern — Separate `calculated_score` from `override_score` for audit trail
- Upload progress feedback — Use XMLHttpRequest for progress tracking (Fetch API doesn't support)

**Defer (v2+):**
- Fuzzy duplicate detection — Email uniqueness constraint sufficient for now
- Real-time updates — `revalidatePath()` sufficient for current usage patterns
- Advanced email personalization — Start with segmented messaging, iterate based on engagement

### Architecture Approach

The codebase already contains **proven patterns for all required features**. Research validates these existing implementations rather than suggesting new architectures.

**Major components and patterns:**

1. **Popup editing with local state** — `Tier1InlineEditor` demonstrates the pattern: controlled Dialog with `useState` for local edits, single "Calculate & Save" button calls server action, `useTransition` for loading state, reset state on dialog open. WHO/WHEN editor should clone this exact pattern.

2. **Atomic score recalculation** — Server actions should update answers and recalculate scores in a single database write. The `calculateDualScore()` function in `scoring-v2.ts` shows the calculation logic; new server action `updateWhoWhenAnswers()` should batch answers + scores + breakdown in one `.update()` call, then revalidate affected paths.

3. **File upload with admin bypass** — Public intake forms have no authenticated user, so upload routes must use `createAdminClient()` service role to bypass RLS. Current routes have this pattern but need Buffer conversion fix: `await file.arrayBuffer()` → `Buffer.from(arrayBuffer)` → upload with `contentType` option.

4. **Database export before cleanup** — Three-phase workflow: (1) Export matching records to timestamped JSON with count verification, (2) Human review of export, (3) DELETE in transaction with RETURNING to verify count. Script template in ARCHITECTURE.md provides the implementation pattern.

### Critical Pitfalls

Research identified **four showstopper bugs** plus delivery risks for email relaunch:

1. **File uploads produce 15-byte garbage files** — Passing `File` object directly to `supabase.storage.upload()` uploads only metadata. Must call `await file.arrayBuffer()` and convert to `Buffer.from()` first. This bug has no error message and appears successful until user tries to open the file. **Affects**: File Upload Bug Fix phase.

2. **RLS policies silently block updates with no error** — Supabase `.update()` returns `{ error: null, data: [] }` when RLS blocks the operation. Admin scoring edits appear to succeed but don't persist. **Solution**: Always chain `.select().single()` after mutations to verify data was written, or use `createAdminClient()` for admin operations. **Affects**: Data Persistence Bug Fix phase.

3. **Server Actions have silent 1MB body limit** — Files over 1MB fail before your code executes, with no error reaching catch blocks. **Solution**: Set `next.config.mjs` → `experimental.serverActions.bodySizeLimit: "10mb"` and force fresh Vercel deployment to apply. **Affects**: File Upload Bug Fix phase.

4. **React state shows stale data after mutation** — Even after successful database update, UI may show old values due to Next.js cache not invalidating. **Solution**: Call `revalidatePath()` for ALL affected routes after mutation (dashboard, pipeline, profile, list views), not just the immediate path. **Affects**: Data Persistence Bug Fix phase.

5. **Email relaunch hits deliverability walls** — Mass email to inactive candidates (90+ days) causes high bounce rates and spam flags, damaging sender reputation for future emails. **Solution**: Verify email list before sending, segment by recency (send to active users first), stagger sends over days, monitor bounce/complaint rates between batches. **Affects**: Launch Preparation phase.

## Implications for Roadmap

Based on bug severity and dependencies, suggested phase structure:

### Phase 1: Critical Bug Fixes (P0)
**Rationale:** Blocks all user-facing functionality; must fix before any launch activity.
**Delivers:** Working file uploads, persistent score edits, stable foundation.
**Addresses:**
- Fix upload route path (`/api/upload` → `/api/upload-cv`) in `step-contact.tsx`
- Add Buffer conversion in `/api/upload-cv/route.ts`
- Increase `bodySizeLimit` to 10MB in `next.config.mjs`
- Add `.select().single()` after all `.update()` calls to detect RLS failures
- Verify `createAdminClient()` used for admin operations
**Avoids:** 15-byte file pitfall, RLS silent failure pitfall, 1MB body limit pitfall.
**Research needed:** NO — bugs are well-documented with proven fixes.

### Phase 2: Database Export & Cleanup (P0)
**Rationale:** Must happen BEFORE any mass operations or data deletion; sets up audit trail.
**Delivers:** Timestamped database backup, verified export with record counts.
**Addresses:**
- Create `scripts/export-before-cleanup.ts` using pattern from ARCHITECTURE.md
- Run export for records matching cleanup criteria
- Verify JSON file parses and matches expected count
- Commit export to git for audit trail
**Avoids:** Data loss from cleanup, migration history corruption pitfall.
**Research needed:** NO — Supabase backup patterns are standard and documented.

### Phase 3: WHO/WHEN Popup Editors (P1)
**Rationale:** Required for admin workflows but not blocking candidate-facing features.
**Delivers:** Inline editors for WHO/WHEN parameters with automatic score recalculation.
**Addresses:**
- Clone `Tier1InlineEditor` pattern to create `WhoWhenInlineEditor`
- Add server action `updateWhoWhenAnswers(id, answers)`
- Batch update answers + recalculate scores + update breakdown in single DB write
- Wire editor into repreneur profile page
**Implements:** Dialog with local state, atomic recalculation architecture.
**Avoids:** Partial update pitfall by batching all changes.
**Research needed:** NO — exact pattern exists in `tier1-inline-editor.tsx`.

### Phase 4: Launch Preparation (P1)
**Rationale:** Email deliverability and messaging quality determine relaunch success.
**Delivers:** Verified email list, segmented batches, personalized messaging.
**Addresses:**
- Add Declined status to pipeline taxonomy
- Verify email list (remove invalid addresses)
- Segment candidates by engagement recency
- Draft personalized email variants by segment
- Set up monitoring for bounce/complaint rates
**Avoids:** Deliverability wall pitfall, spam perception pitfall.
**Research needed:** NO — email best practices are well-documented.

### Phase 5: Polish & Nice-to-Haves (P2)
**Rationale:** Quality-of-life improvements that don't block launch.
**Delivers:** Two-field score override pattern, upload progress UI, fuzzy duplicate detection.
**Addresses:**
- Add `score_override` + `score_override_reason` columns
- Implement XMLHttpRequest upload progress (Fetch API doesn't support)
- Add visual indicators for manual score overrides
**Research needed:** NO — patterns are proven and well-documented.

### Phase Ordering Rationale

- **Phase 1 first** because file uploads and score edits block ALL admin workflows. Cannot launch questionnaire if CV uploads fail or scoring doesn't persist.
- **Phase 2 before Phase 3** because any database operations need pre-existing backup. Admin editors might trigger data migrations or cleanup that require export protection.
- **Phase 3 before Phase 4** because admin team needs functioning editor tools to prepare candidate data before mass email launch.
- **Phase 4 must complete** before announcing relaunch to candidates. Email deliverability issues damage sender reputation permanently.
- **Phase 5 is async** — can happen in parallel with Phase 4 or defer entirely to post-launch.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **All phases** — This milestone uses only established Next.js, Supabase, and React patterns. All bugs have documented solutions. All features have working examples in the codebase. No novel integration or niche domain complexity.

**No deeper research needed during planning.** Proceed directly to requirements definition.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new technologies; configuration fixes for existing setup |
| Features | HIGH | All patterns exist in codebase; research validated implementations |
| Architecture | HIGH | Existing components demonstrate working patterns to clone |
| Pitfalls | HIGH | All bugs verified in official docs and GitHub issues |

**Overall confidence:** HIGH

### Gaps to Address

No significant gaps discovered. All research areas resolved to documented solutions:

- **File upload bugs** — Verified in Supabase GitHub issues with reproducible examples and fixes
- **RLS silent failures** — Documented in Supabase troubleshooting guides with detection methods
- **Score editing patterns** — Existing `Tier1InlineEditor` provides complete reference implementation
- **Email deliverability** — Standard best practices for SaaS relaunches with clear metrics to monitor

**One operational note:** Test file uploads with production-sized files (5-10MB PDFs) on Vercel after deploying `bodySizeLimit` config change. Local dev environment may not replicate Vercel's request handling.

## Sources

### Primary (HIGH confidence)
- `/components/repreneurs/tier1-inline-editor.tsx` — Working modal editor pattern
- `/lib/scoring-v2.ts` — Score calculation implementation
- `/app/api/upload-cv/route.ts` — Current upload route (needs Buffer fix)
- [Supabase Storage GitHub Issue #86](https://github.com/supabase/storage/issues/86) — 15-byte file bug with fix
- [Next.js Server Actions Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — Body size limit documentation
- [Supabase RLS Troubleshooting](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8) — Silent failure detection
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog) — Modal component API

### Secondary (MEDIUM confidence)
- [Supabase Backups Guide](https://supabase.com/docs/guides/platform/backups) — Export procedures
- [Gmail 2025 Email Requirements](https://www.emailindustries.com/email-deliverability/gmail-strengthens-bounce-policies-for-november-2025/) — Deliverability standards
- [SaaS Email Launch Tactics](https://www.dansiepen.io/growth-checklists/saas-product-updates-feature-launch-email-tactics) — Messaging patterns

### Tertiary (LOW confidence)
- None — all findings verified against primary sources

---
*Research completed: 2026-01-26*
*Ready for roadmap: YES*
