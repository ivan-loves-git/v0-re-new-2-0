# Phase 9 UI Spec: Repreneur Profile Detail Tabs

**Date:** 2026-06-18
**Status:** Approved for implementation
**Surface:** Staff repreneur detail page

## Objective

Turn the repreneur profile from a long mixed page into a tabbed staff work surface. The page should stay dense and operational while making each information cluster easier to find.

## Navigation

Use the same small grey tab treatment as opportunity details:

```text
[ Overview ] [ Qualification ] [ Readiness ] [ Opportunities ] [ Engagement ] [ Timeline ]
```

Tab values:
- `overview`
- `qualification`
- `readiness`
- `opportunities`
- `engagement`
- `timeline`

Compatibility:
- `?tab=questionnaire` should open `Qualification` because existing completion links use that tab name.
- `Overview` should be the default tab and remove the query string when selected.

## Header

The existing profile header remains above the tabs:

```text
[ Back ]                                                          [ Actions v ]

(Avatar)  First Name   Last Name
          email | phone
          missing fields / data completion badges if needed

                                                Status     Journey      Actions
                                                [Lead]     [Ready 8/17] [...]
```

## Overview

Overview is the command view.

```text
+----------------------------------------------------------------------------------+
| Next Best Action                                                                  |
| One action title, reason, and 2-3 direct buttons/links                            |
+----------------------------------------------------------------------------------+

+--------------------------------------+-------------------------------------------+
| Relationship Snapshot                 | Qualification Snapshot                    |
| Status, journey, source, portal        | WHO, WHEN, T2, recommendation, flags       |
| current needs                          | compact graph/score cues                   |
+--------------------------------------+-------------------------------------------+

+--------------------------------------+-------------------------------------------+
| Acquisition Project                    | Open Opportunities                         |
| sectors, regions, deal size, equity    | top 3 matches with fit/status              |
+--------------------------------------+-------------------------------------------+

+--------------------------------------+-------------------------------------------+
| Readiness Progress                     | Recent History                             |
| milestone groups                       | latest 4 activities/notes                  |
+--------------------------------------+-------------------------------------------+

+----------------------------------------------------------------------------------+
| Documents and Access                                                              |
| CV, LDC, assessment, portal, offers                                               |
+----------------------------------------------------------------------------------+
```

## Qualification

```text
+--------------------------------------+-------------------------------------------+
| WHO / WHEN Scores                     | Profile Radar                             |
| score cards and scoring accuracy       | existing radar/pentagram graphs            |
+--------------------------------------+-------------------------------------------+

+----------------------------------------------------------------------------------+
| Leadership Assessment                                                            |
| full assessment card, decision, radar, maturity tags                              |
+----------------------------------------------------------------------------------+
```

## Readiness

```text
+----------------------------------------------------------------------------------+
| Acquisition Project                                                               |
| target sectors, regions, deal size, equity, target details, current needs         |
+----------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------+
| Readiness Milestones                                                              |
| full Tier 3 milestone card                                                        |
+----------------------------------------------------------------------------------+
```

## Opportunities

```text
+----------------------------------------------------------------------------------+
| Opportunity Matches                                                               |
| full reverse match table with fit, human view, status, stage, update, link        |
+----------------------------------------------------------------------------------+
```

## Engagement

```text
+--------------------------------------+-------------------------------------------+
| Portal Access                         | Documents                                  |
| enable/resend/disable card             | CV and LDC uploads/downloads               |
+--------------------------------------+-------------------------------------------+

+----------------------------------------------------------------------------------+
| Offers                                                                            |
| assigned packages, active/completed status, milestones                            |
+----------------------------------------------------------------------------------+
```

## Timeline

```text
+--------------------------------------+-------------------------------------------+
| Activity Stream                       | Notes                                      |
| calls, emails, interviews, meetings    | free text notes by team                    |
+--------------------------------------+-------------------------------------------+
```

## Responsive Behavior

- Desktop: two-column grids where useful.
- Tablet: same tab list, cards wrap to one column where content density requires it.
- Mobile: tab list scrolls horizontally, all cards become single column.
- Text must not overflow buttons, badges, or cards.

## Visual Rules

- Reuse existing `Card`, `Badge`, `Button`, `Tabs`, `Table`, and Lucide icons.
- Keep card radius, spacing, and typography consistent with current dashboard pages.
- No decorative gradients, orbs, marketing hero layout, or nested cards.
- Keep dashboard density: compact headings, useful summaries, and direct actions.

## Executive Summary

The repreneur profile becomes a staff command surface instead of a long archive. Overview gives the team the immediate operating picture; the other tabs hold the deeper detail.

The existing opportunity tab style is reused, so this feels like part of the same platform rather than a new screen family.
