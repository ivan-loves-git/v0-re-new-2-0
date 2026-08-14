# 011 — Add one-shot success confirmation

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: LOW
- **Category**: Missed opportunity · rare delight
- **Estimated scope**: 4 files, small

## Problem

Fresh successful submission routes end on static checkmarks at app/intake-v2/success/page.tsx:53-56 and app/assessment/[token]/success/page.tsx:35-38. These rare confirmation moments have no feedback budget, while the recurring already-completed assessment state must remain static.

## Target

Add one shared CSS class to the two fresh success icon containers only:

~~~css
@keyframes wave-success-confirm {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.wave-success-confirm {
  animation: wave-success-confirm var(--duration-wave-fast) var(--ease-wave-out) both;
}
@media (prefers-reduced-motion: reduce) {
  .wave-success-confirm { animation: none !important; }
}
~~~

Use the fast token (180ms). No delay, loop, bounce, rotation, confetti, or surrounding page entrance.

## Repo conventions to follow

- Motion is allowed for rare success feedback and must remain quiet.
- app/assessment/[token]/assessment-page-client.tsx already-completed icon is not a fresh submission and stays static.

## Steps

1. Add the exact keyframe, class, and reduced-motion override to app/globals.css.
2. Add wave-success-confirm to the round icon wrapper in the intake success page.
3. Add it to the equivalent assessment success page.
4. Add contract assertions that both fresh routes use it, the recurring completed state does not, and reduced motion disables it.

## Boundaries

- Do not animate headings, next steps, CTA, language toggle, or full page.
- Do not change copy, routes, redirects, or links.
- Do not add sound, confetti, bounce, or dependency.

## Verification

- **Mechanical**: focused test, lint, design check, build.
- **Feel check**: enter each success route from its real submit flow. The checkmark confirms once in 180ms and never loops. Refresh replays once; reduced motion is completely static.
- **Done when**: only the two fresh success moments receive the restrained confirmation.

## Reconciliation

Implemented in 96cf07f. Both fresh success routes use one 180ms opacity/scale confirmation; the recurring completed state remains static. Browser QA confirmed the normal keyframe and a fully static reduced-motion result.
