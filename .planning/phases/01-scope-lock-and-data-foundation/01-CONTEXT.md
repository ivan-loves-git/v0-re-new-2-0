# Phase 1: Scope Lock and Data Foundation - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning
**Mode:** Auto decisions, worktree branch `codex/gsd-v2-phase1-20260516`

<domain>

## Phase Boundary

Phase 1 delivers the staff-side data foundation for June V2: opportunity schema, field visibility, staff opportunity management, Excel import mapping, basic M&A source/contact fields, and opportunity document attachment storage.

This phase does not build repreneur-facing access, matching, pursuit workflow, NDA workflow, reporting, stale reminders, or V3 automation. Those remain in later phases.

</domain>

<decisions>

## Implementation Decisions

### Opportunity Schema and Visibility

- **D-01:** Use Bertrand's supplied Excel fields as the June source of truth: reference/mandat id, source, location, sector, description, revenue, EBITDA, headcount, and date added.
- **D-02:** Separate staff-only fields from repreneur-visible fields at the data/API layer, not only in UI. Staff-only includes M&A source/contact and any non-anonymized identifiers.
- **D-03:** Preserve enough structure for Phase 2 matching: location, sector/activity, revenue range, EBITDA, headcount, source, and date added should be queryable fields rather than only free text.
- **D-04:** Do not model the full M&A CRM in this phase. Store the source/contact needed to operate an opportunity and leave room for a future normalized CRM.

### Excel Import Behavior

- **D-05:** Build the import as a staff-reviewed mapping flow, not a silent bulk insert. Staff should be able to review mapped rows before final save.
- **D-06:** Treat missing optional fields as warnings and missing required fields as row-level blockers. Required fields for June should stay minimal: reference, description/title, date added, and enough commercial fields to support list display.
- **D-07:** Do not include automatic PDF teaser parsing in the import. PDFs are attachments only in Phase 1.
- **D-08:** Keep an import summary: created rows, skipped rows, warning rows, and source filename/date.

### Staff Opportunity Screens

- **D-09:** Build staff screens using the existing dashboard style: dense, operational, searchable/scannable, and not a marketing-style page.
- **D-10:** Initial staff list should prioritize operational columns: reference, sector/activity, location, revenue, EBITDA, headcount, date/month added, status/availability, and source visibility indicator.
- **D-11:** Detail view should clearly separate staff-only information, repreneur-visible information, documents, and operational metadata.
- **D-12:** Archive/unavailable should be supported without deleting opportunity history.

### shadcn and Dashboard UI

- **D-13:** New dashboard sections and feature UI must use shadcn/ui components already installed in this project before custom markup.
- **D-14:** Use the shadcn MCP when choosing or adding components. If a component is not installed, search/check via shadcn MCP first, then add through the shadcn CLI only if the component is genuinely needed.
- **D-15:** For staff dashboards/lists, prefer existing shadcn primitives: `Card`, `Table`, `Badge`, `Tabs`, `Sheet`, `Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`, and `Chart` where relevant.
- **D-16:** Follow project shadcn config: Next.js App Router, RSC enabled, Tailwind v4, style `new-york`, Radix base, Lucide icons, imports from `@/components/ui`.
- **D-17:** Use semantic tokens and shadcn variants. Avoid raw color utility styling for statuses unless already established locally. Avoid custom card/table/empty/loading patterns when shadcn equivalents exist.

### Documents and File Visibility

- **D-18:** Phase 1 supports staff upload and storage of opportunity documents with metadata: title, file type/category, visibility, uploaded date, and linked opportunity.
- **D-19:** Visibility must be explicit: staff-only by default, repreneur-visible only when staff marks it so.
- **D-20:** Phase 1 does not need an inline PDF viewer. Download/display behavior for repreneurs belongs to Phase 2.

### the agent's Discretion

The agent may choose exact database naming, component decomposition, and migration order, as long as the data model supports the June V2 boundaries and does not pull V3 features into Phase 1.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Scope

- `.planning/PROJECT.md` — project definition, core value, active scope, and out-of-scope guardrails.
- `.planning/REQUIREMENTS.md` — June V2 requirements and traceability.
- `.planning/ROADMAP.md` — phase boundary and success criteria.
- `docs/V2-PDR-DRAFT.md` — original PDR structure and founder questions.
- `docs/communications/2026-05-16_whatsapp-bertrand-v2-scope-boundaries.md` — sent scope-boundary message to Bertrand.
- `docs/GSD_LINEAR_OPERATING_MODEL.md` — rule for keeping GSD and Linear aligned.

### Existing Code and UI Patterns

- `components/app-sidebar.tsx` — existing navigation pattern and where an Opportunities route will eventually be added.
- `app/(dashboard)/analytics/page.tsx` — dashboard page structure, Suspense, skeletons, card grids.
- `components/analytics/operational-kpis.tsx` — existing card-based operational KPI section; useful style reference but contains some raw status colors that should not be copied blindly.
- `components/ui/` — installed shadcn components. Confirm current set before importing.
- `components.json` — shadcn project config.
- `lib/actions/repreneurs.ts` — server action pattern with `createAdminClient`, `requireUser`, `revalidatePath`, and validation.
- `lib/types/repreneur.ts` — repreneur fields that Phase 2 matching will eventually map against.
- `lib/supabase/admin.ts` — server-only Supabase admin client pattern.
- `scripts/*.sql` and `supabase/migrations/*.sql` — current SQL migration style.

### shadcn References Checked

- shadcn MCP examples checked for `card-demo`, `table-demo`, `chart-demo`, and `tabs-demo`.
- Project shadcn info: Next.js 16, RSC true, TypeScript true, Tailwind v4, style `new-york`, Radix base, Lucide icons, import alias `@`, UI path `components/ui`.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `components/ui/card.tsx`, `table.tsx`, `badge.tsx`, `tabs.tsx`, `sheet.tsx`, `dialog.tsx`, `select.tsx`, `input.tsx`, `button.tsx`, `skeleton.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `chart.tsx` are already installed and should be used for new dashboard surfaces.
- `lib/actions/repreneurs.ts` shows the server-action style for authenticated staff mutations.
- `components/analytics/*` shows the current dashboard composition pattern.
- `lib/types/repreneur.ts` includes sector preferences, target location, acquisition size, journey milestones, and readiness data needed for later matching.

### Established Patterns

- Next.js App Router with server components by default; client components need `"use client"`.
- Server mutations generally use `createAdminClient()`, `requireUser()`, and then `revalidatePath()`.
- Existing app bypasses Supabase RLS through the service role on server-side actions.
- Existing dashboard pages use `Card`, `Skeleton`, grids, and componentized sections.
- Existing SQL migrations live in both `scripts/` and `supabase/migrations/`; planner should choose the repo's current operational convention before adding new migrations.

### Integration Points

- New opportunity data should connect to future `/opportunities` or dashboard routes and likely a sidebar entry, but route creation belongs to implementation planning.
- Phase 1 data model must support Phase 2 matching and repreneur-facing visibility without exposing staff-only source fields.
- Document storage should align with existing CV/LDC storage patterns where practical.

</code_context>

<specifics>

## Specific Ideas

- Use staff-reviewed Excel import, not silent import.
- Staff-only versus repreneur-visible field separation is a core product boundary.
- shadcn MCP usage is mandatory for new feature/dashboard UI decisions.
- June V2 should feel like an operational CRM surface: dense, readable, and fast to scan.

</specifics>

<deferred>

## Deferred Ideas

- Repreneur-facing opportunity detail, interest/reject, and document download: Phase 2.
- Matching and recommendation logic: Phase 2.
- Full M&A CRM: V3.
- Automatic teaser/PDF parsing: V3.
- Inline PDF viewer: V3 unless explicitly reopened.
- AI matching or sector interpretation: V3.

</deferred>

---

*Phase: 1-Scope Lock and Data Foundation*
*Context gathered: 2026-05-16*
