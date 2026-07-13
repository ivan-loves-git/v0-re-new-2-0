---
target: current WAVE product interface
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-07-13T10-03-42Z
slug: app-re-new-team-dashboard-re
---
Method: dual-agent (A: impeccable_design_review · B: impeccable_detector)

# Re-New WAVE product critique

Target: production Re-New interface at `https://app.re-new.team`, centered on the repreneur dashboard, opportunity operations, records, filtering, and portal.

## Design health score

| Nielsen heuristic | Score /4 | Summary |
|---|---:|---|
| Visibility of system status | 3 | Strong skeletons, active navigation, result counts, badges, and filter status. |
| Match with the real world | 3 | Strong domain language overall, with unexplained internal concepts and mixed locale remnants. |
| User control and freedom | 3 | Removable filters, clear/reset, back links, dismissible sheets, and addressable tabs work well. |
| Consistency and standards | 3 | The shell and record grammar are coherent; dashboards, portal cards, and legacy accents still diverge. |
| Error prevention | 2 | Some explicit exposure and preview safeguards exist, but recovery and confirmation are inconsistent. |
| Recognition rather than recall | 2 | Navigation and breadcrumbs help; hidden mobile information and unexplained scoring create memory work. |
| Flexibility and efficiency | 2 | Search and filtering are useful, but large collections lack sorting, saved views, bulk actions, and shortcuts. |
| Aesthetic and minimalist design | 2 | Calm visual foundations are undermined by too many equally weighted surfaces. |
| Error recognition and recovery | 2 | Empty states exist, but recovery guidance is not consistently contextual. |
| Help and documentation | 2 | System guidance exists, while consequential concepts have too little in-context explanation. |
| **Total** | **24/40** | **Acceptable foundation; significant improvement needed.** |

## Anti-pattern verdict

**Conditional pass, with localized failures.** The shell feels authored and credible: restrained navy, blue, and teal; tight radii; structural borders; operational typography; and disciplined headers. The interface becomes template-like where information architecture equalizes everything: the repreneur dashboard collage, the Add Filter wall of values, and the portal's repeated deal cards.

The deterministic detector returned five warnings. Two colored side stripes on rounded group containers are high-confidence findings. The shared tab underline is a false positive, the roadmap palette warning is likely over-broad, and the pipeline top edges are contextual rather than clearly defective.

## Working strengths

1. The application shell is mature and trustworthy, with stable navigation, breadcrumbs, hierarchy, and focus foundations.
2. Opportunity operations are organized around staff decisions rather than generic analytics.
3. Opportunity records frame high-stakes decisions well: status and exposure precede identity, and Next Best Action provides a reason and a primary action.

## Priorities

### P1 — Build mobile collections around mobile decisions

At 390px, Opportunity Find exposes only the Reference column: a 1528px table lives inside a 356px viewport. Record tabs also overflow, while the portal becomes a long stack of undifferentiated cards. Replace the desktop table with a compact mobile collection showing title, journey, pursuit signal, and one secondary fact; move the rest into disclosure. Reduce record navigation to three primary destinations plus More or a section picker.

### P1 — Make Add Filter genuinely progressive

The filter control immediately reveals eight dimensions and dozens of values in a 360px layer, with the same wall repeated in the mobile sheet. Show dimensions first. After choosing one, transition to a searchable value picker with common or recent values, a clear back step, full-width wrapping for long labels, and coarse-pointer targets near 44px.

### P1 — Give the repreneur dashboard one governing question

The page combines five KPIs, ranking and assessment cards, funnel and activity cards, a table, two charts, and 191 Wavy suggestions. Center it on “What needs a decision today?” Move cohort history to Analytics and make Wavy one ranked action queue rather than a second dashboard.

### P2 — Turn the portal from inventory into guidance

Ten equally weighted “Selected by Re-New” cards flatten the strength of that recommendation. Separate Active pursuits from New proposals, lead with one recommended review and its reason, then use a denser sortable list for the remainder.

### P2 — Replace implementation language with user language

Concepts such as `WHO`, `WHEN`, `Platform 70%`, and mixed English/French date strings force translation. Adopt one locale, explain scoring and exposure in context, use semantic row links with concise accessible names, and keep meaningful metadata at readable AA contrast.

## Persona signals

- **Alex, power user:** large collections lack saved views, bulk selection, shortcuts, and efficient criterion/value entry.
- **Sam, keyboard, screen-reader, or low-vision user:** the skip link, landmarks, focus styling, and live counts are strong; semantic row actions, visible keyboard controls, contrast, accessible field names, and zoom behavior need work.
- **Casey, distracted mobile user:** core decision signals require horizontal swiping, later record tabs disappear, portal prioritization is weak, and several targets are below 44px.

## Minor observations

- Colored left stripes in opportunity and repreneur groups are confirmed Impeccable anti-patterns.
- Tiny uppercase tracked labels remain in the top bar, KPI labels, and suggestion status copy.
- `Portal-preview`, the stale “June rule,” and `10 visible deal(s)` need copy cleanup.
- Duplicate shell-header implementations and legacy styling surfaces remain drift risks.
