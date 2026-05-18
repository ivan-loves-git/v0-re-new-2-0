---
gsd_type: quick_summary
status: complete
completed_at: "2026-05-18T10:07:31Z"
---

# Restore Visible Automatic Platform Recommendation Preview Summary

## Completed

- Added server-side platform recommendation previews to opportunity match candidates.
- Restored a visible read-only Platform recommendation field in the Add recommendation form.
- Positioned Platform recommendation beside Human recommendation.
- Kept automatic scoring as the save-time source of truth.
- Added visible score and top platform reasons to the preview.

## Verification

- `pnpm exec vitest run lib/utils/__tests__/opportunity-match-scoring.test.ts` passed.
- `pnpm run build` passed with existing non-blocking warnings.

## Product Note

The platform recommendation remains automatic. The UI now makes it visible and understandable before save, instead of hiding it behind explanatory copy.
