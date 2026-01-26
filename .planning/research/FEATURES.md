# Feature Landscape: CRM Launch Readiness

**Domain:** Internal CRM for candidate/repreneur management
**Researched:** 2026-01-26
**Focus:** Score editing, launch readiness, duplicate prevention, status taxonomy

---

## 1. Admin Score Editing Patterns

### The Two-Field Pattern (Recommended)

The industry-standard approach for allowing manual override of calculated scores uses **two separate database fields**:

| Field | Type | Purpose |
|-------|------|---------|
| `calculated_score` | Computed | Auto-calculated from questionnaire answers |
| `override_score` | Nullable number | Admin's manual override value |
| `effective_score` | Virtual/computed | `COALESCE(override_score, calculated_score)` |

**Implementation pattern:**
```sql
-- Database
ALTER TABLE repreneurs ADD COLUMN score_override INTEGER;
ALTER TABLE repreneurs ADD COLUMN score_override_reason TEXT;
ALTER TABLE repreneurs ADD COLUMN score_override_by UUID REFERENCES users(id);
ALTER TABLE repreneurs ADD COLUMN score_override_at TIMESTAMPTZ;

-- Query pattern (always use effective score)
SELECT
  COALESCE(score_override, tier1_score) as effective_tier1_score,
  COALESCE(score_override, tier2_score) as effective_tier2_score
FROM repreneurs;
```

**Why this pattern works:**
- Original calculation preserved for audit trail
- Override clearly marked as manual intervention
- Easy to revert (just NULL the override)
- Recalculation doesn't destroy manual adjustments

**Confidence:** HIGH (verified across Airtable, HubSpot, Microsoft Access patterns)

### UI Patterns for Score Editing

**Pattern A: Inline Edit with Visual Indicator**
```
Score: 72 [pencil icon]
        ^-- clicking opens small popover
            [New Score: ___]
            [Reason: ___]
            [Save] [Cancel]
```
- Show original calculated value crossed out when overridden
- Display "(manual)" badge next to overridden scores
- Log who made the change and when

**Pattern B: Audit Trail Display**
```
Effective Score: 85 (manual override)
Original Score: 72
Override by: Bertrand on Jan 25, 2026
Reason: "Strong local network offsets lower experience score"
[Revert to calculated]
```

**Anti-pattern to avoid:** Editing the calculated score directly. This loses the audit trail and gets overwritten on recalculation.

### HubSpot/Zoho Approach

Both HubSpot and Zoho treat score properties as **read-only calculated fields**:
- Cannot manually edit score properties directly
- Workaround: Create a separate "adjustment" property and use workflows
- Enterprise customers can reset scores via workflow triggers

**Implication for Wave:** Since we control the database, the two-field pattern is simpler than workflow-based approaches.

---

## 2. Launch Readiness Checklist

### Technical Validation (Before Go-Live)

| Category | Check | Priority | Notes |
|----------|-------|----------|-------|
| **Data** | All existing records migrated | P0 | Flatchr import complete |
| **Data** | Duplicate detection run | P0 | Check for email duplicates |
| **Data** | Score calculations verified | P0 | Sample 10 records manually |
| **Auth** | All team members have accounts | P0 | Bertrand + team in Supabase |
| **Auth** | Permissions verified | P1 | Test each role's access |
| **Forms** | Questionnaire flow works end-to-end | P0 | Submit test, verify record created |
| **Forms** | Email notifications firing | P1 | Welcome, thank you emails |
| **UI** | Critical pages load without errors | P0 | Dashboard, profile, pipeline |
| **UI** | Mobile responsiveness checked | P1 | Key pages on phone |
| **Integrations** | Email sending works | P0 | Resend API connected |
| **Performance** | Page load under 3 seconds | P1 | Especially data-heavy pages |
| **Backup** | Database backup exists | P0 | Pre-launch snapshot |
| **Rollback** | Rollback plan documented | P1 | Know how to revert |

### Functional Validation (User Acceptance)

| Feature | Test Scenario | Expected Outcome |
|---------|---------------|------------------|
| Questionnaire | Submit new application | Record appears in pipeline with correct score |
| Score editing | Override a score | New score persists, shows as manual |
| Status change | Move repreneur through pipeline | Status updates, history logged |
| Notes | Add a note | Note appears on profile with timestamp |
| Search | Search by name, email | Correct results returned |
| Export | Export repreneur list | CSV downloads with correct data |

### Pre-Launch Communication

| Audience | Action | Timing |
|----------|--------|--------|
| Internal team | Training session on new features | 2-3 days before |
| Internal team | Send "what's new" summary | 1 day before |
| Candidates | DO NOT notify until questionnaire ready | After launch |

**Confidence:** HIGH (synthesized from Microsoft Dynamics 365, SaaS launch best practices)

---

## 3. Duplicate Prevention Mechanisms

### Email as Unique Identifier (Recommended)

The most reliable duplicate prevention for questionnaire submissions:

**Pre-submission check (client-side):**
```typescript
// Before showing questionnaire
const existingRecord = await checkEmailExists(email);
if (existingRecord) {
  return { error: 'DUPLICATE', existingId: existingRecord.id };
}
```

**Database constraint (server-side):**
```sql
-- Unique constraint on email
ALTER TABLE repreneurs
ADD CONSTRAINT unique_email UNIQUE (email);
```

**User experience for duplicates:**

| Scenario | Handling |
|----------|----------|
| Email exists, questionnaire incomplete | Allow re-entry, update existing record |
| Email exists, questionnaire complete | Show message: "You've already submitted. Contact us to update." |
| Email exists, different person | Rare edge case; handle manually |

### Duplicate Detection Patterns

| Method | Use Case | Reliability |
|--------|----------|-------------|
| **Exact email match** | Primary dedup | HIGH |
| **Fuzzy name match** | Secondary check | MEDIUM |
| **Phone number match** | Supplementary | LOW (format variations) |

**Implementation recommendation:**
1. **Hard block:** Exact email match prevents submission
2. **Soft warning:** Similar name shows "Did you mean [existing person]?"
3. **Admin merge:** Manual merge tool for identified duplicates

### What NOT to Do

- IP-based blocking (fails for shared networks, VPNs)
- Session-based blocking (easily bypassed with incognito)
- Browser fingerprinting (privacy concerns, unreliable)

**Confidence:** HIGH (verified across Tally, Fillout, BlockSurvey, Microsoft Forms)

---

## 4. Pipeline Status Taxonomy

### Declined vs Rejected: Key Distinction

| Status | Initiated By | Meaning | Example |
|--------|--------------|---------|---------|
| **Rejected** | Organization | Candidate doesn't meet criteria | Score too low, missing requirements |
| **Declined** | Candidate | Candidate chose not to proceed | Found other opportunity, timing wrong |
| **Withdrawn** | Candidate | Candidate exits mid-process | Changed mind, personal reasons |

### Recommended Status Taxonomy for Wave

**Active Pipeline Stages:**
```
Lead
  -> Qualified (passed initial scoring)
    -> In Review (being evaluated)
      -> Offer Made
        -> Client (accepted)
```

**Exit Statuses (Terminal):**
```
Rejected (organization decision, low score)
Declined (candidate's choice, not interested)
Withdrawn (candidate exited mid-process)
Archived (old records, no longer active)
```

### Status Display Patterns

| Status | Color | Icon | Notes |
|--------|-------|------|-------|
| Lead | Gray | Circle outline | New, unprocessed |
| Qualified | Blue | Check | Passed scoring threshold |
| In Review | Yellow | Eye | Active evaluation |
| Offer Made | Purple | Star | Awaiting response |
| Client | Green | Check-circle | Successfully converted |
| Rejected | Red | X | Didn't meet criteria |
| Declined | Orange | Hand | Candidate said no |
| Withdrawn | Gray | Arrow-left | Candidate exited |

### Status Transition Rules

| From | To | Allowed? | Notes |
|------|-----|----------|-------|
| Lead | Qualified | Yes | After scoring |
| Lead | Rejected | Yes | Immediate low score |
| Qualified | Rejected | Yes | After review |
| Qualified | Declined | Yes | Candidate opts out |
| Any | Withdrawn | Yes | Candidate-initiated |
| Rejected | Lead | Admin only | Reconsideration |
| Client | Any | No | Terminal positive state |

**Confidence:** HIGH (verified across SAP SuccessFactors, RecruitAlliance, ATS best practices)

---

## Feature Dependencies

```
Duplicate Prevention (P0)
    |
    v
Score Calculation (P0) --> Score Override UI (P1)
    |
    v
Status Management (P0) --> Declined Status Addition (P1)
    |
    v
Launch Checklist Validation (P0)
```

---

## MVP Recommendation for Wave Launch

### Must Have (P0)

1. **Duplicate prevention:** Email uniqueness check before questionnaire submission
2. **Score persistence fix:** Ensure admin edits save correctly (current bug)
3. **Declined status:** Add to taxonomy, distinct from Rejected

### Should Have (P1)

4. **Two-field score pattern:** Separate override_score from calculated_score
5. **Audit trail:** Log who changed scores and when
6. **Launch checklist verification:** Run through all items before mass email

### Nice to Have (P2)

7. **Fuzzy duplicate detection:** "Similar record exists" warning
8. **Score override reason field:** Capture why admin adjusted
9. **Status transition logging:** Full history of status changes

---

## Sources

### Score Editing
- [HubSpot: Edit or Delete Lead Scores](https://knowledge.hubspot.com/scoring/manage-lead-scores)
- [Zoho CRM: Scoring Rules](https://help.zoho.com/portal/en/kb/crm/automate-business-processes/scoring-rules/articles/multiple-scoring-rule)
- [Airtable: Formula Override Pattern](https://community.airtable.com/formulas-10/how-to-work-with-fields-where-you-want-automated-data-formula-that-you-can-manually-override-37157)
- [SpreadsheetWeb: Formula Override Feature](https://spreadsheetweb.com/formula-override-designer/)

### Launch Readiness
- [Microsoft Dynamics 365: Go-Live Checklist](https://learn.microsoft.com/en-us/dynamics365/guidance/implementation-guide/prepare-go-live-checklist)
- [Storylane: SaaS Product Launch Checklist 2026](https://www.storylane.io/blog/how-to-launch-a-saas-product-checklist-included)
- [Getdefault: SaaS Production Readiness Checklist](https://www.getdefault.in/post/saas-production-readiness-checklist)
- [DasMeta: Production Readiness Checklist](https://www.dasmeta.com/cloud-infrastructure-blog/production-readiness-checklist-ensuring-a-smooth-golive-for-your-new-service)

### Duplicate Prevention
- [Breakcold: CRM Deduplication 2026](https://www.breakcold.com/blog/crm-deduplication)
- [Inogic: Prevent Duplicate Data in CRM](https://www.inogic.com/product/productivity-apps/duplicate-records-prevention-crm/)
- [Tally: Prevent Duplicate Submissions](https://tally.so/help/prevent-duplicate-submissions)
- [Formaloo: Duplicate Submission Prevention](https://www.formaloo.com/blog/how-to-prevent-duplicate-submissions-on-your-forms)

### Status Taxonomy
- [RecruitAlliance: Decoding Candidate Statuses](https://kb.recruitalliance.com/24015/kb/article/104691/decoding-candidate-statuses-a-guide)
- [SAP: Withdrawn Candidate Status](https://userapps.support.sap.com/sap/support/knowledge/en/2082231)
- [Recruiterflow: ATS vs CRM](https://recruiterflow.com/blog/ats-vs-crm/)
