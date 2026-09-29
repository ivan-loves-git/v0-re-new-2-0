# Compact email review queue — synthetic design reference

[Product Change #221](https://github.com/re-new-team/renew-governance/issues/221) /
[Ticket #222](https://github.com/re-new-team/renew-governance/issues/222).

The approved local prototype supplied the toolbar, compact sortable table,
purpose-tag and page-selection layout direction. The reviewed layout files were
`run-queue.tsx` (SHA-256
`7060baede3ab159bfba336b4b099c1da521938677f4b3188addfdb2aeae825ef`)
and `run-queue-columns.tsx` (SHA-256
`16d253bea242d9040e32f1e8ad56ea8438266968e5ec33260460692bcbc1df73`)
under the 27 September `email-review-prototype`. Its two real-data snapshots
and `src/drafts.ts` were deliberately excluded. No prototype data or
unreviewed ReUI scaffold was copied into the application.

These five screenshots render the actual `ReviewQueue` component in a
localhost-only, temporary synthetic route with `example.invalid` addresses
and fictional names on the released neutral Vega theme baseline
(`8b8be3b78e79df6e3366c87d59e9fea552b8ca0a`). They show desktop/mobile
and light/dark presentation, including the horizontally scrolled mobile
columns. The Prepared column shows the Paris date and hour; hovering its
timestamp retains the full date, minute and second.
The temporary route is removed before commit. The screenshots are a layout
reference, not a production-data, authentication or database-migration claim.

- `queue-desktop-light.png`
- `queue-mobile-light.png`
- `queue-desktop-dark.png`
- `queue-mobile-dark.png`
- `queue-mobile-columns-dark.png`

The production queue uses the existing Radix/shadcn controls and the
service-role-only canonical projection in migration 130. E6 company remains
unrecorded, and the real detail page retains source evidence, edits,
attachments, exact freshness replies and current send gates.
