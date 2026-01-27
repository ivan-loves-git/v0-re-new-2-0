---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - components/repreneurs/repreneur-form.tsx
autonomous: true

must_haves:
  truths:
    - "Add Repreneur form collects basic contact info only (name, email, phone, linkedin)"
    - "Form does NOT collect legacy questionnaire fields (q1-q17)"
    - "Form does NOT collect v2 questionnaire fields (q05-q16)"
    - "Admin can add basic repreneur record and direct them to complete v2 questionnaire later"
  artifacts:
    - path: "components/repreneurs/repreneur-form.tsx"
      provides: "Simplified admin form for basic repreneur creation"
---

<objective>
Audit and simplify the "Add Repreneur" form to align with v2 questionnaire workflow.

Purpose: The current form collects legacy Tier 1 scoring fields (investment_capacity, sector_preferences, target_location, target_acquisition_size) that are now handled by the v2 questionnaire (q05-q16). Admin should only enter basic contact info when manually adding a repreneur. The repreneur can then be sent the v2 questionnaire link to complete their scoring data.

Output: Simplified RepreneurForm that collects only: name, email, phone, linkedin, status, source, persona, company_background, and GDPR consent.
</objective>

<execution_context>
@/Users/ivanpaudice/.claude/get-shit-done/workflows/execute-plan.md
@/Users/ivanpaudice/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@components/repreneurs/repreneur-form.tsx
@lib/types/repreneur.ts
@lib/actions/repreneurs.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Simplify RepreneurForm by removing legacy Tier 1 fields</name>
  <files>components/repreneurs/repreneur-form.tsx</files>
  <action>
Remove the following fields from RepreneurForm that are now collected via v2 questionnaire:

**Remove from form UI:**
- Investment Capacity select
- Target Acquisition Size select
- Sector Preferences checkboxes
- Target Location(s) checkboxes

**Remove from form state/logic:**
- selectedSectors state and toggleSector function
- selectedLocations state and toggleLocation function
- sector_preferences handling in handleSubmit
- target_location handling in handleSubmit

**Remove imports:**
- INVESTMENT_CAPACITY_OPTIONS, INDUSTRY_SECTOR_OPTIONS, TARGET_ACQUISITION_SIZE_OPTIONS, TARGET_LOCATION_OPTIONS from tier1-scoring
- Checkbox component (no longer needed after removing multi-selects)

**Keep these fields (still relevant for admin):**
- First Name, Last Name, Email, Phone (basic contact)
- LinkedIn URL
- Status (lifecycle_status)
- Source
- Persona
- Company Background (free text notes)
- GDPR Consent section

The createRepreneur action already handles optional fields gracefully (undefined values), so no backend changes needed.

WHY: These removed fields were Tier 1 scoring inputs. The v2 system uses q05-q16 collected via the intake questionnaire, not manual admin entry. Admin should create minimal records and send repreneurs the questionnaire link.
  </action>
  <verify>
1. `npm run build` passes with no errors
2. Visual check: Navigate to /repreneurs/new and confirm form shows only basic fields
3. Test: Create a new repreneur with minimal data (name, email) - should succeed
  </verify>
  <done>
RepreneurForm shows only basic contact fields, removes legacy Tier 1 fields, build passes, form submits successfully.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update updateRepreneur action to match simplified form</name>
  <files>lib/actions/repreneurs.ts</files>
  <action>
Review updateRepreneur action for consistency with simplified form:

1. The action still handles sector_preferences, target_location, investment_capacity, target_acquisition_size
2. These fields should remain in the action because:
   - Existing repreneurs may have this data (backward compatibility)
   - The v2 questionnaire submission populates similar fields (q13_target_sectors_v2 -> sector_preferences)

**No changes needed** to the action - it gracefully handles null/empty values already.

Add a code comment documenting the field split:
- Basic fields (manual entry via form): name, email, phone, linkedin, status, source, persona, company_background, consent
- Questionnaire fields (v2 intake): q05-q16, who_score, when_score, etc.
- Legacy fields (preserved for existing data): investment_capacity, sector_preferences, target_location, target_acquisition_size
  </action>
  <verify>
1. Review action code - confirm it handles empty form submissions gracefully
2. Existing repreneurs with legacy data should remain unaffected
  </verify>
  <done>
Action code reviewed and documented, no breaking changes to existing data handling.
  </done>
</task>

</tasks>

<verification>
- [ ] Build passes: `npm run build`
- [ ] Form loads at /repreneurs/new with simplified fields
- [ ] Can create new repreneur with minimal data (name + email)
- [ ] Existing repreneurs with legacy scoring data remain viewable
</verification>

<success_criteria>
1. RepreneurForm displays only: name, email, phone, linkedin, status, source, persona, company_background, GDPR consent
2. Legacy Tier 1 scoring fields (investment_capacity, sector_preferences, target_location, target_acquisition_size) removed from form
3. Build passes with no TypeScript errors
4. Creating a new repreneur works with simplified form
</success_criteria>

<output>
After completion, create `.planning/quick/001-audit-add-repreneur-form/001-SUMMARY.md`
</output>
