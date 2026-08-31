# How we build and release

**Status:** Canonical. Replaces the tiered QA lane retired on 2026-08-24.

## Standing authority

D-GOV-004 and GitHub Decision #70 establish the normal delivery authority. A
Product Change may proceed without a fresh Ivan approval when its scope
authority is recorded, it and its unblocked Ticket are both `Ready` and
`ready-for-agent`, and neither record asks for a narrower checkpoint. This
authorises the complete routine loop below: build, test, pull request, merge,
automatic deployment, live verification, GitHub closure, and one standard
Slack product-update-card message after live proof.

The issue wording wins if it is narrower. Stop only for a new material product,
operating, data, security, or commercial decision; a scope contradiction or
expansion; unsafe verification or rollback; secret, credential, billing, or
unapproved real-account access; an authoritative-source conflict; or failed
verification or a production incident. A known risk that the approved issue
already specifies and makes testable is not a new approval gate.

## Controlled parallelism

There may be at most two active application-code lanes. The supervisor records
the shared `origin/main` baseline, ownership and Ticket for each lane before
work starts. Each lane uses a separate clean worktree and branch. The lanes
must be proven independent: no shared route, component, server action, data
model, migration, package/configuration file, shared test fixture,
authorization or visibility rule, external integration, or production-data
surface. If independence is not obvious, use one lane.

Read-only research and review may run alongside coding but may not edit a
worktree, create a branch, or advance GitHub delivery state. One supervisor
owns GitHub state, integration, merges, releases and production proof. Merges
and releases are always serial. If `origin/main` advances, a worktree is dirty
without explanation, or an overlap is discovered, stop the affected lane;
reconcile it against current `main` and rerun the affected verification before
integration.

## The routine loop

1. Work in an eligible isolated lane from the recorded current `origin/main`.
2. Implement the assigned Ticket only.
3. Run `pnpm verify` (lint, typecheck, tests, build). Fix what it reports.
4. Open a pull request. `Verify` runs in CI and must be green.
5. The supervisor rechecks `origin/main`, serially merges the verified PR, and
   lets Vercel deploy that `main` commit automatically.
6. Check the change works in production, close the completed GitHub records,
   send the standard Slack product-update-card message, and report the result
   in plain language.

That is the whole process. There are no risk tiers, no QA lease, no synthetic
fixture programme, no evidence packets, and no build-number ceremony.

## Tests

Add or update tests in `lib/**/__tests__/` when you change behaviour. Match the
existing style. Do not write tests that assert the contents of workflow files,
package scripts, or config JSON — that coupling breaks on every edit and catches
no real defect.

## Exceptions and communication

Do not add a routine approval checkpoint before merging or releasing a
standing-authority item. Pause only for the exceptions in **Standing
authority** or when the governing GitHub record explicitly requires a decision
or human gate.

The standard Slack product-update-card message is part of routine completion:
one concise update per delivered Product Change in `#product-updates-stream`,
containing the user-visible result and the GitHub card link. It must not
introduce a new commitment, disclose secrets or private data, or claim success
before live proof. The final sprint recap reproduces the exact sent message and
link. A Slack delivery failure is recorded and reported, but never changes
delivery truth or causes a rollback.

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
