---
phase: 02
slug: core-deal-workflow
status: approved
shadcn_initialized: true
preset: new-york
created: 2026-05-17
approved: 2026-05-17
---

# Phase 02 - UI Design Contract

> Visual and interaction contract for the remaining Core Deal Workflow work: deal stage tracking, NDA status, and repreneur document access.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui |
| Preset | new-york |
| Component library | Radix via shadcn/ui |
| Icon library | lucide-react |
| Font | Inter for UI, Geist Mono only where code-like data is needed |

## Product Surface Contract

Phase 02 has two user-facing surfaces. They must stay visually related but not identical.

| Surface | Audience | Contract |
|---------|----------|----------|
| Staff dashboard | Re-New staff | Dense, scan-first operations UI inside the existing sidebar shell. Use tables, tabs, badges, alerts, compact forms, and clear one-step actions. |
| Repreneur portal | External repreneurs | Narrow, calm, disclosure-safe portal inside `PortalShell`. Use simpler page hierarchy, fewer actions, and no staff-only fields. |

Do not introduce a marketing-style page, hero section, decorative illustration, or new visual language for Phase 02. The phase extends the existing operational CRM.

## Information Architecture

### Staff Opportunity Detail

Keep `/opportunities/[id]` as the center of staff workflow. The current tab pattern is locked.

| Tab | Purpose | Phase 02 Additions |
|-----|---------|--------------------|
| Overview | Staff and repreneur-visible opportunity summary | Show a compact active-pursuit summary if one exists. |
| Recommendations | Matching, validation, active-pursuit lock | Preserve existing validate, drop, and reopen actions. Do not duplicate stage controls here unless shown as read-only status. |
| Deal Progress | Active pursuit stage tracking | Add a new tab only when stage tracking is implemented. It should focus on the single active pursuit, current stage, next action, and history. |
| Documents | Staff document upload and visibility | Extend existing document controls with NDA and repreneur download readiness. |
| Edit | Opportunity fields | No new stage or NDA operational controls here. |

### Staff Review Queue

Keep `/opportunities/reviews` as the triage queue for repreneur responses. It may show active locks and validation actions, but it should not become the full deal-management screen. Once a pursuit is validated, staff should land on the opportunity detail page for stage and document work.

### Repreneur Portal

Keep `/portal/deals` and `/portal/deals/[matchId]` as the external deal surface. Repreneurs should see only:

- anonymized opportunity identity and metrics already approved for repreneurs
- their current response or active pursuit state
- downloadable documents explicitly approved for repreneur access
- NDA requirement/status when relevant
- one clear next step, not an internal stage workflow

Never show source firm, contact, staff notes, raw staff description, other repreneurs, lock conflicts, internal recommendation notes, or review queue state.

## Spacing Scale

Declared values use Tailwind spacing and must remain multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge clusters, table action groups |
| sm | 8px | Form label gaps, compact button groups, metadata rows |
| md | 16px | Card content gaps, grid gaps on compact sections |
| lg | 24px | Page section gaps, tab panels, primary card stacks |
| xl | 32px | Major staff page separation |
| 2xl | 48px | Rare empty-state or full-page separation |
| 3xl | 64px | Avoid inside Phase 02 operational screens |

Exceptions: existing sidebar internals and shadcn component defaults may keep their current spacing. New Phase 02 controls should use `gap-2`, `gap-4`, `gap-6`, `space-y-4`, or `space-y-6`.

## Layout Rules

| Context | Rule |
|---------|------|
| Staff pages | Use `space-y-6` for page rhythm and constrained card stacks. |
| Staff detail tabs | Use shadcn `Tabs`; tab names must be short nouns. |
| Staff tables | Wrap tables in `overflow-hidden rounded-md border`; keep row actions right aligned. |
| Staff forms | Use grid layouts with responsive collapse. Labels sit above fields. |
| Portal pages | Use `max-w-6xl` shell, `gap-6`, and simpler one-column-first mobile layout. |
| Cards | Use cards for discrete records or panels only. Do not put cards inside cards. |
| Action groups | Use icon plus text for business actions; use icon-only only for familiar utility actions with accessible labels. |

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px-14px | 500 | 1.4 |
| Table/meta text | 12px | 400-500 | 1.4 |
| Card title | 16px-18px | 600 | 1.3 |
| Page heading | 24px | 600 | 1.25 |
| Display | Not used | Not used | Not used |

Letter spacing must stay normal. Do not use viewport-scaled text. Long opportunity titles, stage labels, and document names must wrap instead of overflowing.

## Color

Use the existing theme tokens from `app/globals.css`. Do not add a new palette for Phase 02.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#ffffff` / `bg-background` | Page background and primary surfaces |
| Secondary (30%) | `#f9fafb`, `#f3f4f6`, `#e5e7eb` / muted, secondary, border | Tables, inactive states, subtle sections |
| Accent (10%) | `#3b82f6` / primary | Primary action, active navigation, approved/actionable badges |
| Success | `#16a34a` / success | Completed stage, document approved, NDA complete |
| Warning | `#d97706` / warning | NDA required, missing document, stale next step |
| Destructive | `#ef4444` / destructive | Drop pursuit, remove document, reject/destructive confirmations |
| Sidebar | `#111827` | Existing staff sidebar only |

Accent reserved for: primary staff action, active tab/nav affordance, approved-for-repreneur document state, strong fit/active state when no semantic token is more precise.

Do not rely on color alone. Every status needs a readable text label.

## Components And Patterns

Use existing shadcn components before adding anything new.

| Need | Component Contract |
|------|--------------------|
| Stage selector | `Select` for current stage with explicit save action, or a compact button menu if the stage transition requires confirmation. |
| Stage history | `Table` for staff; compact vertical list only if there are fewer than five entries. |
| Current pursuit summary | `Alert` or compact `Card` with repreneur name, current stage, latest update, and next action. |
| NDA status | `Badge` plus short helper text. Use `Alert` only when blocking document access. |
| Document visibility | Existing `Badge` and `DropdownMenu`; make visibility labels explicit: `Staff only`, `Approved for repreneur`. |
| Repreneur downloads | `Button` or list row with `FileText`/`Download` icon, title, type, and availability state. |
| Destructive actions | `AlertDialog` for dropping pursuit, removing documents, or revoking approved access. |
| Empty states | `Alert` for operational queues; table row empty state for empty tables. |
| Loading | Existing skeleton/spinner patterns; do not create bespoke animated loaders. |

## Stage Tracking Contract

The required business stages are:

1. Interest
2. Intermediary meeting
3. Seller meeting
4. LOI
5. Dropped
6. Closed

Staff-facing stage UI must:

- show current stage above history
- show who changed it and when if the data exists
- require a clear save/confirm action for stage changes
- treat `Dropped` and `Closed` as terminal-looking states
- explain business impact for `Dropped`: it may release the active-pursuit lock if the implementation supports reopening
- avoid pipeline/kanban visuals for Phase 02, because there is only one active pursuit per opportunity

Repreneur-facing stage UI must:

- avoid internal workflow labels unless they are useful externally
- use plain status copy such as `Re-New is reviewing next steps`, `Meeting in progress`, `LOI stage`, `Closed`, or `No longer active`
- never show internal staff history notes

## NDA And Document Access Contract

Staff-facing NDA/document UI must make access safety obvious.

| State | Staff Copy | Repreneur Copy |
|-------|------------|----------------|
| No NDA required | `No NDA required` | No NDA message unless documents are available. |
| NDA required, missing | `NDA required before document access` | `Documents will be available after Re-New completes the NDA step.` |
| NDA pending | `NDA pending` | `NDA step in progress.` |
| NDA complete | `NDA complete` | `Documents approved by Re-New are available below.` |

Document download rules:

- Staff can upload/register documents in the existing Documents tab.
- Staff must explicitly mark a document `Approved for repreneur` before it appears in the portal.
- NDA-gated files must not appear as downloadable until NDA status allows access.
- Repreneur document rows must show title, type, and a single download/open action.
- Staff-only documents must never leak through disabled portal rows; omit them completely from portal data.

## Copywriting Contract

Copy should sound operational, calm, and specific. Avoid cleverness.

| Element | Copy |
|---------|------|
| Primary stage CTA | `Save stage` |
| Validate CTA | `Validate pursuit` |
| Drop CTA | `Drop pursuit` |
| Reopen CTA | `Reopen for review` |
| Staff empty stage heading | `No active pursuit yet` |
| Staff empty stage body | `Validate an interested repreneur before tracking deal stages.` |
| Staff empty documents heading | `No documents attached` |
| Staff empty documents body | `Add a document, then approve it only when it is safe for repreneur access.` |
| Portal empty deals heading | `No deals available` |
| Portal empty deals body | `Re-New will add opportunities here when there is a relevant match.` |
| Portal blocked document state | `Documents will be available after Re-New completes the NDA step.` |
| Stage save success | `Stage updated` |
| Error state | `We could not save this change. Refresh the page and try again.` |
| Destructive confirmation | `Drop pursuit: this will stop the active pursuit and may reopen the opportunity for another repreneur.` |

## Accessibility And Responsiveness

- Every icon-only button must have `aria-label`.
- Form controls need visible `Label` text.
- Tables must remain horizontally usable on small screens; if necessary, preserve table overflow rather than squeezing columns into unreadable text.
- Portal action buttons stack on mobile and sit inline from `sm` upward.
- Badges must include explicit text labels.
- Confirmation dialogs must describe the consequence in business language.
- Do not hide critical status only in hover tooltips.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Card, Table, Badge, Tabs, Alert, Dialog/AlertDialog, Select, Input, Button, DropdownMenu, Skeleton, Tooltip if needed | not required |
| third-party | none approved for Phase 02 | shadcn view + diff required before use |

No third-party registry blocks are approved for this phase.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-17

## Verification Notes

- Checked against Phase 02 context, current roadmap requirements, and existing opportunity/portal components.
- No unresolved UI blockers.
- Non-blocking note: Phase 02 has no `02-RESEARCH.md`; this UI-SPEC therefore locks UI behavior from existing implementation patterns and product context rather than from a separate technical research artifact.
