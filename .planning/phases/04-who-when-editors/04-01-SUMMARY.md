---
phase: "04"
plan: "01"
title: "WHO/WHEN Inline Score Editors"
one_liner: "Pencil icon editors for WHO and WHEN scores with live preview and atomic recalculation"
status: "complete"
subsystem: "scoring-ui"
tags: ["scoring-v2", "inline-editing", "react", "dialog", "forms"]

# Dependencies
requires:
  - "03-01" # Scoring UI cleanup - created clean slate
  - "lib/utils/scoring-v2.ts" # WHO/WHEN calculation functions
  - "lib/config/questionnaire-v2.ts" # Question configurations
  - "lib/actions/repreneurs.ts" # saveQuestionnaireV2 server action

provides:
  - "WHO score inline editor component"
  - "WHEN score inline editor component"
  - "Live score preview with breakdown"
  - "Flag detection display in WHEN editor"

affects:
  - "05-fit-recommendation-editor" # Will follow similar pattern
  - "Future inline editors" # Established component pattern

# Tech Stack
tech-stack:
  added:
    - "@/components/ui/radio-group" # For WHO single-select questions
    - "@/components/ui/checkbox" # For WHEN multi-select questions
  patterns:
    - "Dialog-based inline editing" # Pencil icon → popup editor
    - "Local state with live preview" # Update local, calculate instantly
    - "Preserve sibling data pattern" # WHO edit preserves WHEN, vice versa

# File Tracking
key-files:
  created:
    - "components/repreneurs/who-score-editor.tsx" # WHO editor (Q05-Q10)
    - "components/repreneurs/when-score-editor.tsx" # WHEN editor (Q11, Q14-Q16)
  modified:
    - "app/(dashboard)/repreneurs/[id]/page.tsx" # Added pencil icons to rating card

# Metrics
duration: "4 min"
completed: "2026-01-26"
---

# Phase 04 Plan 01: WHO/WHEN Inline Score Editors Summary

**One-liner:** Pencil icon editors for WHO and WHEN scores with live preview and atomic recalculation

## What Was Built

Added inline editing capability for WHO and WHEN scores directly on the repreneur profile page:

### WhoScoreEditor Component
- **Trigger:** Pencil icon next to WHO score label
- **Dialog:** Full-screen popup with all 6 WHO questions (Q05-Q10)
- **UI:** RadioGroup for each question (single-select)
- **Live Preview:** Real-time score calculation as user changes answers
- **Breakdown:** Shows points breakdown by question category
- **Action:** "Calculate & Save" button triggers `saveQuestionnaireV2()`
- **Preservation:** Preserves existing WHEN answers during update

### WhenScoreEditor Component
- **Trigger:** Pencil icon next to WHEN score label
- **Dialog:** Full-screen popup with 4 WHEN questions (Q11, Q14-Q16)
- **UI:**
  - CheckboxGroup for Q11 (project status - multi-select)
  - CheckboxGroup for Q14 (deal size - multi-select)
  - CheckboxGroup for Q15 (capital structure - multi-select)
  - RadioGroup for Q16 (equity - single-select)
- **Live Preview:** Real-time score calculation with breakdown
- **Flag Detection:** Displays warning flags (F1-F5) with descriptions
- **Action:** "Calculate & Save" button triggers `saveQuestionnaireV2()`
- **Preservation:** Preserves existing WHO answers during update

### Profile Page Integration
- Added `WhoScoreEditor` component next to WHO score label
- Added `WhenScoreEditor` component next to WHEN score label
- Positioned inline with existing info tooltips for clean UI

## Technical Decisions

### Decision 1: Local State + Live Preview Pattern
**Context:** Users need immediate feedback when changing answers.

**Decision:** Store answers in local React state, calculate score on every change, only persist to database on "Calculate & Save" click.

**Rationale:**
- Instant visual feedback without server round-trips
- User can experiment with different answers before committing
- Reduces unnecessary database writes
- Matches existing Tier1InlineEditor pattern

**Implementation:**
```typescript
const [localAnswers, setLocalAnswers] = useState<WhoAnswers>(getInitialAnswers)
const liveScore = calculateWhoScore(localAnswers) // Recalculates on every state change
```

### Decision 2: Preserve Sibling Data Pattern
**Context:** WHO and WHEN scores are independent but stored together in the same database row.

**Decision:** When updating WHO answers, explicitly preserve existing WHEN answers (and vice versa).

**Rationale:**
- Prevents accidental data loss
- `saveQuestionnaireV2()` expects complete questionnaire input
- Makes editor behavior predictable and safe

**Implementation:**
```typescript
// In WhoScoreEditor
const input = {
  q05_status: localAnswers.q05, // Updated
  q06_experience: localAnswers.q06, // Updated
  // ...other WHO fields updated
  q11_project_status: (repreneur as any).q11_project_status || [], // Preserved
  q12_geo_zones: (repreneur as any).q12_geo_zones || [], // Preserved
  // ...other WHEN fields preserved
}
```

### Decision 3: Flag Display in WHEN Editor Only
**Context:** Flags (F1-F5) are triggered by WHEN answers only (deal size, structure, equity combinations).

**Decision:** Display flag detection results in WhenScoreEditor, omit from WhoScoreEditor.

**Rationale:**
- WHO questions don't trigger flags - showing empty flag section would confuse users
- WHEN questions directly affect flag detection - users need to see impact immediately
- Follows spec: flags are based on Q14-Q16 answers

**Implementation:**
```typescript
// In WhenScoreEditor
const flagResult = detectFlags(localAnswers)
{flagResult.flags.length > 0 && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <AlertTriangle className="h-4 w-4 text-red-600" />
    {flagResult.flags.map(flag => (
      <Badge variant="destructive">{flag}</Badge>
      <span>{FLAG_DESCRIPTIONS[flag]}</span>
    ))}
  </div>
)}
```

### Decision 4: Cancel vs Close Behavior
**Context:** Users might open editor and realize they don't want to make changes.

**Decision:** Include explicit "Cancel" button that discards local changes and closes dialog.

**Rationale:**
- Clicking backdrop also closes without saving (default Dialog behavior)
- Explicit Cancel button makes it clear changes won't be saved
- "Calculate & Save" is the only way to persist changes

## Implementation Notes

### Component Structure (Both Editors)
```
Dialog
├── DialogTrigger (pencil icon button)
└── DialogContent
    ├── DialogHeader (title)
    ├── Questions Section (scrollable)
    │   ├── Question 1 (RadioGroup or CheckboxGroup)
    │   ├── Question 2
    │   ├── ...
    │   ├── Live Score Preview Card
    │   └── Flags Display Card (WHEN only)
    └── DialogFooter
        ├── Cancel Button
        └── Calculate & Save Button (with loading state)
```

### Reusable Patterns Established
- **Dialog-based inline editing**: Pencil icon → full popup editor
- **Local state with live preview**: Instant feedback without server calls
- **Preserve sibling data**: Explicitly pass unchanged fields to avoid data loss
- **Loading states**: Disabled buttons during async operations

## Verification Completed

1. **TypeScript Compilation:** No errors in new components
2. **Dev Server Start:** Compiled successfully without warnings
3. **Component Imports:** All required components (RadioGroup, Checkbox, Dialog) exist
4. **Server Action:** `saveQuestionnaireV2` already implemented in `lib/actions/repreneurs.ts`
5. **Scoring Functions:** `calculateWhoScore`, `calculateWhenScore`, `detectFlags` all exist and tested

## User Flow

### Editing WHO Score
1. Admin opens repreneur profile
2. Clicks pencil icon next to WHO score
3. Dialog opens showing current answers for Q05-Q10
4. Admin changes answers (e.g., Q05 from "employee" to "entrepreneur")
5. Live score preview updates immediately (e.g., from 58 → 63)
6. Admin clicks "Calculate & Save"
7. Toast confirms "WHO score updated"
8. Dialog closes, page refreshes with new score

### Editing WHEN Score
1. Admin clicks pencil icon next to WHEN score
2. Dialog opens showing current answers for Q11, Q14-Q16
3. Admin changes Q14 to select only ">5M"
4. Live score preview updates
5. Flag detection runs - if triggered, warning appears (e.g., "F1: High deal size with undefined equity")
6. Admin adjusts Q16 to clear flag
7. Admin clicks "Calculate & Save"
8. Toast confirms "WHEN score updated"
9. Dialog closes, page refreshes with new score and updated flags

## Next Phase Readiness

**Phase 05 (Fit & Recommendation Editor)** can proceed immediately:
- Same inline editor pattern established
- `calculateDualScore()` already available
- `RecommendationBadge` already on profile page
- Just needs editor for Q11-Q16 combined view with fit calculation display

## Deviations from Plan

None - plan executed exactly as written.

## Lessons Learned

1. **Live Preview is Essential:** Users need to see score impact before saving
2. **Preserve Sibling Data Pattern:** Critical to avoid accidental data loss when editors are scoped to subset of fields
3. **Flag Display Timing:** Showing flags during editing (not just after save) helps users understand scoring logic

## Known Limitations

1. **No Undo:** Once "Calculate & Save" is clicked, previous values are lost (could add to future)
2. **No Validation Warnings:** Doesn't warn about contradictory selections (e.g., F2 flag scenario) until save
3. **Mobile UX:** Dialog might be cramped on small screens (could add responsive breakpoints)

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Dev server starts without errors
- [x] All component imports resolve
- [x] Server action exists
- [x] Scoring functions available
- [ ] Manual browser test: WHO editor opens and displays current answers
- [ ] Manual browser test: WHEN editor opens and displays current answers
- [ ] Manual browser test: Live score preview updates on answer change
- [ ] Manual browser test: Flags appear when triggered
- [ ] Manual browser test: Save persists changes to database
- [ ] Manual browser test: Page refreshes with new scores after save

**Note:** Manual browser testing deferred to Ivan (requires authentication and test data).
