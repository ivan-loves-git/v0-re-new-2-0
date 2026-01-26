# Phase 04: WHO/WHEN Editors - Research

**Researched:** 2026-01-26
**Confidence:** HIGH

## Summary

Phase 4 adds inline popup editors for WHO (Q05-Q10) and WHEN (Q11-Q16) questions on the repreneur profile page. Admins can correct answers and recalculate scores without using the full questionnaire form.

## Existing Infrastructure (Reuse)

### Scoring Logic
- **File:** `lib/utils/scoring-v2.ts`
- **Functions:** `calculateWhoScore()`, `calculateWhenScore()`, `detectFlags()`, `getRecommendedAction()`
- **Already handles:** Score calculation, flag detection, recommendation logic

### Server Action
- **File:** `lib/actions/repreneur-actions.ts`
- **Function:** `saveQuestionnaireV2(repreneurId, formData)`
- **Already handles:** Save all Q fields + recalculate scores + update flags/recommendation

### Question Config
- **File:** `lib/config/questionnaire-v2.ts`
- **Exports:** `WHO_QUESTIONS`, `WHEN_QUESTIONS` with labels, options, points

### Existing Editor Patterns
- **EditableTextField:** Inline text editing with save/cancel
- **Tier2DimensionRating:** Star picker with optimistic updates
- Both use: hover to reveal edit button, inline editing, toast feedback

## Architecture Decision

**Option A:** Two separate popup dialogs (WHO popup, WHEN popup)
- Pro: Focused editing, smaller dialogs
- Pro: Can open directly from score cards
- Con: Two components to maintain

**Option B:** Single popup with tabs (WHO tab, WHEN tab)
- Pro: Single component
- Con: More complex, user may only need one section

**Recommendation:** Option A - Two separate popups
- Simpler implementation
- Matches UX request (pencil icon on WHO → WHO editor, pencil on WHEN → WHEN editor)
- Can reuse same Dialog pattern

## Component Design

### WhoScoreEditor (popup)
```
┌─────────────────────────────────────┐
│ Edit WHO Score              [×]     │
├─────────────────────────────────────┤
│ Q05: Current Status                 │
│ ○ Entrepreneur (5pts)               │
│ ● Freelance (4pts)                  │
│ ○ Employee (3pts)                   │
│ ...                                 │
├─────────────────────────────────────┤
│ Q06: Years Experience               │
│ ...                                 │
├─────────────────────────────────────┤
│ [Live Preview: WHO = 65/100]        │
├─────────────────────────────────────┤
│ [Cancel]  [Calculate & Save]        │
└─────────────────────────────────────┘
```

### WhenScoreEditor (popup)
```
┌─────────────────────────────────────┐
│ Edit WHEN Score             [×]     │
├─────────────────────────────────────┤
│ Q11: Project Status (select all)    │
│ ☑ Discovery  ☑ Exploratory          │
│ ☐ Framed     ☐ Searching            │
├─────────────────────────────────────┤
│ Q14: Deal Size                      │
│ ☐ 1-3M  ☑ 3-5M  ☐ >5M               │
├─────────────────────────────────────┤
│ Q15: Capital Structure              │
│ ...                                 │
├─────────────────────────────────────┤
│ Q16: Equity Contribution            │
│ ○ TBD  ○ 151-250K  ● 251-350K       │
├─────────────────────────────────────┤
│ [Live Preview: WHEN = 80/100]       │
│ [Flags: F3]                         │
├─────────────────────────────────────┤
│ [Cancel]  [Calculate & Save]        │
└─────────────────────────────────────┘
```

## Database Fields

### WHO (Q05-Q10) - All single-select strings
| Field | Type | Options |
|-------|------|---------|
| q05_status | string | entrepreneur, freelance, employee, transition, other |
| q06_experience | string | more_than_20, 10_to_20, less_than_10 |
| q07_leadership | string | general_management, mgmt_over_10, mgmt_under_10, none |
| q08_crisis | string | multiple, once, none |
| q09_investment | string | both, personal, professional, none |
| q10_impact | string | financial, trajectory, limited, none |

### WHEN (Q11-Q16) - Mix of multi-select and single-select
| Field | Type | Options |
|-------|------|---------|
| q11_project_status | string[] | discovery, exploratory, framed, searching, loi |
| q12_geo_zones | string[] | (informational, no scoring) |
| q13_target_sectors_v2 | string[] | (informational, no scoring) |
| q14_deal_size | string[] | 1-3M, 3-5M, >5M |
| q15_structure | string[] | majority_without_fund, majority_with_minority, manager_with_majority, havent_thought |
| q16_equity | string | tbd, 151-250, 251-350, 351-450, >450 |

## Implementation Plan

1. **Create WhoScoreEditor component**
   - Dialog with RadioGroup for each Q05-Q10
   - Live score preview using `calculateWhoScore()`
   - Save button calls existing `saveQuestionnaireV2()`

2. **Create WhenScoreEditor component**
   - Dialog with CheckboxGroup for Q11, Q14, Q15
   - RadioGroup for Q16
   - Live score preview using `calculateWhenScore()`
   - Flags display using `detectFlags()`

3. **Add pencil icons to Rating Card**
   - WHO score section: pencil → opens WhoScoreEditor
   - WHEN score section: pencil → opens WhenScoreEditor

4. **Reuse existing patterns**
   - Dialog from shadcn/ui (already used elsewhere)
   - Toast feedback (already used)
   - Optimistic updates pattern from Tier2DimensionRating

## Files to Create/Modify

**Create:**
- `components/repreneurs/who-score-editor.tsx`
- `components/repreneurs/when-score-editor.tsx`

**Modify:**
- `app/(dashboard)/repreneurs/[id]/page.tsx` - Add pencil icons to Rating Card

## Pitfalls to Avoid

1. **Don't duplicate scoring logic** - Import from `lib/utils/scoring-v2.ts`
2. **Don't create new server action** - Reuse `saveQuestionnaireV2()`
3. **Don't forget flags** - WHEN editor must show detected flags
4. **Q12/Q13 are informational** - Don't include in WHEN editor (no scoring impact)

## Sources

- `lib/utils/scoring-v2.ts` - Scoring functions
- `lib/config/questionnaire-v2.ts` - Question configuration
- `components/repreneurs/questionnaire-form-v2.tsx` - Existing form pattern
- `components/repreneurs/tier2-dimension-rating.tsx` - Inline editor pattern
