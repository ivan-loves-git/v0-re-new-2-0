---
description: "Creates detailed commits with Task Master context"
allowed-tools: ["Bash(git add:*)", "Bash(git status:*)", "Bash(git commit:*)", "Bash(git diff:*)", "Bash(git log:*)", "Read"]
---

# Commit Command

## Process
1. Check staged files with `git status`
2. Analyze the diff with `git diff --staged`
3. Check current Task Master task with `task-master list` or read `.taskmaster/tasks/tasks.json`
4. Create a commit message linking to the task

## Commit Format
```
<type>(task-<id>): <short description>

## What Changed
- Detailed bullet points of actual changes

## Why
- The reasoning/context behind these changes
- Reference Task Master task: task-<id>

## Files Modified
- List of files with brief notes
```

## Types
- feat: New feature
- fix: Bug fix
- refactor: Code restructuring
- style: Formatting/UI changes
- docs: Documentation
- chore: Build/config changes

## Rules
- First line under 72 characters
- Include Task Master task ID when applicable (task-1, task-2, etc.)
- Include enough context that someone reading later understands WHY, not just WHAT
- DO NOT include "Generated with Claude Code" attribution
- Each commit should be a self-contained story

## Example
```
feat(task-7): Add Tier 2 star rating system for candidates

## What Changed
- Added 5-star rating component to candidate detail page
- Created rating_tier2 column in repreneurs table
- Implemented auto-transition to "Qualified" status when rating is set

## Why
- Bertrand needs to manually assess candidates after interviews
- Star rating triggers pipeline progression (Lead -> Qualified)
- Task Master task: task-7 "Implement Tier 2 scoring system"

## Files Modified
- app/components/StarRating.tsx (new component)
- app/[id]/page.tsx (integrated rating)
- supabase/migrations/004_tier2_rating.sql (schema change)
```
