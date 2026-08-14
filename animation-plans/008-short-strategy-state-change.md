# 008 — Use one short strategy state change

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: MEDIUM
- **Category**: Duration · performance · accessibility
- **Estimated scope**: 5 files, medium

## Problem

components/strategy/strategy-explorer.tsx:19-45 runs a 400ms requestAnimationFrame loop that calls setScores every frame. components/strategy/revenue-journey.tsx:72-105 separately animates five width values for 500ms through transition-all. Persona selection therefore drives competing main-thread/layout work.

## Target

- Persona scores update atomically: setScores([...PERSONAS[index].scores]); remove animRef, requestAnimationFrame, cancellation, duration, and custom easing.
- Revenue segments remain one stacked bar but use stable absolute transform layers:
  - full-width outer layer translated from 0% to each segment's cumulative start percentage;
  - full-width inner layer scaled on X to value/displayMax;
  - transform-origin:left;
  - transition-transform duration-wave-standard ease-wave-out motion-reduce:transition-none;
  - all five segment keys stay mounted, and zero values are hidden.
- No width, flex-basis, left, or transition-all property animates.
- Persona and journey cards use explicit color/border/shadow/opacity transitions. Remove journey hover:-translate-y-0.5.

## Repo conventions to follow

- Plan 002 makes the WaveRadarChart itself immediate.
- The report-approved duration is one short 220ms transform state change.
- Existing revenue calculations, labels, titles, colors, legend, and projected commission rules are authoritative.

## Steps

1. Simplify StrategyExplorer imports and handlePersonaChange to atomic state.
2. In RevenueJourney, build a stable five-entry segment list and derive startPercent and scale from existing displayMax. Render them inside a relative overflow-hidden bar using nested transform-only layers.
3. Keep textual total/projected values and legend immediate and unchanged.
4. Scope PersonaSelector to background-color,border-color,box-shadow at duration-wave-fast ease-wave-out.
5. Scope JourneyMap to background-color,border-color,box-shadow,opacity at duration-wave-fast ease-wave-out and delete hover lift.
6. Add contract tests rejecting requestAnimationFrame, duration-500, transition-all, and animated width in strategy sources while requiring transition-transform and motion-reduce.

## Boundaries

- Do not redesign the strategy page or change persona/scoring/revenue data.
- Do not repair PersonaSelector semantics in this card.
- Do not introduce Motion/Framer, canvas, SVG rewrites, or a dependency.

## Verification

- **Mechanical**: focused test, full test, lint, design check, build.
- **Feel check**: rapidly switch all personas. Scores and radar settle immediately; only the revenue composition moves for 220ms, with no gaps or overlap. Reduced motion makes the bar immediate.
- **Done when**: no per-frame React score updates, no width animation, and only one short composited strategy transition remains.

## Reconciliation

Implemented in 96cf07f and tightened in 282e58e. Persona scores and the radar update atomically; the revenue stack alone uses stable transform layers at a browser-verified 220ms. Persona and journey-card paint changes are immediate, with no hover movement or requestAnimationFrame loop.
