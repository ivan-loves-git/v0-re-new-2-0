# 007 — Make accordion expansion interruptible

- **Status**: DONE · MOTION DELETED
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Interruptibility · performance
- **Estimated scope**: 3 files, small

## Problem

components/ui/accordion.tsx:58 switches between animate-accordion-up/down keyframes. Rapid reversal restarts instead of retargeting. The trigger also uses transition-all at line 38.

## Target

Create a reusable grid expansion class in app/globals.css:

~~~css
.wave-expandable-motion {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows var(--duration-wave-standard) var(--ease-wave-in-out),
              opacity var(--duration-wave-fast) var(--ease-wave-out);
}
.wave-expandable-motion[data-state="open"] {
  grid-template-rows: 1fr;
  opacity: 1;
}
.wave-expandable-motion > * {
  min-height: 0;
  overflow: hidden;
}
@starting-style {
  .wave-expandable-motion[data-state="open"] {
    grid-template-rows: 0fr;
    opacity: 0;
  }
}
~~~

For reduced motion, snap grid-template-rows and retain only the fast opacity transition. The unavoidable grid layout work is a localized expansion exception; no height keyframes or transition-all remain.

## Repo conventions to follow

- Accordion uses Radix data-state and preserves content for exit transitions.
- The icon is a transform-only state cue and may use duration-wave-fast ease-wave-in-out with motion-reduce:transition-none.

## Steps

1. Add wave-expandable-motion and reduced-motion rules to app/globals.css.
2. Replace accordion content keyframe classes with wave-expandable-motion overflow-hidden text-sm.
3. Keep one direct child wrapper and add min-h-0 overflow-hidden if required by the grid interpolation.
4. Remove transition-all from AccordionTrigger; focus and hover feedback must remain immediate.
5. Tokenize the chevron transition.
6. Add contract assertions rejecting animate-accordion and transition-all.

## Boundaries

- Do not change accordion copy, type, default value, focus order, or disclosure semantics.
- Do not use max-height guesses or JS measurement.
- Do not animate an entire page/list.

## Verification

- **Mechanical**: focused test, lint, design check, build.
- **Feel check**: on Guide accordions, tap repeatedly before completion. The latest tap owns the state and content never flashes. Reduced motion snaps height while opacity remains legible.
- **Done when**: no accordion keyframe or transition-all remains.

## Reconciliation

Completed through deletion in 282e58e. Accordion content snaps open and closed: no keyframe, grid-track, height or layout transition remains. The chevron alone uses a 180ms transform transition and snaps under reduced motion.
