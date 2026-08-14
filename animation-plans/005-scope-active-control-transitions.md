# 005 — Scope active control transitions

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 11 files, medium

## Problem

Eighteen active form/shared-control declarations use transition-all. The affected declarations are:

- components/intake-v2/steps/step-who.tsx:110
- step-needs.tsx:146
- step-when.tsx:137,244
- step-project-status.tsx:85,128
- components/assessment/steps/step-bloc-a.tsx:51,66
- step-bloc-b.tsx:63
- step-bloc-c.tsx:64
- components/questionnaire/question-inputs.tsx:74,86,149,231,426
- components/ui/switch.tsx:16
- components/ui/progress.tsx:24
- components/ui/accordion.tsx:38, which plan 007 owns

transition-all allows unrelated layout or paint properties to animate.

## Target

- Selection-card wrappers use transition-[background-color,border-color,box-shadow,color] duration-wave-fast ease-wave-out.
- The two Button consumers at question-inputs.tsx:74,86 remove their local transition-all and inherit the shared Button motion.
- Switch root uses transition-[background-color,border-color,box-shadow] duration-wave-fast ease-wave-out. Switch thumb uses transition-transform duration-wave-fast ease-wave-in-out motion-reduce:transition-none.
- Progress indicator uses transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none.
- Plan 007 removes accordion trigger transition-all.

## Repo conventions to follow

- app/globals.css motion tokens from plan 001.
- Keep all existing selection colors, rings, native control state, and click handlers.

## Steps

1. Replace the exact intake, assessment, questionnaire, switch, and progress declarations with the target scopes.
2. Do not refactor current onClick/onCheckedChange ownership; this plan is motion-only.
3. Add contract assertions for every target file and for transition-transform on Progress.
4. After plans 003, 007, and 008 also land, run rg -n "transition-all" app components. Only separately excluded dormant/prototype code may remain; document any remaining path.

## Boundaries

- Do not change form validation, state, labels, values, or markup.
- Do not add positional hover movement.
- Do not touch components/scoring-v2/variants/card-variant-c.tsx without active-route evidence.

## Verification

- **Mechanical**: focused test, full pnpm test, lint, design check, build.
- **Feel check**: on intake and assessment, activate every card via container, label, radio/checkbox, and keyboard. Exactly one intended state change occurs; color/border feedback remains. Reduced motion keeps color feedback while progress/thumb movement snaps.
- **Done when**: all 18 approved active declarations are scoped and behavior is unchanged.

## Reconciliation

Implemented in 96cf07f and corrected in 282e58e. `transition-all` is removed from every approved target. High-frequency selection surfaces now change paint state immediately instead of animating paint; only Progress and the Switch thumb retain transform-only motion, each with a reduced-motion snap. Mobile intake selection and progress passed browser QA.
