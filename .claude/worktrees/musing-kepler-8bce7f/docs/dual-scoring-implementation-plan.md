# Dual Scoring (WHO/WHEN) Implementation Plan

**Goal:** Replace single T1 score (0-98) with dual scoring system (WHO 0-100 + WHEN 0-100)
**Spec:** See `questionnaire-spec-v2.md`
**Status:** Planning

---

## Phase 0: Preparation & Cleanup

### 0.1 Archive Old Intake Experiments
**Files to move to `_archive/`:**
- `/app/intake/` → `_archive/intake-v1/`
- `/app/intake-v2/` → `_archive/intake-v2/`
- `/components/intake/` → `_archive/components-intake-v1/`
- `/components/intake-v2/` → `_archive/components-intake-v2/`

### 0.2 Remove Admin Question Editor
**Files to delete:**
- `/components/guide/tier1-criteria-editor.tsx`
- `/components/guide/criteria-question-card.tsx` (if exists)
- Remove "Evaluation Criteria" link from Guide navigation

**Why:** Questions are now fixed per spec. No more dynamic editing needed.

### 0.3 Database Migration Planning
**New columns needed in `repreneurs` table:**
```sql
-- New dual scores
who_score INTEGER,           -- 0-100
when_score INTEGER,          -- 0-100
who_score_breakdown JSONB,   -- {q05: 5, q06: 15, ...}
when_score_breakdown JSONB,  -- {fit: 40, clarity: 40, project_status: 20}
active_flags TEXT[],         -- ['F1', 'F3']
recommended_action TEXT,     -- 'deal_flow', 'interview', 'starter_pack'

-- New questionnaire fields (Q11-Q18 from spec)
q11_project_status TEXT,
q12_geographic_zones JSONB,
q13_target_sectors_v2 JSONB,  -- Different from existing q11_target_sectors
q14_deal_size JSONB,          -- Multi-select
q15_capital_structure JSONB,  -- Multi-select
q16_equity_contribution TEXT,
q17_current_needs JSONB,
q18_investment_thesis_url TEXT
```

**Migration strategy:**
- Keep legacy `tier1_score` for historical data
- Existing repreneurs keep old score, don't auto-migrate
- New repreneurs get WHO/WHEN scores

---

## Phase 1: UI Experimentation (Tier 1 Card Redesign)

### 1.1 Create Experimentation Page
**Location:** `/app/(dashboard)/experiments/scoring-cards/page.tsx`

Display 4 variations of the dual-score card (always WHO | WHEN side by side):
1. **Variant A:** Two circular gauges with labels "WHO" and "WHEN"
2. **Variant B:** Two horizontal progress bars stacked
3. **Variant C:** Two vertical bars side by side (like equalizer)
4. **Variant D:** Simple number boxes with color coding

Each variant should show:
- WHO score (0-100) with label
- WHEN score (0-100) with label
- Flags (if any) - prominently displayed
- Recommended action
- Expandable breakdown

### 1.2 Components to Create
```
/components/scoring-v2/
├── who-score-gauge.tsx       # Circular gauge for WHO
├── when-score-gauge.tsx      # Circular gauge for WHEN
├── dual-score-card.tsx       # Main card component
├── flag-badges.tsx           # Flag display with tooltips
├── score-breakdown.tsx       # Expandable details
├── recommendation-badge.tsx  # "Deal Flow" / "Starter Pack"
└── variants/
    ├── card-variant-a.tsx
    ├── card-variant-b.tsx
    ├── card-variant-c.tsx
    └── card-variant-d.tsx
```

### 1.3 Acceptance Criteria
- [ ] All 4 variants render correctly with sample data
- [ ] Flags are prominent and explain why they override
- [ ] Mobile-responsive
- [ ] Dark mode compatible (if applicable)

---

## Phase 2: Core Scoring Engine

### 2.1 New Scoring Functions
**Location:** `/lib/utils/scoring-v2.ts`

```typescript
// Main calculation functions
calculateWhoScore(answers: WhoAnswers): WhoScoreResult
calculateWhenScore(answers: WhenAnswers): WhenScoreResult
evaluateFlags(answers: AllAnswers): Flag[]
calculateTriangulation(dealSize, structure, equity): FitScore
getRecommendedAction(who, when, flags): RecommendedAction
```

### 2.2 Triangulation Matrix Implementation
Implement the 9-row matrix from spec as a lookup function.

### 2.3 Flag Detection
Implement all 5 flags (F1-F5) with clear logic.

### 2.4 Tests
**Location:** `/lib/utils/__tests__/scoring-v2.test.ts`

- Unit tests for each scoring function
- Edge cases for triangulation matrix
- Flag detection scenarios
- Integration test with sample questionnaire data

---

## Phase 3: New Public Intake Form

### 3.1 Create New Intake
**Location:** `/app/intake-v3/page.tsx` (or just `/app/intake/` after archiving)

**Steps (matching spec Q01-Q18):**
1. Contact Info (Q01-Q04): Email, Phone, CV, LinkedIn
2. WHO Questions (Q05-Q10): Status, Experience, Leadership, Crisis, Investments, Impact
3. Project Status (Q11): Single question, own step for emphasis
4. WHEN Questions (Q12-Q16): Geography, Sectors, Deal Size, Structure, Equity
5. Needs (Q17-Q18): Current needs, Investment thesis upload
6. Review & Submit

### 3.2 Form Components
```
/components/intake-v3/
├── intake-form-v3.tsx        # Main form orchestrator
├── steps/
│   ├── step-contact.tsx
│   ├── step-who.tsx
│   ├── step-project-status.tsx
│   ├── step-when.tsx
│   ├── step-needs.tsx
│   └── step-review.tsx
├── progress-indicator.tsx
└── intake-success.tsx
```

### 3.3 Server Actions
**Location:** `/lib/actions/intake-v3.ts`

- `createIntakeDraft()` - Save progress
- `completeIntake()` - Calculate scores, detect flags, create repreneur

### 3.4 Acceptance Criteria
- [ ] Form saves progress (localStorage or DB draft)
- [ ] Validation on each step
- [ ] File uploads work (CV, Thesis)
- [ ] Scores calculated on submit
- [ ] Flags detected and stored
- [ ] Welcome email sent
- [ ] Repreneur created with WHO/WHEN scores

---

## Phase 4: Update Existing UI Components

### 4.1 Repreneur Profile Page
**File:** `/app/(dashboard)/repreneurs/[id]/page.tsx`

Replace `Tier1ScoreCard` with new `DualScoreCard`.

### 4.2 Pipeline Board
**File:** `/components/pipeline/static-pipeline-board.tsx`

- Lead cards: Show WHO + WHEN (compact format)
- Add flag indicator (warning icon if flags present)

### 4.3 Repreneurs Table
**File:** `/components/repreneurs/repreneur-table.tsx`

- Replace "T1 Score" column with "WHO" and "WHEN" columns
- Add "Flags" column (count or icons)
- Add "Recommendation" column

### 4.4 Dashboard Widget
**File:** `/components/dashboard/top-tier1-repreneurs.tsx`

- Rename to `top-repreneurs.tsx`
- Sort by combined score or WHO (TBD)
- Show both scores
- Flag indicators

### 4.5 Internal Questionnaire Form
**File:** `/components/repreneurs/questionnaire-form.tsx`

Update to match new question set (Q05-Q18).

---

## Phase 5: Data Migration & Cleanup

### 5.1 Database Migration Script
**File:** `/scripts/XXX_add_dual_scoring.sql`

```sql
-- Add new columns
ALTER TABLE repreneurs ADD COLUMN who_score INTEGER;
-- ... etc

-- DO NOT auto-migrate existing data
-- Legacy tier1_score remains for history
```

### 5.2 Code Cleanup
Remove dead code after confirming everything works:
- Old scoring functions in `tier1-scoring.ts`
- Old intake components (already archived)
- Old questionnaire field references
- Unused database columns (after grace period)

### 5.3 Type Updates
**File:** `/lib/types/repreneur.ts`

Add new types for WHO/WHEN scores, flags, breakdown.

---

## Phase 6: Testing & Validation

### 6.1 Manual Testing Checklist
- [ ] Complete intake as new user → scores calculated correctly
- [ ] Flags trigger correctly and override recommendation
- [ ] All UI components display new scores
- [ ] Existing repreneurs still show legacy scores (no regression)
- [ ] Mobile responsive
- [ ] Edge cases (all TBD answers, contradictory selections)

### 6.2 Bertrand Validation
- [ ] Review scoring logic matches intent
- [ ] Confirm triangulation matrix is correct
- [ ] Confirm flag triggers are accurate
- [ ] Approve final UI design

---

## Senior Developer Considerations

### Backward Compatibility
- Legacy `tier1_score` kept for historical repreneurs
- UI should handle both old (single score) and new (dual score) formats
- API responses include both for transition period

### Performance
- Scoring calculation is CPU-bound but simple (~100 repreneurs max)
- No caching needed initially
- Consider memoization if recalculating on every page load

### Error Handling
- What if triangulation combination not found? → Default to AMBER (1)
- What if questionnaire incomplete? → Show "Incomplete" state, not zero

### Audit Trail
- Store `score_calculated_at` timestamp
- Store breakdown for debugging/explanation
- Consider logging flag triggers for analytics

### Future Extensibility
- Scoring weights could move to config (but not admin-editable)
- New flags can be added easily
- New questions would require migration

### Security
- Intake form: rate limiting, validation
- Score manipulation: server-side calculation only
- File uploads: validate file types, size limits

---

## Rough Sequence

```
Week 1: Phase 0 (Cleanup) + Phase 1 (UI Experimentation)
Week 2: Phase 2 (Scoring Engine) + Phase 3 (New Intake)
Week 3: Phase 4 (Update UI) + Phase 5 (Migration)
Week 4: Phase 6 (Testing) + Launch
```

---

## Files Summary

### To Create
- `/docs/dual-scoring-implementation-plan.md` (this file)
- `/lib/utils/scoring-v2.ts`
- `/lib/utils/__tests__/scoring-v2.test.ts`
- `/components/scoring-v2/*`
- `/app/intake-v3/*` or `/app/intake/*`
- `/components/intake-v3/*`
- `/scripts/XXX_add_dual_scoring.sql`

### To Modify
- `/app/(dashboard)/repreneurs/[id]/page.tsx`
- `/components/pipeline/static-pipeline-board.tsx`
- `/components/repreneurs/repreneur-table.tsx`
- `/components/dashboard/top-tier1-repreneurs.tsx`
- `/components/repreneurs/questionnaire-form.tsx`
- `/lib/types/repreneur.ts`

### To Archive
- `/app/intake/*`
- `/app/intake-v2/*`
- `/components/intake/*`
- `/components/intake-v2/*`

### To Delete
- `/components/guide/tier1-criteria-editor.tsx`
- Related admin editor components

---

## Decisions Made

1. **Score display:** Always separate. Show WHO and WHEN side by side with labels "WHO" and "WHEN"
2. **Sorting:** TBD (can sort by either column)
3. **Legacy handling:** CONVERT existing repreneurs. Map old answers to new questions. Leave blanks for missing data (Q11, Q12, Q14, Q15, Q16, Q17, Q18) - these will need manual fill-in by team.
4. **Intake URL:** TBD (likely `/intake` after archiving old versions)

## Legacy Data Migration Strategy

Existing repreneurs have old questionnaire fields (q1-q17). Need to map to new spec:

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| q1_employment_status | q05 (status) | Needs value mapping |
| q2_years_experience | q06 (years) | Direct map |
| q5_team_size | q07 (leadership) | Approximate mapping |
| q8_executive_roles | q07 (leadership) | Combine with above |
| q6_involved_in_ma | q08 (crisis) | Weak proxy |
| q4_has_ma_experience | q09 (investments) | Weak proxy |
| q10_journey_stages | - | No direct equivalent |
| q14_investment_capacity | q16 (equity) | Direct map |
| - | q05-q10 others | Manual fill needed |
| - | q11 (project status) | Manual fill needed |
| - | q12 (geography) | Manual fill needed |
| - | q14 (deal size) | Manual fill needed |
| - | q15 (structure) | Manual fill needed |

**Migration script will:**
1. Map what can be mapped automatically
2. Set unmapped fields to NULL
3. Calculate partial WHO score (from available data)
4. Set WHEN score to NULL (requires manual data entry)
5. Add `needs_data_completion: true` flag for admin attention

**Admin workflow for incomplete profiles:**
- Dashboard shows count of "Needs Data Completion" repreneurs
- Repreneur profile shows which fields are missing
- Admin can edit via internal questionnaire form
- Once all required fields filled, scores auto-calculate
