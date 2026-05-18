---
gsd_type: quick_summary
status: complete
completed_at: "2026-05-18T00:00:00Z"
---

# Email Tools Soft Expansion Summary

## Completed

- Moved Emails into the Tools sidebar group before Wavy.
- Renamed the page heading to Email Tools.
- Added template audience metadata with `Rep` and future `Opp` support.
- Displayed the audience tag in the template manager and manual-send picker.

## Product Decision Captured

Email should become a reusable operations cockpit for both repreneur and opportunity workflows. The current implementation should expand by adding metadata and contexts to the existing page, not by creating a parallel email tool.

## Deferred

- Add first `Opp` templates when the exact opportunity email use cases are selected.
- Add opportunity recipients and context-aware send flows after trigger rules are defined.
- Consider storing template audience in the database only if staff need to create or filter templates dynamically.

## Verification

- Production build passed.
- Browser check on the local app confirmed the sidebar placement: Tools contains Emails before Wavy, and Emails is no longer under Repreneurs.
- Browser check confirmed `/emails` renders as Email Tools with Overview, Templates, and Manual Send tabs.
- Browser check confirmed the Templates tab shows `Rep` tags on existing templates.
- Browser check confirmed the Manual Send template picker shows the same `Rep` tag in the option labels.
