---
status: pending
priority: p3
issue_id: "016"
tags: [cleanup, performance, code-review]
dependencies: []
---

# Unused npm Dependencies

## Problem Statement

Several npm packages are installed but never used in the code. They add to install time, bundle size, and potential security vulnerabilities.

**Why it matters (non-technical):** It's like paying for magazine subscriptions you never read. These packages take up space, slow down installs, and could have security issues you don't even know about.

## Findings

**Unused packages in package.json:**
- `embla-carousel-react` - not imported anywhere
- `input-otp` - not imported anywhere
- `react-resizable-panels` - not imported anywhere
- `vaul` - drawer component, not imported
- `react-day-picker` - not imported (using native date inputs)

**Discovery:** code-simplicity-reviewer agent

**Impact:** ~50+ KB bundle size reduction, faster `npm install`

## Proposed Solutions

### Option A: Remove Unused Packages (Recommended)
- **Pros:** Smaller bundle, faster installs, fewer vulnerabilities
- **Cons:** None
- **Effort:** Small (15 min)
- **Risk:** None

## Recommended Action

Remove unused packages

## Technical Details

**Commands to run:**
```bash
npm uninstall embla-carousel-react
npm uninstall input-otp
npm uninstall react-resizable-panels
npm uninstall vaul
npm uninstall react-day-picker
```

**Verify after removal:**
```bash
npm run build
npm run dev  # Test app works
```

## Acceptance Criteria

- [ ] Packages removed from package.json
- [ ] `npm install` completes successfully
- [ ] App builds without errors
- [ ] App runs correctly

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-09 | Created | Identified during simplicity audit |

## Resources

- Code simplicity review from code-simplicity-reviewer agent
