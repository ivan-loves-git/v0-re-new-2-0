# W-100 — WAVE motion system execution

- **Work Card**: W-100 · Make WAVE motion fast, accessible, and consistent
- **Baseline**: 36dc8cd
- **Release branch**: codex/w100-wave-motion-system
- **Status**: VERIFIED · GATE 2 PENDING

| # | Plan | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Establish motion tokens and reduced-motion behavior | MEDIUM | DONE | — |
| 002 | Show radar and donut charts immediately | HIGH | DONE | — |
| 003 | Make the desktop sidebar immediate | HIGH | DONE | — |
| 004 | Make repeated tooltips instant | MEDIUM | DONE | — |
| 005 | Scope active control transitions | MEDIUM | DONE | 001 |
| 006 | Make trigger overlays interruptible | MEDIUM | RETIRED | 001 |
| 007 | Make accordion expansion interruptible | MEDIUM | DONE · MOTION DELETED | 001 |
| 008 | Use one short strategy transition | MEDIUM | DONE | 001, 002 |
| 009 | Add restrained button press feedback | MEDIUM | DONE | 001 |
| 010 | Connect decline action to its form | LOW | DONE · MOTION DELETED | 001, 007, 009 |
| 011 | Add one-shot success confirmation | LOW | DONE | 001 |

## Execution order

1. 001 establishes the shared duration/easing contract and fixes the global reduced-motion policy.
2. 002–004 remove high-frequency delay and page-load motion.
3. 005–007 replace broad/restart-prone motion with scoped transitions.
4. 008–011 apply the system to the approved strategy, press, decline, and success moments.
5. Add or extend lib/__tests__/wave-motion-system.test.ts as each plan lands.
6. Add the qualifying founder-facing roadmap entry described below.
7. Run the combined standard gate, changed-surface browser QA, and only then move W-100 to Review.

## Release integration

After all plans pass, add version 0.9.46 dated Aug 14, 2026 at the top of components/guide/development-roadmap.tsx:

- Title: WAVE now responds with one quiet motion system
- Fix: Operational information appears immediately — dashboard charts, keyboard navigation, and repeated labels no longer delay routine work.
- Style: State changes feel consistent — controls share one restrained timing and easing system while unnecessary property animation is removed.
- Fix: Motion remains accessible — reduced-motion users keep useful color and opacity feedback without movement.
- Style: Rare decisions receive restrained confirmation — button press, decline disclosure, and fresh submission success now explain what happened without decorative motion.

Set LAST_ROADMAP_UPDATE to 2026-08-14 and extend lib/__tests__/roadmap-authoritative-opportunities.test.ts for version 0.9.46 and the first three founder-facing claims.

## Non-negotiable boundaries

- Do not change product logic, data, permissions, role visibility, information architecture, or persistence.
- Do not add ordinary page, list, roadmap, table, or chart entrance animation.
- Do not modify vendored EvilCharts behavior when the WAVE facade can own the product choice.
- Do not publish, push production main, deploy, close W-100, or post Slack.

## Reconciliation at 737e598

- Plans 001–005 and 008–011 are implemented and verified. Plans 007 and 010 reached the approved outcome by deleting layout motion: accordion and decline content now snap while the accordion chevron and shared button retain transform-only feedback.
- Plan 006 is retired. Radix Presence requires CSS animations to retain exit content, so Popover, Select and Dropdown keep short 180ms trigger-origin keyframes for Safari-compatible entry and exit. Rapid reversal is a documented non-blocking limitation.
- Mechanical gate: 100 Vitest files / 604 tests, lint with pre-existing warnings only, design check, production build and diff check all pass.
- Browser gate: desktop sidebar click and keyboard toggle snap; charts are immediate; tooltips are animation-free; overlay timing compiles to 180ms; strategy uses one 220ms transform state change; mobile intake and decline surfaces have no horizontal overflow; reduced motion removes movement; decline autofocus and Cancel focus return pass with a clean console.
- Production publication and W-100 closure remain outside this execution gate.
