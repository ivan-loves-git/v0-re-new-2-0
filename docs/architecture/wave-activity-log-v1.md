# WAVE activity log v1

Product Change: [#268](https://github.com/re-new-team/renew-governance/issues/268). Status: candidate, not released.

`wave_activity_events` keeps one append-only row per buyer or staff action in WAVE's own database, so behaviour can be understood without PostHog. Staff read it in Claude through the [staff Claude connection](staff-mcp-connector-v1.md) like any other table; its column comments explain each field in `describe_table`.

## What is recorded

| Action | When | Details |
| --- | --- | --- |
| `auth.signed_in` | Anyone signs in | role resolved from `app_user_roles` |
| `portal.deal_opened` | A buyer opens a deal detail, every visible open | `opportunity_id` |
| `portal.memo_opened` | A buyer receives the information memorandum file | `document_id`, `match_id` |
| `portal.nda_template_downloaded` | A buyer downloads the NDA template | `match_id` |
| `portal.interest_expressed` | A buyer marks interest | `path`: `recommendation`, `reconsideration` or `self_initiated` |
| `portal.interest_declined` | A buyer declines | `reason_categories`, `reason_text` |
| `portal.interest_withdrawn` | A buyer withdraws, or staff withdraw on their behalf | `reason`, `on_behalf_of_repreneur` |
| `profile.target_thesis_changed` | Acquisition criteria change (buyer or staff) | `changes`: each field's `from` and `to` |
| `profile.contribution_certified` | A buyer certifies their LDC or advisory team | `item` |
| `profile.language_changed` | A buyer changes the interface language | `language` |
| `mcp.connected` | A staff member connects Claude Code | — |
| `mcp.tool_called` | Each staff Claude tool call | `tool`, `table`, `outcome`; never record content |

Every row has `occurred_at`, `actor_user_id` (Better Auth user; join `app_user_roles.user_id` for the email), `actor_role` and, where relevant, `repreneur_id`, `opportunity_id` and `match_id`.

## Rules

- Recording runs after the response through `recordActivity` (`lib/activity/activity-log.ts`). A failed write logs `wave_activity.record_failed` and never fails or slows the person's action.
- Append-only: `service_role` may insert and read only; browser roles have no access; RLS is on. There are no foreign keys, so removing a buyer or opportunity never rewrites history.
- No IP addresses, user agents or document contents are stored.
- To record a new action, add its code to `ACTIVITY_ACTIONS`, call `recordActivity` after the action succeeds, and add it to the column comment and this table.

Not yet recorded: deal-list views, staff CRM edits of buyer records, opportunity and M&A directory edit history, note deletions, sign-out.

## Verification

- `lib/__tests__/wave-activity-log.test.ts`.
- `bash scripts/rehearse-wave-activity-events.sh` (in CI `Verify`) proves the append-only privileges and row checks against disposable PostgreSQL.
