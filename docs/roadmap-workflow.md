# Roadmap Workflow

The in-app roadmap (`/guide/roadmap`) documents milestones for the Re-New team.

## When to update

Proactively add entries after:
- New features (user-facing functionality)
- Important bug fixes (especially "was broken, now works" fixes)
- Architecture decisions (why we chose X over Y)
- Key learnings (gotchas, surprises, things to remember)

## When NOT to update

- Small fixes, typos, config changes
- Refactors with no user-visible impact
- Chores (dependencies, build config)

## How to update

1. Edit `components/guide/development-roadmap.tsx` — add new entry at TOP of `roadmapEvents` array.
2. Update `lib/data/roadmap-status.ts` — set `LAST_ROADMAP_UPDATE` to today's date (triggers red dot notification).
3. Increment version number:
   - Current: **0.7.0** (~70% to 1.0)
   - Increment by 0.0.1 for small updates, 0.1.0 for bigger milestones
   - **1.0.0** = Production launch with real users
4. Commit: `📝 docs(roadmap): add [milestone name]`
5. **Always tell Ivan**: "Roadmap updated with [milestone name] (vX.X.X)" so he knows it was done.

## Entry format

```typescript
{
  period: "Jan 12, 2026",
  version: "0.7.1",
  title: "Milestone Name",
  isCompleted: true,
  events: [
    { title: "Feature name", type: "feature", description: "What it does" },
    { title: "Bug fixed", type: "fix", description: "What was broken, now works" },
    { title: "Decision made", type: "decision", description: "Why we chose this approach" },
  ],
}
```

Event types: `feature`, `fix`, `style`, `refactor`, `decision`, `learning`.

## Roadmap language

Entries must be **founder-friendly**, not developer jargon:
- ❌ "QuestionnaireFormV2 now embedded directly in repreneur profile"
- ✅ "Edit answers directly on profile"
