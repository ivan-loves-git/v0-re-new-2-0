# Phase 7 Research

## Existing Codebase Patterns

- Server actions live under `lib/actions/*` and usually use `createAdminClient` plus access guards.
- Staff-only opportunity pages already use server actions for opportunity documents, matches, and source edits.
- Email sending is split:
  - Repreneur manual sends use `sendEmail` and `email_logs`.
  - M&A templates currently use `sendEmailDirect` in test mode because `email_logs` is repreneur-centric.
- Toast feedback uses `sonner` and the shared green bottom-right success pattern.
- Opportunity detail uses tabs and can accept additional server-loaded data via `app/(dashboard)/opportunities/[id]/page.tsx`.

## Recommended Technical Shape

Use a dedicated lightweight table for M&A opportunity interactions instead of forcing intermediary sends into repreneur email logs.

Rationale:

- `email_logs` requires `repreneur_id`, so intermediary emails do not fit cleanly.
- M&A workflow records need `opportunity_id` and `source_id` as primary context.
- This keeps future analytics possible without mixing user types.

## Data Model

Add `ma_source_interactions`:

- opportunity_id
- source_id
- template_key
- channel
- recipient_email
- subject
- body_markdown
- status
- sent_at
- created_by
- created_at

## UX Shape

On opportunity detail:

- Add `M&A` tab.
- Show source contact card.
- Show template selector.
- Show editable subject and body draft.
- Send button disabled if no source email exists.
- Show recent interaction history.

## Risks

- Email deliverability depends on the existing Resend setup.
- The first version should avoid scheduling and bulk-send logic.
- Logging should not expose source contact data to repreneur portal routes.

