# 06-03 Summary: Intermediary Email Templates

## Completed

- Added four opportunity/intermediary email templates:
  - opportunity validity check
  - missing-information request
  - repreneur-interest feedback request
  - process-stage follow-up
- Added a reusable M&A intermediary email renderer using editable markdown bodies and template variables.
- Tagged M&A templates as `Opp` templates in Email Tools.
- Kept M&A templates reviewable and testable in test mode.
- Filtered normal manual send so broker-facing templates are not sent to repreneurs by mistake.

## Verification

- Template preview can render M&A templates with sample variables.
- Test send supports M&A templates without logging them as repreneur emails.

## Scope Guard

This does not yet add a dedicated intermediary send workflow, contact picker, or automated reminder schedule. Those should be planned once staff confirms the first template set.
