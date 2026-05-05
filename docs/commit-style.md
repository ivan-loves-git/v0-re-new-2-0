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
- **Always report the build number after push** — read `lib/version.ts` and tell Ivan the build number so he can confirm in the deployed app.

## Browser testing

- **Never test animations** — the browser plugin is too slow to capture them. Always ask Ivan to test animations on his device.
- Push first, then Ivan tests on mobile / actual device.
- Use browser automation only for static content verification or form interactions.
