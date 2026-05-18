---
gsd_type: quick_plan
status: complete
created_at: "2026-05-18T10:07:27Z"
completed_at: "2026-05-18T10:07:31Z"
---

# Restore Visible Automatic Platform Recommendation Preview

## Goal

Fix the recommendations form so the platform recommendation remains automatic but is visibly present beside the human recommendation.

## Scope

- Keep server-side automatic scoring as the source of truth on save.
- Precompute a platform recommendation preview for each eligible repreneur on the opportunity detail page.
- Show a read-only Platform recommendation field in the Add recommendation form.
- Place it to the left of Human recommendation.
- Show score and top reasons so staff can understand what will be stored before saving.

## Out Of Scope

- No manual editing of platform recommendation.
- No change to the persisted scoring algorithm.
- No database migration.

## Verification

- Focused scoring test passes.
- Production build passes.
- Browser check confirms the field is visible in the form before deploy.

## Executive Summary

The platform recommendation should not be a hidden implementation detail. It is still automatically calculated, but staff need to see it before saving so they understand the platform view versus the human override.

This fix restores the correct mental model: platform recommendation on the left, human recommendation on the right, both visible, with only the human side manually editable.
