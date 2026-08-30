# Commit Style

GitHub is the permanent source for approved product scope, decisions, delivery status and implementation history. The WAVE PDR owns founder-request intake, AI screening, Ivan's disposition and the historical proposal record; it is not a delivery tracker. Canonical contracts own durable business rules. A commit message should let a non-developer reading it months later understand what changed and why.

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
- Use `/commit` command for the guided process.
- Push the current development branch promptly after committing.
- Do not merge to `main` before `Verify` is green.
- The displayed build number lives in `lib/release-build.mjs`. Nothing validates it; bump it by hand if you want the number in the UI to move.

## Browser testing

- Look at the screens you changed, at desktop and mobile widths.
- Use browser automation where it is quick and useful, especially for a journey that writes data.
- Ask Ivan for physical-device confirmation only when the behaviour genuinely cannot be checked any other way.
