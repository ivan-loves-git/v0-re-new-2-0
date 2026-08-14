# 004 — Make repeated tooltips instant

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Purpose · frequency
- **Estimated scope**: 2 files, small

## Problem

components/ui/tooltip.tsx:49 applies animate-in/out, fade, scale(.95), and directional slide keyframes. The collapsed sidebar sets delayDuration=0 and creates this tooltip for every navigation item at components/ui/sidebar.tsx:131 and 532-540, so every repeated label still replays motion.

## Target

TooltipContent retains its surface, arrow, Radix origin, placement, and accessibility behavior but has no animate/fade/zoom/slide/duration/easing utilities. It appears instantly at the computed trigger position.

## Repo conventions to follow

- The provider already defaults to zero delay at components/ui/tooltip.tsx:8-17.
- Frequent navigation labels are operational feedback, not an entrance moment.

## Steps

1. Remove all motion utilities from TooltipContent at components/ui/tooltip.tsx:49.
2. Preserve z-index, width, origin variable, colors, radius, padding, typography, arrow, and sideOffset.
3. Add a contract assertion that tooltip source has no animate-in, animate-out, zoom, slide-in, or fade-in/out class.

## Boundaries

- Do not change provider nesting or delay architecture.
- Do not change tooltip copy, visibility rules, or placement.
- Do not add a substitute opacity transition.

## Verification

- **Mechanical**: focused test, lint, build.
- **Feel check**: traverse collapsed sidebar items quickly with pointer and keyboard. Each label appears immediately without replaying motion and remains anchored correctly.
- **Done when**: the shared tooltip has no authored entrance or exit motion.

## Reconciliation

Implemented in 96cf07f. A collapsed-sidebar tooltip computed `animation-name: none`, `animation-duration: 0s`, full opacity and no transform in browser QA.
