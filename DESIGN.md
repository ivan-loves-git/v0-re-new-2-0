---
name: Re-New WAVE Product UI
description: Quiet operational confidence for Re-New's acquisition operating system.
colors:
  canvas: "oklch(1 0 0)"
  ink: "oklch(0.145 0 0)"
  surface: "oklch(1 0 0)"
  primary: "oklch(0.205 0 0)"
  muted-surface: "oklch(0.97 0 0)"
  muted-ink: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  chart-blue: "oklch(0.623 0.214 259.815)"
  success: "oklch(0.49 0.14 150)"
  warning: "oklch(0.49 0.12 75)"
  destructive: "oklch(0.577 0.245 27.325)"
  sidebar: "oklch(0.985 0 0)"
typography:
  chart-nano:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "8px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  chart-detail:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  compact-detail:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  micro-label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.055em"
  metadata:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  dense-body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  page-title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
rounded:
  control: "0.45rem"
  surface: "0.45rem"
  elevated-surface-max: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  quiet-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  semantic-callout:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  micro-label:
    textColor: "{colors.muted-ink}"
    typography: "{typography.micro-label}"
---

# Design System: Re-New WAVE Product UI

## Overview

**Creative North Star: "Quiet Operational Confidence"**

WAVE is a restrained operating surface for a small team doing consequential acquisition work. It should feel mature, compact, familiar, and dependable. Structure comes from spacing, typography, shared borders, and progressive disclosure. Decoration never substitutes for hierarchy.

[Decision #225](https://github.com/re-new-team/renew-governance/issues/225) and its [neutral Vega preset](https://ui.shadcn.com/create?preset=b1JUc7Xt8E) own the exact light/dark visual target. `app/globals.css` applies those values; this guide describes their use rather than introducing a second palette. The existing Radix controls and `@reui` Radix Vega registry stay in place. The preset preview's Base UI scaffold is not an application migration.

The WAVE layer governs shadcn building blocks. New screens use the shared classes and components in `app/globals.css` and `components/wave/visual-foundations.tsx`. For an applicable new pattern, inspect the ReUI MCP preview and actual API, then adapt a free component or example to WAVE; keep ordinary controls in shadcn. Design tooling supplies implementation-level guidance within approved UI scope; it must not propose or change KPIs, product logic, workflows, information hierarchy, information architecture, filters, or strategy.

## Colors

The palette is neutral by default. Primary actions are near-black on light surfaces and near-white on dark surfaces. The approved blue scale is for charts; the preset also supplies a blue `--sidebar-primary` in dark mode. Navigation selection uses the neutral sidebar accent and a legible foreground marker. Semantic colors communicate real status only.

- **Canvas and surface:** `--background`, `--card`, and `--popover` in both modes.
- **Text and structure:** foreground pairs, `--muted-foreground`, `--border`, and `--ring` from the preset.
- **Primary action and selection:** neutral `--primary` and `--sidebar-accent`; preserve a visible focus ring and active-row marker.
- **Data series:** the exact blue `--chart-1` through `--chart-5` scale. Keep accessible labels and the chart facade's non-color cues.

ReUI's additional `--success`, `--warning`, `--info`, `--invert`, and `--destructive-foreground` pairs are defined beside the preset values in `app/globals.css` and exposed through Tailwind. The success/warning/info colors are darker on light surfaces and lighter on dark surfaces so their foreground pairs and standalone status text remain readable. The preset's `--destructive` backgrounds are unchanged; the dark destructive foreground is near-black for contrast. `--surface-raised` and `--surface-subtle` alias the card and muted surfaces. Use these semantic pairs for status controls, badges, alerts, and toasts; avoid a second WAVE-specific palette.

**The Meaningful Color Rule.** Color is used for action, selection, data series, or semantic state. It is not used as a decorative stripe on a card, list group, pipeline column, or milestone list.

**The One Product Language Rule.** Product UI uses semantic tokens. Isolated purple treatments, decorative stripes, and screen-specific palettes are prohibited.

## Typography

WAVE uses Geist for body and controls, Figtree for semantic headings and shared card/dialog/sheet titles, and Geist Mono only for identifiers and tabular technical data.

- **Page title:** 24 to 28px, 600 weight, tight but readable tracking.
- **Section title:** 16px, 600 weight, `-0.01em` tracking.
- **Body:** 14px, 400 weight, 1.5 line height.
- **Dense UI and metadata:** 10px, 12px, and 13px according to available space.
- **Chart detail:** 8px or 9px only inside charts where the full label remains available through accessible text or a data table.
- **Micro-label:** 11px, 600 weight, uppercase, `0.055em` tracking, muted color.
- **Primary metric:** 26px, 600 weight, tabular figures.

**The Micro-label Decision.** Ivan explicitly retained uppercase compact interface labels. Use `.wave-micro-label` or `WaveMicroLabel` for KPI labels, table-style labels, short category names, and compact navigation labels. Do not improvise local uppercase and tracking values. Do not place a decorative micro-label above every section heading.

## Elevation

WAVE is flat by default. Panels use a one-pixel structural border and tonal layering. Wide soft shadows are reserved for temporary overlays such as dialogs, popovers, menus, and tooltips where elevation communicates stacking. The base radius is the preset's `0.45rem`; keep larger persistent surfaces within the 12px WAVE cap.

**The Quiet Surface Rule.** A persistent panel uses `rounded-lg border bg-card shadow-none`. Never combine a persistent card border with `shadow-xl` or `shadow-2xl`. Persistent cards and form groups do not exceed a 12px radius.

## Components

### shadcn composition

Check installed `components/ui` components before adding a new primitive. The
local configuration uses Next.js App Router, RSC, Tailwind v4, existing `new-york` shadcn source controls,
Radix APIs, Lucide icons, and imports from `@/components/ui`. `components.json` explicitly routes `@reui` to `radix-vega`; its existing shadcn style field is not a Base UI migration. For dashboards
and operational pages, prefer shadcn `Card`, `Table`, `Badge`, `Tabs`, `Sheet`,
`Dialog`, `Select`, `Input`, `Button`, `Skeleton`, `Tooltip`, `DropdownMenu`,
and `Chart` over custom markup.

Dropdown menus use the preset's subtle neutral accent and translucent popover surface. Keep Radix focus, keyboard, and open/close behavior intact.

### Quiet panels

Use `WavePanel` or `.wave-panel`. Panels use the preset radius, a one-pixel border, the current `--card` surface, and no decorative edge. Grouped collections and pipeline columns use the same neutral container.

### Semantic emphasis panels

Use `WaveSemanticPanel` or `.wave-semantic-panel`. Emphasis comes from a light semantic tint and a complete one-pixel border. Do not use a gradient, thick border, or side stripe. Consent is the reference implementation.

### Segmented metric summaries

Use `WaveSegmentedSummary` with `WaveSegmentedMetric` when several compact values belong to one summary. One bounded surface with internal separators replaces a grid of individually colored metric cards.

### Motion

Product content is visible immediately. Motion may communicate hover, focus, expansion, selection, progress, or loading. Do not stagger ordinary lists or roadmap entries on page load. Always respect reduced motion.

### Charts

Use the WAVE chart facade in `components/wave/charts`. EvilCharts supplies foundations, while Re-New owns tokens, labels, accessibility, and chart-type rules. Decorative gradients or hatching are not used unless they encode data and the chart facade explicitly provides them.

The approved blue scale changes color meaning only; it does not change series order, labels, or chart behavior.

## Existing screen contracts

This theme changes shared colors, type, radius, sidebar styling, and status feedback across the dashboard, public intake and assessment, portal, login, and email screens. It does not change their routes, content, data, controls, or motion. [Product Change #221](https://github.com/re-new-team/renew-governance/issues/221) and [Ticket #222](https://github.com/re-new-team/renew-governance/issues/222) separately own the accepted email review queue: columns, search, sorting, selection, detail, archive, and send interactions remain their contract. Apply this visual foundation to that implementation without replacing its layout or sending customer mail.

## Do's and Don'ts

### Do:

- **Do** use `.wave-micro-label` for approved compact uppercase labels.
- **Do** use `WavePanel`, `WaveSemanticPanel`, and `WaveSegmentedSummary` as the starting point for new persistent surfaces.
- **Do** use full structural borders and light semantic tints.
- **Do** use Re-New semantic color tokens instead of raw purple or screen-specific colors.
- **Do** load operational content immediately and reserve motion for state feedback.
- **Do** preserve active tabs, navigation selection, focus rings, loading feedback, genuine status color, and the WAVE tide marker. A border used for these product meanings is not a decorative accent.

### Don't:

- **Don't** use colored left, right, or top borders thicker than one pixel as decoration.
- **Don't** add decorative rails inside milestone or checklist groups.
- **Don't** combine persistent card borders with wide soft shadows or oversized radii.
- **Don't** use decorative page, header, callout, or progress gradients.
- **Don't** split one compact summary into individually colored statistic cards.
- **Don't** stagger ordinary product content on page load.
- **Don't** use repeating diagonal stripes or isolated purple styling.
- **Don't** let design tooling alter product semantics, KPIs, workflows, hierarchy, information architecture, filters, or strategy.
