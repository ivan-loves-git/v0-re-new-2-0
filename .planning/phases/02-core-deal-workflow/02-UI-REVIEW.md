# Phase 02 - UI Review

**Audited:** 2026-05-17
**Baseline:** Abstract 6-pillar standards; no Phase 02 UI-SPEC.md found
**Screenshots:** Not captured for audited authenticated routes. Local `:3000` served a stale 404 for `/portal/deals`; local `:3001` and production both reached login but `/api/auth/sign-in/email` returned 500, so protected Phase 02 surfaces could not be visually captured.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Most labels are task-specific, but some portal/support text is generic and uses internal terms. |
| 2. Visuals | 3/4 | Clear hierarchy and shadcn consistency, with dense staff tables carrying too much visual weight. |
| 3. Color | 3/4 | Uses the existing token system well; accent use is restrained in Phase 02 surfaces. |
| 4. Typography | 3/4 | Type scale is consistent, but dense rows rely heavily on small text and badges. |
| 5. Spacing | 2/4 | Staff tables and fixed multi-column blocks are likely to fail or feel cramped on mobile. |
| 6. Experience Design | 2/4 | Key states exist, but some staff actions lack pending feedback and protected route browser verification was blocked. |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Make staff review and recommendation tables responsive** - Staff review is a core June workflow, and clipped or horizontally overflowing rows would make mobile/tablet review unreliable. Use `overflow-x-auto` with explicit `min-w-*` tables, or switch to stacked row cards below `md`.
2. **Add pending states to staff review server actions** - `Validate pursuit` and `Mark reviewed` can be clicked without visible progress. Wrap row actions in client components with `useFormStatus`, disable while pending, and change labels to `Validating...` / `Marking...`.
3. **Reduce density in repreneur-facing opportunity cards** - The deal list is understandable, but three metrics stay in one row at every viewport. Switch to `grid-cols-1 sm:grid-cols-3` or a compact definition-list pattern so financial figures do not crowd on narrow screens.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING:** The main flow labels are concrete and action-led: `I'm interested`, `Not a fit`, `Validate pursuit`, `Mark reviewed`, and `Drop pursuit` map cleanly to the workflow. Evidence: `components/opportunities/repreneur-opportunity-detail.tsx`, `components/opportunities/opportunity-response-review-table.tsx`, and `components/opportunities/opportunity-matches-panel.tsx`.

**WARNING:** Some repreneur-facing copy still exposes internal product language. `components/portal/repreneur-profile-summary.tsx:150` says `Your Re-New profile`, then the page uses `WHO score`, `WHEN score`, and `Target thesis` at lines 180, 193, and 248. This is useful to Re-New staff but may need friendlier explanation for external repreneurs.

**WARNING:** Empty states are present and specific enough for the first release: `No linked repreneur profile`, `No opportunities available`, and `No responses to review` appear in `components/opportunities/repreneur-opportunity-list.tsx:33`, `components/opportunities/repreneur-opportunity-list.tsx:43`, and `components/opportunities/opportunity-response-review-table.tsx:52`.

### Pillar 2: Visuals (3/4)

**WARNING:** The portal uses a clear visual hierarchy: shell nav, page heading, cards, badges, metric blocks, and detail cards. `components/portal/portal-shell.tsx:27` through `components/portal/portal-shell.tsx:60` creates a restrained external portal rather than reusing the staff sidebar.

**WARNING:** Staff surfaces are visually dense. `components/opportunities/opportunity-response-review-table.tsx:71` through `components/opportunities/opportunity-response-review-table.tsx:77` defines seven table columns, while `components/opportunities/opportunity-matches-panel.tsx:237` through `components/opportunities/opportunity-matches-panel.tsx:243` defines another seven-column table. This is operationally useful but needs stronger responsive behavior.

**WARNING:** Icon-only destructive remove has an aria label at `components/opportunities/opportunity-matches-panel.tsx:343`, which is good. The rest of the main actions include text labels and icons, so affordance is generally strong.

### Pillar 3: Color (3/4)

**WARNING:** Phase 02 surfaces mostly use semantic shadcn variants and tokens (`Badge`, `Alert`, `Button`, `Card`) rather than hardcoded color classes. This keeps the staff and portal UI aligned with the existing product.

**WARNING:** Accent usage in the audited Phase 02 files is restrained. Direct `text-primary` use appears in the portal profile for positive signals at `components/portal/repreneur-profile-summary.tsx:235` and `components/portal/repreneur-profile-summary.tsx:299`; most state color comes through component variants.

**WARNING:** The wider app still has many hardcoded chart/email colors, but those are outside this phase's UI scope. No third-party registry color block was identified because there is no UI-SPEC registry section for Phase 02.

### Pillar 4: Typography (3/4)

**WARNING:** The audited files mostly use a tight scale: `text-xs`, `text-sm`, `text-2xl`, and `text-3xl`. Page titles use `text-2xl font-semibold`, while metric scores use `text-3xl`, which creates a clear hierarchy.

**WARNING:** Table content relies heavily on `text-xs` secondary text and badges. This keeps rows compact, but it can make review decisions harder when staff are scanning opportunity, repreneur, recommendation, score, and lock state in one row.

**WARNING:** No negative letter spacing or viewport-scaled type was found in the Phase 02 components reviewed.

### Pillar 5: Spacing (2/4)

**WARNING:** The staff review table is wrapped in `overflow-hidden rounded-md border` at `components/opportunities/opportunity-response-review-table.tsx:67`, and the recommendations table uses the same pattern at `components/opportunities/opportunity-matches-panel.tsx:233`. With seven columns, this risks clipping or causing awkward page overflow on small screens.

**WARNING:** The repreneur deal cards keep three metric columns at all sizes in `components/opportunities/repreneur-opportunity-list.tsx:70`. On narrow screens, `Revenue`, `EBITDA`, and `Team` may crowd or wrap unevenly.

**WARNING:** Spacing scale is otherwise consistent (`gap-2`, `gap-3`, `gap-4`, `gap-6`, `p-3`, `p-6`), with only a few fixed grid templates such as `lg:grid-cols-[1fr_320px]` and `lg:grid-cols-[1fr_360px]` used at large breakpoints.

### Pillar 6: Experience Design (2/4)

**WARNING:** Core states are represented: no linked profile, no opportunities, interested/declined/active pursuit alerts, empty review queue, active lock, open validation, destructive drop confirmation, and disabled repeat response buttons.

**WARNING:** `Validate pursuit` and `Mark reviewed` in the staff review queue are plain server-action forms at `components/opportunities/opportunity-response-review-table.tsx:136` through `components/opportunities/opportunity-response-review-table.tsx:153`. They do not expose pending state or disable after click, unlike the recommendations panel, which tracks `pendingActionId` at `components/opportunities/opportunity-matches-panel.tsx:77` through `components/opportunities/opportunity-matches-panel.tsx:104`.

**WARNING:** Authenticated browser verification could not reach the Phase 02 UI. Local app on port 3001 started, but sign-in returned 500 with `ECONNREFUSED`; production sign-in also returned 500 for `/api/auth/sign-in/email`. This leaves residual risk around actual rendered layout, especially for the responsive table findings.

---

## Registry Safety

Registry audit skipped. `components.json` exists, but no Phase 02 UI-SPEC.md or third-party registry table exists for this phase.

---

## Files Audited

- `.planning/phases/02-core-deal-workflow/02-CONTEXT.md`
- `.planning/phases/02-core-deal-workflow/02-02-PLAN.md`
- `.planning/phases/02-core-deal-workflow/02-03-PLAN.md`
- `.planning/phases/02-core-deal-workflow/02-04-PLAN.md`
- `.planning/phases/02-core-deal-workflow/02-05-PLAN.md`
- `.planning/phases/02-core-deal-workflow/02-01-SUMMARY.md`
- `.planning/phases/02-core-deal-workflow/02-02-SUMMARY.md`
- `.planning/phases/02-core-deal-workflow/02-03-SUMMARY.md`
- `.planning/phases/02-core-deal-workflow/02-04-SUMMARY.md`
- `.planning/phases/02-core-deal-workflow/02-05-SUMMARY.md`
- `app/portal/layout.tsx`
- `app/portal/deals/page.tsx`
- `app/portal/deals/[matchId]/page.tsx`
- `app/portal/profile/page.tsx`
- `app/(dashboard)/opportunities/reviews/page.tsx`
- `components/portal/portal-shell.tsx`
- `components/portal/repreneur-profile-summary.tsx`
- `components/opportunities/repreneur-opportunity-list.tsx`
- `components/opportunities/repreneur-opportunity-detail.tsx`
- `components/opportunities/opportunity-response-review-table.tsx`
- `components/opportunities/opportunity-matches-panel.tsx`
