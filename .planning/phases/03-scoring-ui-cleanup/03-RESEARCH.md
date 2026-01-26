# Phase 3: Scoring UI Cleanup — Research

**Researcher:** GSD Phase Research Agent
**Date:** 2026-01-26
**Status:** Complete

---

## Research Question

What do I need to know to PLAN Phase 3 (Scoring UI Cleanup) well?

---

## Executive Summary

Phase 3 removes legacy Tier 1 scoring UI elements to create a clean slate for the new WHO/WHEN inline editors (Phase 4). Two components need removal:

1. **Pencil icon** in Rating card header (`Tier1InlineEditor`) — SCORE-01
2. **Large questionnaire form** below profile (`QuestionnaireForm`) — SCORE-02

Both are "legacy v1" components that opened the old 17-question Tier 1 questionnaire. The new system uses:
- **QuestionnaireFormV2** (already on page) — dual scoring WHO/WHEN
- WHO/WHEN score display (already exists, no editing) — interim state until Phase 4 adds inline editors

**Risk:** Low. Both components are self-contained. No other code depends on them.

---

## Current State Analysis

### 1. Pencil Icon (Tier1InlineEditor)

**Location:** `components/repreneurs/tier1-inline-editor.tsx`

**Where used:** `app/(dashboard)/repreneurs/[id]/page.tsx` line 341

```tsx
<CardTitle className="flex items-center gap-2">
  <Star className="h-5 w-5" />
  Rating
  <TooltipProvider>...</TooltipProvider>
  {/* Edit button for legacy Tier 1 questionnaire */}
  <Tier1InlineEditor repreneur={repreneur as Repreneur} />
</CardTitle>
```

**What it does:**
- Opens a modal with 15 legacy Tier 1 questions (Q1-Q17, excluding Q7 and Q13)
- Uses compact mini-form (selects, switches, multi-selects)
- Calls `updateTier1Answers()` action on save
- Recalculates legacy `tier1_score` (not WHO/WHEN)

**Dependencies:**
- Uses `lib/actions/repreneurs.ts::updateTier1Answers()`
- Uses `lib/utils/tier1-scoring.ts` constants (EMPLOYMENT_STATUS_OPTIONS, etc.)
- Server action still exists and is used elsewhere (may be called from intake v1)

**Impact of removal:**
- ✅ No other components import `Tier1InlineEditor`
- ✅ Profile page displays WHO/WHEN scores (already separate logic)
- ✅ `updateTier1Answers()` server action can remain (may have other callers)
- ⚠️ Admin loses ability to edit legacy Tier 1 answers (acceptable — v2 is the new path)

---

### 2. Large Questionnaire Copy (QuestionnaireFormV2 vs QuestionnaireForm)

**CRITICAL FINDING:** There are TWO questionnaire components on the profile page:

1. **QuestionnaireFormV2** (line 533) — This is the NEW dual scoring form (WHO/WHEN)
2. **QuestionnaireForm** (NOT currently imported) — Legacy v1 form

**Current imports in page.tsx:**
```tsx
import { Tier1InlineEditor } from "@/components/repreneurs/tier1-inline-editor"
import { QuestionnaireFormV2 } from "@/components/repreneurs/questionnaire-form-v2"
```

**VERIFICATION NEEDED:** The page currently only shows `QuestionnaireFormV2`. Let me check if there's a legacy questionnaire section being rendered...

After reviewing the profile page code:
- **Line 533:** `<QuestionnaireFormV2 repreneur={repreneur as Repreneur} />` ✅ This is the NEW form
- **Lines 595-723:** "Questionnaire Details" read-only section (NOT a card, just plain text fields)

**What SCORE-02 actually refers to:**

Looking at the profile page structure, the "big questionnaire copy section" is likely the **read-only details section** (lines 595-723):

```tsx
{/* ROW 3: Questionnaire Details (no cards, blank bg, 3-col list) */}
<div className="pt-6 border-t">
  <h3 className="text-sm font-medium text-gray-500 mb-4">Questionnaire Details</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-3">
    <div>
      <Label className="text-xs text-gray-500">Employment Status</Label>
      <p className="text-sm">{repreneur.q1_employment_status || ...}</p>
    </div>
    <!-- ... 15 more legacy fields ... -->
  </div>
</div>
```

This section displays:
- Q1-Q17 legacy answers (read-only)
- 3-column grid layout
- No cards, just plain text display
- Not collapsible
- No editing capability

**Purpose:** Shows legacy questionnaire data from old Tier 1 system. With v2 dual scoring, this becomes redundant because:
- WHO/WHEN parameters are in QuestionnaireFormV2
- Legacy data is visible in QuestionnaireFormV2's "Legacy Data Section" (collapsible)

---

## Component Inventory

### Components to Remove

| Component | File Path | Line in page.tsx | Purpose |
|-----------|-----------|------------------|---------|
| `Tier1InlineEditor` | `components/repreneurs/tier1-inline-editor.tsx` | 341 | Pencil icon that opens legacy Tier 1 editor modal |
| Questionnaire Details Section | N/A (inline JSX) | 595-723 | Read-only display of legacy Q1-Q17 answers |

### Components to Keep

| Component | File Path | Line in page.tsx | Purpose |
|-----------|-----------|------------------|---------|
| `QuestionnaireFormV2` | `components/repreneurs/questionnaire-form-v2.tsx` | 533 | NEW dual scoring form (WHO + WHEN) |
| WHO/WHEN score display | Inline JSX in Rating card | 377-428 | Shows `who_score` and `when_score` (no editing) |

---

## Removal Strategy

### SCORE-01: Remove Pencil Icon

**File:** `app/(dashboard)/repreneurs/[id]/page.tsx`

**Action:** Remove line 341:
```tsx
<Tier1InlineEditor repreneur={repreneur as Repreneur} />
```

**Also remove import (line 29):**
```tsx
import { Tier1InlineEditor } from "@/components/repreneurs/tier1-inline-editor"
```

**Keep the file:** `components/repreneurs/tier1-inline-editor.tsx` exists but is no longer used from profile page. May be used elsewhere (intake v1?). Archive later if confirmed unused.

---

### SCORE-02: Remove Questionnaire Details Section

**File:** `app/(dashboard)/repreneurs/[id]/page.tsx`

**Action:** Delete lines 595-723 (entire `<div className="pt-6 border-t">` block)

**What's removed:**
- Section title "Questionnaire Details"
- 3-column grid with 16 legacy fields:
  - Employment Status (q1)
  - Prior M&A Experience (q4)
  - Years of Experience (q2)
  - Involved in M&A (q6)
  - Team Management (q5)
  - M&A Details (q7)
  - Executive Roles (q8)
  - Industry Sectors (q3)
  - Board Experience (q9)
  - Journey Stages (q10)
  - Identified Targets (q12)
  - Target Details (q13)
  - Funding Status (q15)
  - Network & Training (q16)
  - Open to Co-acquisition (q17)
  - Background Notes (company_background)
  - Source (editable dropdown)

**Impact:** Legacy data still accessible via QuestionnaireFormV2's collapsible "Legacy Data Section" (lines 462-508 in questionnaire-form-v2.tsx).

---

## What Remains After Cleanup

### Profile Page Structure (Post-Phase 3)

1. **Header** — Name, contact, status, journey stage
2. **Row 1: Overview Cards**
   - Rating Card (WHO/WHEN scores, Tier 2 dimensions) — **READ-ONLY** until Phase 4
   - Investment Profile
   - Radar Chart
3. **QuestionnaireFormV2** — Dual scoring form (WHO + WHEN editing)
4. **Row 2: Milestones & Documents**
5. **Row 3: Activity, Notes, Offers**

**No more:**
- ❌ Pencil icon in Rating card header
- ❌ Large "Questionnaire Details" read-only section

---

## Dependencies & Risks

### Server Actions (Keep Untouched)

| Action | File | Still Needed? |
|--------|------|---------------|
| `updateTier1Answers()` | `lib/actions/repreneurs.ts` | Unknown — may be used by intake v1 or other admin flows |
| `saveQuestionnaire()` | `lib/actions/repreneurs.ts` | Unknown — legacy v1 intake |
| `saveQuestionnaireV2()` | `lib/actions/repreneurs.ts` | ✅ YES — used by QuestionnaireFormV2 |

**Recommendation:** Keep all server actions. Only remove UI components. Backend cleanup can happen later after confirming no callers.

---

### Imports to Remove from page.tsx

**Before:**
```tsx
import { Tier1InlineEditor } from "@/components/repreneurs/tier1-inline-editor"
import { QuestionnaireFormV2 } from "@/components/repreneurs/questionnaire-form-v2"
```

**After:**
```tsx
// Removed: Tier1InlineEditor (SCORE-01)
import { QuestionnaireFormV2 } from "@/components/repreneurs/questionnaire-form-v2"
```

---

## Visual Impact

### Before (Current State)

**Rating Card Header:**
```
⭐ Rating ℹ️ [PENCIL ICON] | Recommendation Badge | Flags
```

**Below Profile:**
```
[ QuestionnaireFormV2 Card ]

--- Questionnaire Details ---
Employment Status: ...
Prior M&A Experience: ...
[... 14 more fields ...]
```

### After Phase 3

**Rating Card Header:**
```
⭐ Rating ℹ️ | Recommendation Badge | Flags
```
(No pencil — scores visible but not editable until Phase 4)

**Below Profile:**
```
[ QuestionnaireFormV2 Card ]

[End of page — cleaner, less clutter]
```

---

## Testing Checklist

After removal, verify:

1. ✅ Profile page loads without errors
2. ✅ WHO/WHEN scores still display in Rating card
3. ✅ Recommendation badge still shows
4. ✅ Flags still display if present
5. ✅ QuestionnaireFormV2 still works (can edit and save)
6. ✅ Legacy data still visible in QuestionnaireFormV2's collapsible section
7. ✅ No console errors related to missing components
8. ✅ Tier 2 dimensions still editable
9. ✅ Investment Profile fields still editable
10. ✅ No visual layout breakage

---

## Open Questions

1. **Is `Tier1InlineEditor` used anywhere else?**
   - Check: Intake v1 page, admin panels, other flows
   - Action: Search codebase for imports before deleting the file

2. **Is `updateTier1Answers()` called from other locations?**
   - Check: Grep for function calls
   - Action: Keep action for now, only remove UI usage

3. **Should legacy questionnaire data remain in QuestionnaireFormV2?**
   - Current: Shows in collapsible "Legacy Data Section"
   - Question: Is this sufficient, or do admins need the old 3-column view?
   - Recommendation: Keep collapsible section — same data, cleaner presentation

---

## Recommendation for PLAN.md

**Approach:**
1. Simple removal — no logic changes, just delete UI elements
2. Keep server actions intact (may have other callers)
3. Keep component files (may be used elsewhere)
4. Only remove from profile page

**Complexity:** Low (2-3 edits in one file)

**Testing:** Visual inspection + functionality check

**Gotchas:**
- Ensure QuestionnaireFormV2's legacy section still works
- Confirm no TypeScript errors after import removal
- Check for unused imports (Lucide icons, etc.)

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/(dashboard)/repreneurs/[id]/page.tsx` | Remove `Tier1InlineEditor` import and usage (line 29, 341)<br>Delete "Questionnaire Details" section (lines 595-723) |

**Total modifications:** 1 file, ~130 lines removed

---

## Related Documentation

- **Requirements:** `.planning/REQUIREMENTS.md` (SCORE-01, SCORE-02)
- **Component:** `components/repreneurs/tier1-inline-editor.tsx` (not deleted, just unused)
- **Component:** `components/repreneurs/questionnaire-form-v2.tsx` (legacy section preserved)
- **Actions:** `lib/actions/repreneurs.ts` (updateTier1Answers, saveQuestionnaireV2)

---

**Research complete.** Ready for PLAN.md creation.
