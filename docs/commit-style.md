# Commit Style

GitHub is the project's memory. Every commit must tell a complete story so a non-developer reading the history months later understands the journey without asking.

## When to commit

- After completing a phase or plan
- After any meaningful change (even mid-task if significant)
- Before switching to a different task

## Format

```
<type>: <short description>

## What Changed
- Detailed bullet points of actual changes

## Why
- The reasoning/context behind these changes

## Files Modified
- List of files with brief notes
```

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
- **Always push immediately after committing** — Ivan prefers commit + push as one action.
- **Prepare the release build number before creating a production commit** — run `pnpm release:prepare-build-number` while `HEAD` is the last release. It advances the committed `lib/release-build.mjs` sequence for the one commit about to be made. On the first adoption only, it creates the exact `766` bootstrap from full-history commit `765`; any other missing-file state is rejected. Include that file in the production commit, then run `pnpm release:check-build-number` after committing; it accepts only an exact match, or the one-number-ahead state before that one commit. `pnpm build` runs the same check automatically.
- **Always report the build number after push** — read `lib/release-build.mjs` and tell Ivan the number so he can confirm in the deployed app. The number is deliberately stored there, rather than calculated by Vercel: a shallow deployment checkout must never display its local history depth as the release number. A shallow production build checks that its number is strictly greater than its parent; only build 766 can bootstrap when the parent predates this file.

## Browser testing

- **Never test animations** — the browser plugin is too slow to capture them. Always ask Ivan to test animations on his device.
- Push first, then Ivan tests on mobile / actual device.
- Use browser automation only for static content verification or form interactions.
