# 006 — Make trigger overlays interruptible

- **Status**: RETIRED · RADIX/SAFARI LIFECYCLE TRADEOFF
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 5 files, medium

## Problem

Popover, Select, DropdownMenu, and DropdownMenuSubContent use tw-animate-css keyframes at components/ui/popover.tsx:33, select.tsx:64, and dropdown-menu.tsx:45,233. Rapid close/reopen starts a fresh keyframe rather than retargeting from the current state.

## Target

Add one shared class in app/globals.css:

~~~css
.wave-trigger-overlay {
  --wave-overlay-x: 0;
  --wave-overlay-y: 0;
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
  transition: opacity var(--duration-wave-fast) var(--ease-wave-out),
              transform var(--duration-wave-fast) var(--ease-wave-out);
}
.wave-trigger-overlay[data-side="bottom"] { --wave-overlay-y: -0.5rem; }
.wave-trigger-overlay[data-side="top"] { --wave-overlay-y: 0.5rem; }
.wave-trigger-overlay[data-side="right"] { --wave-overlay-x: -0.5rem; }
.wave-trigger-overlay[data-side="left"] { --wave-overlay-x: 0.5rem; }
.wave-trigger-overlay[data-state="closed"] {
  opacity: 0;
  transform: translate3d(var(--wave-overlay-x), var(--wave-overlay-y), 0) scale(0.95);
}
@starting-style {
  .wave-trigger-overlay[data-state="open"] {
    opacity: 0;
    transform: translate3d(var(--wave-overlay-x), var(--wave-overlay-y), 0) scale(0.95);
  }
}
~~~

Under reduced motion, set transform:none for open, closed, and starting states and retain only the 180ms opacity transition.

## Repo conventions to follow

- Keep each existing Radix transform-origin utility; popovers must originate at the trigger.
- Tailwind 4 in this repository supports @starting-style.
- Tooltip is intentionally instant under plan 004 and must not use this class.

## Steps

1. Add the shared class, side variables, @starting-style rule, and reduced-motion override to app/globals.css.
2. In PopoverContent, SelectContent, DropdownMenuContent, and DropdownMenuSubContent, remove animate/fade/zoom/slide keyframe utilities and add wave-trigger-overlay.
3. Preserve Select's popper offset utilities, portal behavior, collision handling, z-index, dimensions, scrolling, and origins.
4. Add source-contract assertions for the shared class and absence of keyframe utility strings in the four primitives.

## Boundaries

- Do not include Dialog, Sheet, Tooltip, or Toast.
- Do not change Radix open state, focus management, portal behavior, or positioning.
- Do not add dependencies or JS timers.

## Verification

- **Mechanical**: focused test, lint, design check, build.
- **Feel check**: rapidly open/close/reopen each overlay with pointer and keyboard; it reverses from its current position. Inspect at 10% playback. Reduced motion retains a short fade with no translate/scale.
- **Done when**: all four shared trigger overlays use CSS transitions and no restart-prone entrance keyframes.

## Reconciliation

Retired after implementation review. Radix Presence 1.1.5 retains exit content only for CSS animations, not transitions, and `@starting-style` is not a safe fallback for the full iPhone Safari target. Popover, Select, DropdownMenu and SubContent therefore keep Radix-compatible trigger-origin keyframes, now using the shared strong easing and verified 180ms duration. Entry/exit and clean unmount take priority; rapid mid-flight reversal remains a documented non-blocking limitation.
