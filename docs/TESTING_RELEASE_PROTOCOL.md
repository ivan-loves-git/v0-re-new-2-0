# How we build and release

**Status:** Canonical. Replaces the tiered QA lane retired on 2026-08-24.

## The loop

1. Work on a branch off current `origin/main`.
2. Implement the change once.
3. Run `pnpm verify` (lint, typecheck, tests, build). Fix what it reports.
4. Open a pull request. `Verify` runs in CI and must be green.
5. Merge when it is green. Vercel deploys `main` automatically.
6. Check the change works in production, and say so in plain language.

That is the whole process. There are no risk tiers, no QA lease, no synthetic
fixture programme, no evidence packets, and no build-number ceremony.

## Tests

Add or update tests in `lib/**/__tests__/` when you change behaviour. Match the
existing style. Do not write tests that assert the contents of workflow files,
package scripts, or config JSON — that coupling breaks on every edit and catches
no real defect.

## When to stop and ask Ivan

Ask before merging when the change touches authentication, permissions, who can
see what, the data model, a database migration, anything destructive, or real
customer data. Say what could go wrong and how to undo it. Everything else:
just ship it.

Publishing to production is covered by a normal request to build something.
These always need their own explicit go-ahead: production data changes,
migrations and backfills, credential or billing changes, and messages to
anyone outside the team.

## Credentials

Secrets load only from the approved local source, the GitHub environment, or
provider project settings. Never put a secret value or bearer URL in a tracked
file, commit, pull request, log, screenshot, or chat. Do not stop at a login
wall before checking the approved secret source, and do not ask Ivan to paste
credentials into a conversation.

## Reporting

Tell Ivan what users can now do, whether it is shipped or blocked, and the one
decision you need from him if there is one. Keep PR numbers, SHAs and CI links
out of it unless he asks.
