---
phase: 6
title: M&A Source Directory and Intermediary Email Workflows
status: planned
created: 2026-05-18
---

# Phase 6 Context

## User Intent

Ivan wants M&A intermediaries to become a first-class operating surface. Opportunity detail already stores a source/contact, but staff now need one place to see M&A sources, edit contact details, and connect the email/template workflow to the intermediary relationship.

## Product Decision

This is not a full M&A CRM or intermediary portal. The June/V2-safe scope is:

- a staff-only M&A source directory under the Opportunities area;
- editable firm/contact metadata;
- opportunity counts and follow-up signals per source;
- M&A/intermediary email templates that can be reviewed from Email Tools;
- no automated outbound send to M&A sources yet.

## Scope

- Add `/opportunities/ma` as a staff page labeled `M&A`.
- Show sources/intermediaries with firm name, type, contact name, contact email, phone, notes, opportunity count, open opportunity count, stale opportunity count, and latest opportunity date.
- Create/edit source records from the M&A page.
- Backfill existing opportunity `source_label` values into `ma_sources` and link opportunities to the matching source where safe.
- Add four M&A email templates:
  - check whether an opportunity is still valid;
  - request more information;
  - share repreneur interest / request feedback;
  - follow up on process stage.
- Keep templates reviewable in `/emails`.

## Out of Scope

- Mass import of 300 to 1000 M&A contacts.
- Activity timeline / CRM history per source.
- M&A firm portal.
- Automated scheduled email sending.
- Deliverability workflows beyond existing Email Tools.

## Assumptions

- Existing `ma_sources` table is the correct base.
- Existing opportunity `source_label` rows should be normalized into `ma_sources` instead of creating a second source model.
- Source/contact data remains staff-only.
- Email templates can be added as editable generic templates before building direct M&A-source sending.
