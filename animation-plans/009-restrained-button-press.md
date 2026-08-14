# 009 — Add restrained button press feedback

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Physicality
- **Estimated scope**: 2 files, small

## Problem

The shared Button at components/ui/button.tsx:7-21 transitions surface properties only. High-frequency press targets provide no physical confirmation.

## Target

Extend the scoped transition to include transform, add duration-wave-press ease-wave-out, and add active:scale-[.97]. Under reduced motion use motion-reduce:active:scale-100. Keep disabled:pointer-events-none, so disabled controls cannot compress.

Target base fragment:

~~~text
transition-[background-color,border-color,color,box-shadow,transform]
duration-wave-press ease-wave-out
active:scale-[.97] motion-reduce:active:scale-100
~~~

## Repo conventions to follow

- Scale .97 and 160ms are the audit's exact restrained press targets.
- Button is the shared primitive for both native buttons and asChild controls.

## Steps

1. Update only the Button base class.
2. Preserve every variant, size, focus ring, disabled state, and SVG rule.
3. Add a contract assertion for scoped transform, .97, the press token, and reduced-motion suppression.

## Boundaries

- Do not add hover scale, bounce, spring, shadow growth, or sound/haptics.
- Do not modify one-off button consumers unless plan 005 removes an overriding transition-all.

## Verification

- **Mechanical**: focused test, lint, design check, build.
- **Feel check**: press and hold mouse/touch/keyboard-activated controls. Pointer press compresses subtly and releases immediately; focus remains stable; reduced motion has no scale.
- **Done when**: shared enabled buttons provide .97 press confirmation without playful motion.

## Reconciliation

Implemented in 96cf07f and tightened in 282e58e. The shared Button transitions transform only, uses the browser-verified 160ms press token and `.97` active scale, and suppresses scale for reduced-motion and disabled states.
