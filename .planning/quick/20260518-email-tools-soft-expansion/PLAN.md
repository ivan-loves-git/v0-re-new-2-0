---
gsd_type: quick_plan
status: complete
created_at: "2026-05-18T00:00:00Z"
completed_at: "2026-05-18T00:00:00Z"
---

# Email Tools Soft Expansion

## Goal

Make Emails feel like a reusable tool surface, not only a repreneur subsection, while keeping the current implementation simple and stable.

## Scope

- Move Emails from the Repreneurs sidebar group into Tools, before Wavy.
- Keep the existing `/emails` route and tab structure.
- Add lightweight audience metadata to email templates so the UI can distinguish `Rep` and future `Opp` templates.
- Show the audience tag in the template management view and manual-send picker.

## Out Of Scope

- No opportunity email send flow yet.
- No new opportunity template components yet.
- No database migration for template audience yet.
- No automation trigger changes.

## Implementation Notes

The soft path is to treat audience as metadata beside the existing template registry. Current templates remain `Rep` because they target repreneurs and repreneur service offers. When opportunity automation starts, new `Opp` templates can enter the same registry and picker without a redesign.

The Email page should remain one cockpit with tabs rather than splitting into separate repreneur and opportunity tools. The likely next extension is a send-context selector or separate send panels inside the same page: `Repreneur send` first, then `Opportunity send` once opportunity recipient and trigger rules are defined.

## Verification

- Sidebar should show Tools -> Emails, then Wavy.
- Repreneurs group should no longer contain Emails.
- The Templates tab should show a small `Rep` badge on existing templates.
- The Manual Send template picker should show the same `Rep` badge.

## Executive Summary

Emails are becoming a shared tool for Re-New operations. The first move is organizational: put the Email page in Tools before Wavy, because it will support more than repreneur follow-up.

The expansion should stay incremental. We add a small template audience tag now, so future opportunity templates can be added cleanly inside the existing page instead of rebuilding the email system.
