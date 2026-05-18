# KPI Metric System

Wave uses one compact KPI tile for email, repreneur, and opportunity metrics.

This shared component is the UI API for simple metrics: new KPI surfaces should reuse it instead of creating another card language.

## Standard KPI Tile

Every KPI tile must include:

- Icon: small colored chip on the left.
- Title: short metric name.
- Period: muted text directly under the title.
- Value: primary number, visually dominant.
- Trend: always present under the value.
- Info: anchored to the top-right corner.

## Layout

Use the shared `KpiMetricTile` component from `components/ui/kpi-metric-tile.tsx`.

Default grid:

- Wide desktop: up to 8 compact KPI tiles in one row.
- Standard desktop and tablet: 4 per row.
- Mobile: 2 per row unless the surrounding layout requires 1 per row.

Internal structure:

1. Icon and title block at the top.
2. Period below the title as plain muted text, not a pill.
3. Value near the bottom.
4. Trend below the value.

## Color Language

- Email: blue.
- Repreneurs: green.
- Scores: violet.
- Opportunities: teal.
- Attention: amber.
- Risk: red.

Color should mainly live in the icon chip. Do not use decorative card backgrounds for KPIs.

## Trend Language

The trend is traditional static text, not a badge.

- Positive trend: green text at 80% opacity with an up or down arrow based on the metric direction.
- Negative trend: red text at 80% opacity with an up or down arrow based on the metric direction.
- No trend: gray flat dash using the minus icon and `-`.

Trend color follows business meaning, not only mathematical direction. For example, a lower bounce rate is green.

## Info Hover

The info affordance stays in the top-right corner of the tile. It should not move with the title text or affect title wrapping.

Info text should explain:

- What the KPI measures.
- How to read it.
- Why it matters when useful.

## Rollout Scope

The shared tile is the source of truth for:

- Email overview KPIs.
- Analytics || Repreneurs top KPI row.
- Analytics || Repreneurs operational KPI sections.
- Analytics || Opportunities operating KPI row.
- Future dashboard KPI rows.

Do not create new one-off KPI card layouts unless the metric is not a simple KPI and needs a chart, table, or list.

## Opportunity Match Scoring Decision

The opportunity platform recommendation is visible to both staff and repreneurs during the V2 beta. The first version is intentionally rule-based and imperfect: it creates a consistent base score from structured data, then the team can adjust weights and copy after observing real matches.

## Executive Summary

Wave has one KPI language now: compact cards with a colored icon, title, period, value, trend, and top-right info hover. This keeps all analytics surfaces consistent while preserving the compact, colorful style Ivan preferred.

The shared component should be used for every simple KPI going forward so email, repreneur, and opportunity reporting feel like one system instead of separate pages.
