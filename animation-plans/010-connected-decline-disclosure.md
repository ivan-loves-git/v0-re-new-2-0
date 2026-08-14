# 010 — Connect decline action to its form

- **Status**: DONE · MOTION DELETED
- **Commit**: 36dc8cd
- **Severity**: LOW
- **Category**: Missed opportunity · spatial continuity
- **Estimated scope**: 3 files, medium

## Problem

components/opportunities/repreneur-opportunity-decline-action.tsx:57-125 replaces the Not a fit button with a substantial form in one frame, then replaces it back on Cancel. The relationship between trigger and panel is not explained, and focus has no return target.

## Target

Use the existing shared Collapsible primitive:

- controlled by the existing isExpanded state;
- CollapsibleTrigger asChild wraps the existing outline Button and keeps it present;
- CollapsibleContent wraps the existing form below the trigger and uses wave-expandable-motion from plan 007;
- Radix supplies aria-expanded and aria-controls;
- opening retains the existing first-checkbox focus;
- Cancel closes and restores focus to a trigger ref;
- pending disables both cancellation and accidental trigger closing;
- reduced motion snaps the expansion and preserves the opacity cue.

## Repo conventions to follow

- components/ui/collapsible.tsx is already installed and exported.
- The existing mutation, field names, validation, error Alert, action, and submit behavior must remain byte-for-byte equivalent where possible.
- components/opportunities/repreneur-opportunity-detail.tsx keeps I'm interested before this secondary action.

## Steps

1. Import Collapsible, CollapsibleTrigger, and CollapsibleContent.
2. Add a typed trigger ref and a close helper that sets isExpanded false and restores focus after the state update.
3. Replace the early return with one controlled Collapsible containing the persistent trigger and animated content.
4. Keep the form as the direct child of CollapsibleContent so wave-expandable-motion can clip/expand it.
5. Extend lib/__tests__/repreneur-opportunity-decline-action.test.ts for Collapsible use, focus return, and preserved validation strings.

## Boundaries

- Do not change decline reasons, required rationale, server action, redirect, or primary interested action.
- Do not use a keyframe, height guess, timeout, or new dependency.
- Do not auto-submit or persist on expand/cancel.

## Verification

- **Mechanical**: pnpm test -- lib/__tests__/repreneur-opportunity-decline-action.test.ts lib/__tests__/repreneur-opportunity-decline-response.test.ts; lint; design check; build.
- **Feel check**: open/cancel rapidly with mouse and keyboard. The panel grows from below the trigger, reverses cleanly, first checkbox receives focus on open, trigger regains focus on Cancel, and pending cannot close. Reduced motion snaps height.
- **Done when**: the action/form relationship is spatially clear with unchanged business behavior.

## Reconciliation

Completed through motion deletion and a stable native disclosure in 737e598. The trigger remains present with deterministic `aria-expanded` and `aria-controls`; the panel renders immediately beneath it with no layout animation. The first checkbox receives focus on open and Cancel restores focus to the trigger. Browser QA at 390px found no overflow, no submission side effect and a clean console.
