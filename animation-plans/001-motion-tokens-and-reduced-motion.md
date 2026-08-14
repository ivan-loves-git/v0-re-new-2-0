# 001 — Establish motion tokens and reduced-motion behavior

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Accessibility · cohesion
- **Estimated scope**: 5 files, small

## Problem

app/globals.css:6-54 defines product tokens but no motion scale. Shared primitives therefore hard-code unrelated values: dialog uses duration-200 at components/ui/dialog.tsx:63; sheet uses bare ease-in-out plus 300/500ms at components/ui/sheet.tsx:61. The global reduced-motion rule at app/globals.css:276-284 forces every transition to 0.01ms, deleting useful color and opacity feedback as well as movement.

Current:

~~~css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
~~~

## Target

Add these exact Tailwind v4 theme variables inside app/globals.css @theme inline:

~~~css
--ease-wave-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-wave-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-wave-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--duration-wave-instant: 0ms;
--duration-wave-press: 160ms;
--duration-wave-fast: 180ms;
--duration-wave-standard: 220ms;
--duration-wave-drawer: 280ms;
~~~

Keep smooth scrolling and keyframe movement suppressed under reduced motion, but delete the blanket transition-duration override. Every movement transition introduced by W-100 must then use an explicit motion-reduce variant, while color/opacity feedback remains perceptible.

## Repo conventions to follow

- Product tokens already live in app/globals.css:105-168.
- docs/WAVE-PRODUCT-UI.md:20 states that motion explains state and charts default to no entrance animation.
- app/layout.tsx imports app/globals.css. Do not edit the inactive duplicate styles/globals.css.

## Steps

1. Add the exact variables above to app/globals.css @theme inline.
2. Remove only transition-duration: 0.01ms from the reduced-motion block. Keep scroll-behavior, animation-duration, and animation-iteration-count.
3. In components/ui/dialog.tsx, replace hard-coded duration-200 with duration-wave-standard ease-wave-out. Keep the centered modal origin and scale(.95) behavior.
4. In components/ui/sheet.tsx, replace bare ease-in-out and 300/500ms values with ease-wave-drawer, close duration-wave-standard, and open duration-wave-drawer. Keep the existing directional sheet behavior.
5. Add a Motion subsection to docs/WAVE-PRODUCT-UI.md documenting instant/press/fast/standard/drawer tokens, strong curves, transform/opacity preference, instant operational content, and explicit reduced-motion variants for movement.
6. Add source-contract coverage in lib/__tests__/wave-motion-system.test.ts for the exact variables and absence of the global transition-duration override.

## Boundaries

- Do not alter color, spacing, radius, or shadow tokens.
- Do not remove the global keyframe-duration safeguard in this plan.
- Do not change dialog/sheet markup or product behavior.
- Do not add dependencies.

## Verification

- **Mechanical**: pnpm test -- lib/__tests__/wave-motion-system.test.ts; pnpm lint; pnpm design:check; pnpm build; git diff --check.
- **Feel check**: open a dialog and each sheet direction; default motion is crisp, centered dialogs stay centered, and drawers complete within 280ms. Emulate reduced motion: movement is removed while focus/color feedback remains.
- **Done when**: shared tokens compile into utilities, the docs define one motion contract, and reduced motion no longer globally deletes all transitions.

## Reconciliation

Implemented in 96cf07f and corrected in 7d6fefa. The canonical `--duration-wave-*` variables remain available to CSS, with matching Tailwind v4 `--transition-duration-wave-*` aliases so `duration-wave-*` utilities compile to 160/180/220/280ms. Browser-computed timings and reduced-motion behavior passed at 737e598.
