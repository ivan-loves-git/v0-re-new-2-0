---
gsd_type: quick_plan
status: complete
created_at: "2026-05-18T09:52:19Z"
completed_at: "2026-05-18T09:53:37Z"
---

# KPI Metric System and Visible Rule-Based Match Scoring

## Goal

Keep the useful KPI harmonization work, clean temporary noise, and lock the product decision that the V2 platform match score is visible to both staff and repreneurs.

## Scope

- Keep one compact KPI tile component as the shared visual language for simple metrics.
- Use that shared tile on email, repreneur analytics, repreneur operational KPIs, and opportunity KPIs.
- Keep the automatic opportunity platform recommendation, score, and reasons as the V2 base.
- Make the visibility decision explicit: staff see the score, and repreneurs see it in the portal once an opportunity is proposed.
- Add a focused unit test for the rule-based scoring helper.
- Remove temporary KPI prototype noise from the worktree.

## Out Of Scope

- No AI matching model.
- No hidden sector interpretation.
- No database migration.
- No promise that the first scoring weights are final.
- No production masking flag yet; that can be added before a real external release if needed.

## Implementation Notes

The scoring logic stays deliberately simple. It combines WHO score, WHEN score, sector fit, geography fit, deal size fit, and risk caps. This gives the team a consistent base score now, while keeping human recommendation and notes separate for judgment and later tuning.

The KPI visual system is treated as a UI API: simple metric cards should reuse `KpiMetricTile` rather than creating new one-off KPI cards.

## Verification

- Unit test the opportunity match scoring helper.
- Run the production build.
- Confirm temporary prototype HTML is gone and build cache is not included in the quick task commit.

## Executive Summary

We are keeping the KPI harmonization work because it gives Wave one compact metric language across email, repreneur analytics, and opportunity analytics. This makes the platform feel more coherent and easier to extend.

We are also accepting the automatic platform match score as the V2 base. It is visible to both staff and repreneurs for now, with clear wording that it is rule-based and can be refined as real usage teaches the team where the weights should change.
