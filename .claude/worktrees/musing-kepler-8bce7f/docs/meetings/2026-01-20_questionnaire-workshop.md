# Questionnaire Workshop - Jan 20, 2026

**Attendees:** Bertrand, Amelie, Ivan
**Duration:** ~40 min
**Status:** Questionnaire spec 98% complete

---

## Key Decisions

### Questionnaire Structure (18 questions total)

| Block | Questions | Purpose | Scored |
|-------|-----------|---------|--------|
| Pure Data | Q1-5 | Name, email, phone, LinkedIn, LDC | No |
| WHO | Q6-10 | Profile quality & credibility | Yes → /100 |
| WHEN | Q11-18 | Project maturity & readiness | Yes → /100 |

### Two-Score System
Platform will show **two separate Tier 1 scores**:
- **WHO Score**: Assesses profile strength (strong vs weak candidate)
- **WHEN Score**: Assesses readiness level (early vs advanced stage)

This replaces the single Tier 1 score. Tier 2 (post-interview) stays unchanged.

---

## Scoring Logic Highlights

### Pivot Questions
- **Q7**: "Have you ever been CEO/MD/full P&L owner?"
  - Answer ponderates weight of subsequent questions
  - Managing 10 FTEs + crisis experience = different weight than non-CEO

- **Q11**: "Where do you stand in your search?"
  - "Interested in learning" → Send Starter Pack (low priority)
  - "Ready" → 20 points
  - "Advanced" → 30 points

### Triangulation Logic (Q14-Q16)
Three questions combined to detect coherent thesis:
- Q14: Target acquisition size (1M, 2M, 3-5M, 5M+)
- Q15: Deal structure preference (solo, minority fund, majority fund)
- Q16: Investment capacity (150-250K, 250-350K, etc.)

If someone targets 5M acquisition with 150K capital and no fund → Incoherent thesis flag.

### Penalty System
- Q12-14 (geography, sector, size): "I don't know" answers
  - 1 "I don't know" = -5 points
  - 2-3 "I don't know" = -10 points

### Bonus
- Q18: "Do you have an advisor?" Yes = bonus points

---

## Technical Implementation Notes

### Ivan's Pushback (Accepted by Team)
1. **Triangulation complexity**: Creates tight coupling, reduces future flexibility
2. **Pivot ponderation**: Same concern about modifiability

**Team decision**: Accept complexity for V1. Value of nuanced screening outweighs flexibility concerns.

### Implementation Approach
Instead of Excel → Ivan → Code, use:
1. Bertrand/Amelie build interactive prototype in ChatGPT Canvas
2. Test scoring with sample profiles directly
3. Export validated JSON for Ivan to implement
4. Reduces translation errors and iteration cycles

---

## Action Items

| Owner | Task | Due |
|-------|------|-----|
| Bertrand + Amelie | Complete ChatGPT questionnaire artifact | Thu Jan 23 |
| Bertrand + Amelie | Validate scoring with 5-10 test profiles | Fri Jan 24 |
| Bertrand + Amelie | Export JSON spec for Ivan | Fri Jan 24 |
| Bertrand | Update Notion with final decisions | Fri Jan 24 |
| Ivan | Implement new questionnaire + dual scoring | Wed Jan 29 |

---

## Platform Changes Required

1. **Tier 1 display**: Split into WHO score + WHEN score (both /100)
2. **Intake form**: Update question text, types, options (18 questions)
3. **Scoring engine**: Implement pivot ponderation + triangulation + penalties
4. **Radar chart**: May need adjustment for new dimensions
5. **Status logic**: Keep unchanged (Tier 2 → Qualified, Offer → Client)

---

## Open Items (Not for V1)

- **Tier 2 assessment**: Will define post-interview scoring criteria later
- **Journey milestones**: Current implementation stays, may refine after V1 launch

---

## Guide Shared with Founders

Ivan shared a guide for using ChatGPT to build the questionnaire prototype:
- Upload master file to ChatGPT
- Let AI challenge ambiguous logic
- Build interactive Canvas artifact
- Test with sample profiles
- Export clean JSON when validated

This allows founders to iterate on scoring logic without requiring Ivan's involvement for each change.
