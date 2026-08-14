# 002 — Show radar and donut charts immediately

- **Status**: DONE
- **Commit**: 36dc8cd
- **Severity**: HIGH
- **Category**: Purpose · duration · accessibility
- **Estimated scope**: 2 files, small

## Problem

The WAVE area/bar facade disables chart animation, but radar and donut do not. components/wave/charts/index.tsx:217 renders Radar without radarProps, so Recharts defaults to a 1.5s entrance. Line 256 renders Pie without pieProps; the owned implementation explicitly enables animation at components/evilcharts/charts/pie-chart.tsx:249, including a 400ms delay and 1.5s entrance.

## Target

Use the existing EvilCharts escape hatches only at the WAVE product facade:

~~~tsx
<Radar
  ...
  radarProps={{ isAnimationActive: false }}
/>

<Pie
  ...
  pieProps={{ isAnimationActive: false }}
/>
~~~

Operational charts must render fully with the page, matching WaveAreaChart and WaveBarChart.

## Repo conventions to follow

- components/wave/charts/index.tsx:124-140 and 164-178 are the immediate area/bar exemplars.
- docs/WAVE-PRODUCT-UI.md:18 and 88-100 make the WAVE facade the product owner; EvilCharts remains vendored foundation.

## Steps

1. Add radarProps={{ isAnimationActive: false }} to every Radar produced by WaveRadarChart.
2. Add pieProps={{ isAnimationActive: false }} to the Pie produced by WaveDonutChart.
3. Do not edit EvilCharts loading skeletons; current WAVE wrappers do not expose isLoading.
4. Add contract assertions proving both facade props are present and no direct product chart behavior changed.

## Boundaries

- Do not edit components/evilcharts.
- Do not change chart data, colors, labels, geometry, tooltips, or tables.
- Do not add an alternative entrance effect.

## Verification

- **Mechanical**: focused motion contract test, lint, build.
- **Feel check**: load /dashboard_re and a repreneur profile. Donut and both radar charts are complete on first paint and after navigation; reduced motion is identical.
- **Done when**: no production WAVE radar/donut waits for Recharts entrance animation.

## Reconciliation

Implemented at the WAVE facade in 96cf07f. Radar and donut now pass `isAnimationActive: false`; dashboard and strategy browser checks found no chart entrance animation.
