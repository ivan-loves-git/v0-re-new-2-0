# Repreneur feedback v1

**Authority:** [Product Change #76](https://github.com/re-new-team/renew-governance/issues/76), selected [Decision #78](https://github.com/re-new-team/renew-governance/issues/78), implementation [Ticket #229](https://github.com/re-new-team/renew-governance/issues/229). This is a separate, minimum product-feedback route. It is not M&A evidence, a pursuit action, a support inbox, or the retired PDR feedback table.

## Submission and visibility

Only an authenticated user with current repreneur `PortalAccess` can open `/portal/feedback` and submit. Staff cannot submit on a repreneur's behalf. One general form accepts exactly `category` (`improvement`, `difficulty`, `other`), a trimmed 20–1,000-character `message`, and optional `context` (`portal_deals`, `portal_profile`, `portal_other`). The user chooses the coarse context; the application does not collect the URL, record ID, query, fragment, page title, referrer, file, attachment, NDA, source content, or other hidden page data. The server rejects extra fields and derives Better Auth user ID and linked repreneur ID from current access. The database supplies creation time. A success response contains no feedback ID or content. Repreneurs cannot list or read submissions after sending.

The form calls this non-urgent product feedback and makes no response-time promise. Its urgent-support sentence is: “For urgent access or live-pursuit support, contact the usual Re-New team directly.” No unverified mailbox or SLA is shown.

Only current staff access can read `/tools/feedback`. The queue shows sender name, category, coarse context, message, creation time and triage state. `New` is the insertion default; staff may set `New`, `Routed` or `Closed`. `Routed` means a human has manually triaged the input, not that a GitHub card, staff handoff or customer response exists. Ivan remains accountable for manual collection and triage. There is no notification, outbound message, AI processing, automatic GitHub item or monitoring promise.

## Persistence and authority

Migration `20260929213346_repreneur_feedback.sql` adds only `public.repreneur_feedback`. Both Better Auth `public."user"` and `public.repreneurs` are foreign-key parents with `ON DELETE CASCADE`. Actual auth-user deletion removes the feedback; disabling portal access only prevents future access and does not erase history. No existing row is backfilled or changed.

The table has RLS enabled and forced, no browser policies, and grants only to `service_role`. The server checks current role **before** constructing a service client. The staff-only mutation RPC checks the current staff role again through `w196_staff_role_matches`, locks the exact row, requires the version shown to the staff member, and increments it atomically for state changes or redaction. Stale concurrent edits fail. Redaction removes message text irreversibly while preserving the minimized queue metadata until expiry. Staff deletion removes the whole record. A stale staff action cannot recreate a record removed by cleanup or another staff member.

## Retention

At `created_at + 90 days`, the queue stops returning a submission and the staff mutation RPC refuses further edits. The existing daily `CRON_SECRET`-guarded maintenance route invokes the service-only purge before its reminder subjobs. The purge deletes all expired feedback regardless of status; a failed run is retried at the next daily execution. It never selects or deletes an existing business, PDR, email or other retention record. Staff may redact or delete sooner. The account-delete cascade is independent of the daily purge.

## Verification boundary

Validation and authorization tests use synthetic actors. A disposable PostgreSQL rehearsal applies the migration and checks browser-role denial, service grants, foreign-key cascade, versioned row-lock mutations and the 90-day purge. Browser proof uses synthetic submissions only, at desktop and mobile widths, including form confirmation, staff filters and keyboard/focus. Do not call the existing abandoned-forms cron against production for a feedback test: it also sends reminders.
