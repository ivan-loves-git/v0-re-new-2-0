# Commit Style

GitHub is the permanent source for implementation history. The PDR owns product scope and status, and canonical contracts own durable business rules. Every commit must still tell a complete technical story so a non-developer reading the history months later understands the change without asking.

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
- Push the current development branch promptly after committing. Do not merge or push a release to `main` before its required checks, QA, review, and publication authority.
- **Prepare the release build number before creating a production commit** — run `pnpm release:prepare-build-number` while `HEAD` is the last release. It advances the committed `lib/release-build.mjs` sequence for the one commit about to be made. On the first adoption only, it creates the exact `766` bootstrap from full-history commit `765`; any other missing-file state is rejected. Include that file in the production commit, then run `pnpm release:check-build-number` after committing; it accepts only an exact match, or the one-number-ahead state before that one commit. `pnpm build` runs the same check automatically.
- Keep the build number, commit SHA, PR, and workflow runs in the technical evidence. Put them in Ivan's default report only when they explain a blocker or he asks for them. The number is deliberately stored in `lib/release-build.mjs`, rather than calculated by Vercel: a shallow deployment checkout must never display its local history depth as the release number. A shallow production build checks that its number is strictly greater than its parent; only build 766 can bootstrap when the parent predates this file.

## Browser testing

- Follow the risk tier and QA-to-production ladder in `TESTING_RELEASE_PROTOCOL.md`.
- Tier 2 and Tier 3 candidates are browser-tested in the isolated QA environment before merge, then verified in production after the exact approved code is deployed.
- Use browser automation for the relevant observable journey, including persistence and cleanup when the feature writes data.
- Ask Ivan for physical-device confirmation only when the acceptance criterion genuinely cannot be proven with available automation, such as hardware-specific behaviour. Record it as a human gate rather than completed evidence.
