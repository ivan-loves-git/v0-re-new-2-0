---
status: pending
priority: p3
issue_id: "015"
tags: [cleanup, code-review]
dependencies: []
---

# Dead Code - Unused Dashboard Versions

## Problem Statement

There are 4 old dashboard versions that are not used anywhere. They add maintenance burden and confusion about which code is "live."

**Why it matters (non-technical):** It's like having 4 drafts of a document mixed in with the final version. Someone might accidentally edit the wrong one, or waste time trying to understand code that's not even used. Deleting them makes the codebase cleaner and easier to work with.

## Findings

**Location:**
- `app/(dashboard)/dashboard-v1/page.tsx` (118 lines)
- `app/(dashboard)/dashboard-v2/page.tsx` (118 lines)
- `app/(dashboard)/dashboard-v3/page.tsx` (145 lines)
- `app/(dashboard)/dashboard-full/page.tsx` (172 lines)

**Also unused:**
- `app/(dashboard)/development/page.tsx` (599 lines) - confetti test page
- `app/(dashboard)/learnings-test/page.tsx` - YAGNI feature
- `components/learnings/swipe-course-selector.tsx` (545 lines)
- `components/sidebar.tsx` (182 lines) - replaced by app-sidebar
- `components/header.tsx` (51 lines) - not imported anywhere
- `components/dashboard/top-scored-repreneurs.tsx` (85 lines)
- `components/dashboard/activity-comparison.tsx` (80 lines)
- `components/dashboard/stale-repreneurs-alert.tsx` (76 lines)

**Discovery:** code-simplicity-reviewer agent

**Total LOC to remove:** ~3,000 lines (~10% of codebase)

## Proposed Solutions

### Option A: Delete All Dead Code (Recommended)
- **Pros:** Cleaner codebase, easier to maintain
- **Cons:** Can't undo (but it's in git history)
- **Effort:** Small (30 min)
- **Risk:** None (code is unused)

## Recommended Action

Delete in phases, verifying nothing breaks between each phase.

## Technical Details

**Phase 1: Delete unused dashboard versions**
```bash
rm -rf app/(dashboard)/dashboard-v1
rm -rf app/(dashboard)/dashboard-v2
rm -rf app/(dashboard)/dashboard-v3
rm -rf app/(dashboard)/dashboard-full
```

**Phase 2: Delete unused features**
```bash
rm -rf app/(dashboard)/development
rm -rf app/(dashboard)/learnings-test
rm -rf components/learnings
```

**Phase 3: Delete unused components**
```bash
rm components/sidebar.tsx
rm components/header.tsx
rm components/dashboard/top-scored-repreneurs.tsx
rm components/dashboard/activity-comparison.tsx
rm components/dashboard/stale-repreneurs-alert.tsx
```

**Phase 4: Update navigation**
- Remove links to deleted pages from sidebar navigation
- Remove development/learnings from menu items

## Acceptance Criteria

- [ ] All unused files deleted
- [ ] App builds without errors
- [ ] No broken links in navigation
- [ ] No import errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during simplicity audit |

## Resources

- Code simplicity review from code-simplicity-reviewer agent
