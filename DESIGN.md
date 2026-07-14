---
name: Re-New WAVE Product UI
description: Quiet operational confidence for Re-New's acquisition operating system.
colors:
  canvas: "#f6f8fa"
  ink: "#1f2933"
  surface: "#ffffff"
  primary: "#1f6feb"
  muted-surface: "#f2f4f7"
  muted-ink: "#667085"
  border: "#d8dee7"
  success: "#1a7f37"
  warning: "#9a6700"
  destructive: "#cf222e"
  sidebar: "#081020"
typography:
  chart-nano:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "8px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  chart-detail:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  compact-detail:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  micro-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.055em"
  metadata:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  dense-body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  metric:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  page-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
rounded:
  control: "6px"
  surface: "8px"
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

The WAVE layer governs shadcn building blocks. New screens use the shared classes and components in `app/globals.css` and `components/wave/visual-foundations.tsx`. Impeccable is limited to implementation-level visual polish. It must not propose or change KPIs, product logic, workflows, information hierarchy, information architecture, filters, or strategy.

## Colors

The palette is neutral by default. Re-New blue marks primary actions and current selection. Semantic colors communicate real status only.

- **Canvas** (`#f6f8fa`): application background.
- **Surface** (`#ffffff`): cards, panels, popovers, and segmented summaries.
- **Ink** (`#1f2933`): primary text.
- **Muted ink** (`#667085`): supporting text and micro-labels.
- **Structural border** (`#d8dee7`): the standard separator and container edge.
- **Re-New blue** (`#1f6feb`): primary action, focus, selection, and information state.

**The Meaningful Color Rule.** Color is used for action, selection, data series, or semantic state. It is not used as a decorative stripe on a card, list group, pipeline column, or milestone list.

**The One Product Language Rule.** Product UI uses semantic tokens. Isolated purple treatments, decorative stripes, and screen-specific palettes are prohibited.

## Typography

WAVE uses Inter for the complete product interface and Geist Mono only for identifiers and tabular technical data.

- **Page title:** 24 to 28px, 600 weight, tight but readable tracking.
- **Section title:** 16px, 600 weight, `-0.01em` tracking.
- **Body:** 14px, 400 weight, 1.5 line height.
- **Dense UI and metadata:** 10px, 12px, and 13px according to available space.
- **Chart detail:** 8px or 9px only inside charts where the full label remains available through accessible text or a data table.
- **Micro-label:** 11px, 600 weight, uppercase, `0.055em` tracking, muted color.
- **Primary metric:** 26px, 600 weight, tabular figures.

**The Micro-label Decision.** Ivan explicitly retained uppercase compact interface labels. Use `.wave-micro-label` or `WaveMicroLabel` for KPI labels, table-style labels, short category names, and compact navigation labels. Do not improvise local uppercase and tracking values. Do not place a decorative micro-label above every section heading.

## Elevation

WAVE is flat by default. Panels use a one-pixel structural border and tonal layering. Wide soft shadows are reserved for temporary overlays such as dialogs, popovers, menus, and tooltips where elevation communicates stacking.

**The Quiet Surface Rule.** A persistent panel uses `rounded-lg border bg-card shadow-none`. Never combine a persistent card border with `shadow-xl` or `shadow-2xl`. Persistent cards and form groups do not exceed a 12px radius.

## Components

### Quiet panels

Use `WavePanel` or `.wave-panel`. Panels have an 8px radius, one-pixel border, white surface, and no decorative edge. Grouped collections and pipeline columns use the same neutral container.

### Semantic emphasis panels

Use `WaveSemanticPanel` or `.wave-semantic-panel`. Emphasis comes from a light semantic tint and a complete one-pixel border. Do not use a gradient, thick border, or side stripe. Consent is the reference implementation.

### Segmented metric summaries

Use `WaveSegmentedSummary` with `WaveSegmentedMetric` when several compact values belong to one summary. One bounded surface with internal separators replaces a grid of individually colored metric cards.

### Motion

Product content is visible immediately. Motion may communicate hover, focus, expansion, selection, progress, or loading. Do not stagger ordinary lists or roadmap entries on page load. Always respect reduced motion.

### Charts

Use the WAVE chart facade in `components/wave/charts`. EvilCharts supplies foundations, while Re-New owns tokens, labels, accessibility, and chart-type rules. Decorative gradients or hatching are not used unless they encode data and the chart facade explicitly provides them.

## Do's and Don'ts

### Do:

- **Do** use `.wave-micro-label` for approved compact uppercase labels.
- **Do** use `WavePanel`, `WaveSemanticPanel`, and `WaveSegmentedSummary` as the starting point for new persistent surfaces.
- **Do** use full structural borders and light semantic tints.
- **Do** use Re-New semantic color tokens instead of raw purple or screen-specific colors.
- **Do** load operational content immediately and reserve motion for state feedback.
- **Do** preserve active tabs, navigation selection, focus rings, loading feedback, and genuine status color.

### Don't:

- **Don't** use colored left, right, or top borders thicker than one pixel as decoration.
- **Don't** add decorative rails inside milestone or checklist groups.
- **Don't** combine persistent card borders with wide soft shadows or oversized radii.
- **Don't** use decorative page, header, callout, or progress gradients.
- **Don't** split one compact summary into individually colored statistic cards.
- **Don't** stagger ordinary product content on page load.
- **Don't** use repeating diagonal stripes or isolated purple styling.
- **Don't** let Impeccable alter product semantics, KPIs, workflows, hierarchy, information architecture, filters, or strategy.
