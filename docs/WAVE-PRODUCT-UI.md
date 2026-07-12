# WAVE Product UI

This is the binding design contract for Wave 2.0. It is written for both people and AI coding tools.

## Direction

Wave should feel like quiet operational confidence: calm, precise, mature, and warm enough to support a relationship-led business. The interface combines trusted guidance, the sense of movement suggested by waves and flow, and restrained editorial technology.

Primer is a behavioral reference for dense operational work, especially progressive filtering. It is not a visual skin to copy. shadcn remains the component foundation. WAVE Product UI is the stricter product layer that decides which variants are allowed and how they are composed.

## Non-negotiable rules

1. Reuse an existing shadcn component before creating new interaction primitives.
2. Product pages use semantic tokens from `app/globals.css`; do not introduce isolated hex colors for routine surfaces.
3. Use `SectionPageHeader` for staff page headings and `KpiMetricTile` for dashboard KPI summaries.
4. Large directories use `CollectionFilterBar`. Search is always visible. Optional filters are added progressively and become editable, removable chips.
5. Filter state is shareable URL state. Use the `useCollectionFilters` hook and a stable `CollectionFilterDefinition` list.
6. Product charts import only from `@/components/wave/charts`. Direct Recharts and direct EvilCharts feature imports are prohibited by lint.
7. Cards use the standard border, background, radius, and at most a subtle shadow. Avoid decorative gradients, glows, glass effects, and oversized radii.
8. Motion must explain a state change. Charts default to no entrance animation and respect reduced motion.
9. Desktop and mobile are first-class. Popovers may become bottom sheets on narrow screens. Hover cannot be the only way to discover or operate a control.
10. Empty and zero-result states must name what happened and expose the next recovery action.
11. The staff shell is stable product infrastructure: dark navy navigation, a 48px workspace bar, a 1440px maximum canvas, and 16px/24px/32px responsive page padding.
12. Use semantic hierarchy before containers. A page is not a stack of equal cards: one primary work surface, supporting panels, then secondary reference material.

## Foundation

### Color

- `primary`: main action and selection
- `muted` and `surface-subtle`: quiet grouping and secondary context
- `border`: structure before shadow
- `success`, `warning`, `destructive`, `info`: semantic status only
- `chart-1` to `chart-5`: ordered WAVE categorical palette

Charts should not rely on color alone. Every chart includes a screen-reader table, visible labels or legends where useful, and a text title supplied through its accessible label.

### Shape and elevation

- Standard controls and cards: `rounded-md` or the 8px shadcn default radius
- Page-level or composite sections: `rounded-lg`
- Default product surfaces have no shadow. Use `shadow-xs` or `shadow-sm` only for a floating layer whose separation is otherwise unclear
- Do not stack multiple bordered cards merely to create decoration

### Type and density

- Product titles are concise and sentence case
- Labels describe the business concept, not the database field
- Tables remain dense enough for operations, with whitespace concentrated around page structure and decision points
- Numeric data uses tabular figures where comparison matters

### Page archetypes

Every product screen starts from one of four compositions:

1. **Dashboard:** compact page header, one KPI rail, two or three larger operational regions, then a full-width recent-work table. Do not add shortcut cards that duplicate the sidebar.
2. **Collection:** page header and actions, progressive filter toolbar, result count, then one dense table or directory. The filter and collection read as one work surface.
3. **Record:** identity header with semantic `h1`, status and metadata, primary next action, tabs, then a main/aside composition. Avoid repeating the record identity inside every tab.
4. **Focus form:** maximum width 768-1024px, grouped field sections, explicit helper copy, and actions at the end of the reading flow.

Staff pages use `SectionPageHeader`. Its two-pixel tide marker is the restrained WAVE signature and must not be replaced by decorative gradients or oversized icon tiles.

### Navigation and shell

- The sidebar uses WAVE navy and a single active tide marker. Navigation does not animate, wiggle, cycle emoji, or compete with the work.
- Repeated labels such as Dashboard and Analytics include their domain in collapsed tooltips.
- The top workspace bar is sticky and contains the sidebar control, semantic breadcrumb, and workspace context.
- The sidebar closes after navigation on mobile. All navigation and account controls retain keyboard focus and at least a 40px mobile target.
- The page shell exposes a skip link and one main landmark.

## Collection filtering

The canonical anatomy is:

1. Visible search field with its own clear control
2. `Add filter` button that lists only unused criteria
3. Active chips formatted as `Criterion: Value`
4. Chip body edits the value; chip close control removes the criterion
5. No more than four chips shown before a `+N active` control; that control opens the hidden chips so each remains editable and removable
6. `Clear filters` preserves search; `Reset all` clears both search and filters
7. Live result count announces changes
8. URL parameters use stable, human-readable keys and omit defaults

Desktop uses a popover for adding filters. Mobile uses a bottom sheet. Pagination resets when a filter changes.

## Charts

EvilCharts is the required source library. Official source is vendored under `components/evilcharts` and recorded in its `UPSTREAM.md`. WAVE customization lives in `components/wave/charts`.

Approved chart behavior:

- Area: time trends and cumulative development
- Bar: categorical comparison and distributions
- Radar: compact multi-dimension profiles where all axes share a scale
- Donut: small part-to-whole summaries with a visible adjacent legend
- Default effects are restrained gradients, solid strokes, no glow, no hatching, and no animated dashed lines
- Use the WAVE categorical palette unless a semantic positive, warning, or risk meaning is explicit
- Every chart supplies an accessible label and data table
- Small screens retain the main analytical view; labels may shorten but the chart cannot disappear without a text/table replacement
- EvilCharts does not currently provide a calendar heatmap. The existing activity calendar remains a purpose-built WAVE grid until the upstream library supports that form; it is not a precedent for new one-off charts.

## AI implementation checklist

Before completing a UI change, an AI coding tool must verify:

- the page uses the approved product components rather than a one-off variant
- new state has a clear empty, loading, error, and success behavior where applicable
- keyboard focus, accessible names, and touch targets work
- direct chart imports are absent outside the WAVE and vendored EvilCharts folders
- the implementation passes tests, lint, build, and browser checks at desktop and mobile widths
- the design system gallery is updated when a new reusable pattern is introduced

## Executive Summary

Wave 2.0 keeps shadcn as its reliable technical base and adds a much stricter Re-New product layer above it. Staff see calmer pages with progressive filters, consistent operational components, and one recognizable chart language.

Future work no longer chooses styles page by page. It selects from this contract, the design system gallery, the collection filter pattern, and the WAVE chart facade, which makes the product more coherent while keeping it flexible enough to evolve.
