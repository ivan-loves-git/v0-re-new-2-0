# Todo: Two-Column Questionnaire Layout

**Captured:** 2026-01-26
**Source:** User feedback during test user creation
**Priority:** Medium (UX improvement, not blocking launch)

## Description

The questionnaire form requires too much scrolling on desktop. Add a two-column layout for answer options to reduce vertical space and improve UX.

## Context

- Observed during manual testing of intake-v2 form
- Each step (especially WHO and WHEN sections) has many options displayed vertically
- On desktop screens, this creates excessive scrolling
- Mobile should remain single-column (responsive)

## Suggested Approach

- Use CSS grid or flexbox with `md:grid-cols-2` for option lists
- Apply to radio button groups and checkbox groups in:
  - `components/intake-v2/steps/step-who.tsx`
  - `components/intake-v2/steps/step-when.tsx`
  - `components/intake-v2/steps/step-project.tsx`
  - `components/intake-v2/steps/step-needs.tsx`
- Keep single column on mobile (`grid-cols-1`)

## Acceptance Criteria

- [ ] Options display in 2 columns on desktop (md breakpoint and up)
- [ ] Single column maintained on mobile
- [ ] No horizontal scrolling introduced
- [ ] Form remains functional and accessible
