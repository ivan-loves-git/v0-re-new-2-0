# Phase 7 Context: M&A Intermediary Workflow Activation

## Goal

Staff can act on an opportunity's linked M&A source from the opportunity detail page: review the source, select a broker/intermediary template, generate a contextual draft, send it, and keep a lightweight interaction record.

## Product Boundary

This is not a full M&A CRM and not an intermediary portal. It is a staff-only workflow layer that connects the existing M&A source directory, opportunity detail, and M&A email templates.

## Current Inputs

- Phase 6 created normalized `ma_sources`, `/opportunities/ma`, and four M&A/intermediary email templates.
- M&A templates are currently reviewable/testable in Email Tools, but they are intentionally excluded from normal repreneur manual sends.
- Opportunity detail already shows `MaSourcePanel` in the Overview tab.
- Opportunity matching already has human/platform recommendation context and pursuit stages.

## UX Direction

Keep the workflow contextual:

- Source context stays visible on the opportunity detail page.
- Staff should not need to leave the opportunity to email the intermediary.
- The generated message should be editable before send.
- Sent workflow actions should be visible on the same opportunity.

## Scope

In scope:

- Add an opportunity-level M&A workflow tab or panel.
- Prefill M&A email template variables from source, opportunity, and best available repreneur context.
- Send intermediary email to the source contact email.
- Log the interaction against the opportunity and source.
- Show recent M&A interactions on the opportunity.

Out of scope:

- Bulk campaigns.
- M&A firm portal.
- Full contact/company CRM.
- AI-generated freeform email drafting.
- Automatic sequence scheduling.
- Repreneur-facing exposure of source details.

