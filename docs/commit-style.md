# Commit Style

GitHub is the permanent source for approved product scope, decisions, delivery status and implementation history. Historical PDR references remain provenance under Decision #210. Canonical contracts own durable business rules. A commit message should let a non-developer reading it months later understand what changed and why.

## When to commit

- After completing a phase or plan
- After any meaningful change (even mid-task if significant)
- Before switching to a different task

## Format

```
<type>: <short description>

Why this change, and anything a reader could not guess from the diff.
```

Use a longer body when the change is subtle or has consequences. A one-line
message is fine for an obvious change. The diff already lists the files, so do
not restate them.

## Types

- **feat:** new feature
- **fix:** bug fix
- **refactor:** code restructuring
- **style:** formatting / UI changes
- **docs:** documentation
- **chore:** build / config changes

## Rules

- First line under 72 characters.
- Include enough context that someone reading later understands WHY, not just WHAT.
- NO "Generated with Claude Code" attribution.
- `pnpm commit:check <message-file>` checks these mechanical rules. `pnpm commit:check --range <base>..<head>` checks authored commits introduced by a candidate; actual Git merge commits are excluded and earlier history is unchanged. The existing Verify workflow checks that range. It does not judge whether the explanation is useful.
- `pnpm hooks:install` installs the repository-local commit-message and pre-push checks. It refuses to replace an existing different hooks path or active default hooks. This is an explicit local setup step, not a global Git change.
- Publish the development branch under the governing Ticket’s authority. A branch or review candidate is not permission to merge or release.
- Do not merge to `main` before `Verify` is green.
- The displayed build number lives in `lib/release-build.mjs`. Nothing validates it; bump it by hand if you want the number in the UI to move.

## Browser testing

- Look at the screens you changed, at desktop and mobile widths.
- Use browser automation where it is quick and useful, especially for a journey that writes data.
- Ask Ivan for physical-device confirmation only when the behaviour genuinely cannot be checked any other way.
