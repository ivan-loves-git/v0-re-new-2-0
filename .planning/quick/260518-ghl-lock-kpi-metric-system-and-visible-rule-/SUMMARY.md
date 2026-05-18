---
gsd_type: quick_summary
status: complete
completed_at: "2026-05-18T09:53:37Z"
---

# KPI Metric System and Visible Rule-Based Match Scoring Summary

## Completed

- Kept the shared `KpiMetricTile` component as the single compact visual language for simple KPIs.
- Applied the shared KPI tile to email overview, repreneur analytics, operational KPIs, and opportunity KPI panels.
- Kept automatic platform match recommendation, score, and reasons as the V2 base.
- Clarified staff form copy: the automatic platform score is visible to staff and the repreneur portal once proposed.
- Clarified repreneur portal copy: fit signals are rule-based V2 guidance that Re-New can refine with human review.
- Added scoring tests for strong fit, low-readiness cap, deal-size mismatch cap, and legacy string-field support.
- Deleted the temporary standalone KPI prototype HTML.

## Product Decision Captured

The platform match score is visible to both staff and repreneurs during V2. This is intentionally progressive: it is useful now as a consistent base, and the team can tune weights, wording, or masking later before a broader external release.

## Deferred

- Add a production feature flag or masking toggle before releasing to real external repreneurs if the team decides the score should be hidden.
- Tune scoring weights after observing real examples.
- Add richer explanation copy if repreneurs need more context.

## Verification

- `pnpm exec vitest run lib/utils/__tests__/opportunity-match-scoring.test.ts lib/utils/__tests__/opportunity-journey.test.ts` passed.
- `pnpm run build` passed with existing non-blocking warnings.
