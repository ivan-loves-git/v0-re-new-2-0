# Re-New Platform: Meeting Summary
**Date:** December 30, 2024
**Participants:** Ivan Paudice, Bertrand (Re-New)

---

## App Development and Technical Status

- **Prototype Status:** Ivan has created a functional first version of the software. Although the initial tool (V0) had limitations, it was combined with other tools to overcome blockers. The prototype is ready for review.
- **Operational Metrics:** Production costs are currently negligible. Both app hosting and database services are operating effectively within free tier limits.

---

## Data Management and Migration Strategy

- **Data Source:** Candidate data is currently collected via Airtable forms (~17 questions) or CSV exports from Flatchr. The data includes structured inputs like maturity, experience, funding, and external scores.
- **Migration Approach:**
  - Short-term: The team will continue using external forms (Airtable/Typeform) for superior UI/UX and rapid testing capabilities.
  - Transition: Ivan will batch import ~3,000 existing candidates from the Flatchr CSV to populate the new database.
  - Long-term: Airtable will eventually be decommissioned in favor of custom platform pages.
- **Mapping Challenges:** The current CSV export lacks clear column headers (e.g., Q1, Q2, Q3). Ivan requires the list of questions from Bertrand to map fields (such as "Sector" or "M&A Experience") correctly.
- **Field Configuration:** French regions are pre-populated. "Sector/Industry" drop-down values need to be imported. The system must handle single-select vs. multi-select fields and conditional logic (e.g., empty text fields when a candidate answers "No").

---

## Platform Features and Logic

### Candidate Pipeline Structure

Status is **automatically derived from actions** (no manual drag-and-drop). The pipeline manages the entrepreneur's journey through specific statuses:

- **Lead:** Default entry point when form is submitted but candidate not yet met.
- **Qualified:** Automatically triggered when Tier 2 star rating is set by Re-New team (indicates interview completed and candidate assessed).
- **Client:** Automatically triggered when one or more offers are assigned to the candidate.
- **Rejected:** Triggered when rejected button is pressed (reversible).

**UI Change Required:** The current Kanban drag-and-drop view will be dismantled/redesigned since status changes are now action-driven. A static pipeline view or alternative UI/UX solution will be explored.

### Scoring and Assessment Framework

Each candidate profile will have two evaluation sections/cards:

- **Tier 1 (Pre-Interview):** Automated scoring based on initial form data, derived from Bertrand's existing Excel model. The profile displays the overall score with a button to view detailed breakdown (calculations per field).
- **Tier 2 (Post-Interview):** Manual star system (1-5 stars) set by Re-New team via dropdown selector. Reflects behavioral assessment, soft skills, and leadership potential. Qualitative feedback is stored in the Notes section.

### Activity Tracking and Automation

A dedicated "Activity History" feature will track the communication stream:

- **Key Activities:** Welcome Email, Interview, Offer Submitted, Offer Rejected, Offer Approved, Meetings.
- **Future Analytics:** Activity logs (including duration) will eventually support cost estimation per candidate.

---

## User Journey and Learning Methodology

**Status:** On hold for future business development (concept not fully developed).

- **Philosophy:** The platform could shift from pure coaching to a resource-heavy approach (90% frameworks/pre-readings).
- **Validation:** The system could operate like LinkedIn Learning, validating knowledge (e.g., "Clear Investment Thesis") to certify skills to intermediaries.
- **Decision:** Keep on hold until business model matures. Not a V1 priority.

---

## Product Offerings & Pricing Structure

Offers are structured as "Packs" with defined Price, Duration, and Hours. Assigning any pack automatically updates a candidate to "Client" status.

- **Starter Pack:** For less mature candidates to start the search. ~2,500 EUR, 6 weeks duration.
- **Deal Flow:** For candidates actively looking. Includes curation and qualified introductions. 12-month contract; pricing varies by target Enterprise Value.
- **Sparring Partner:** Subscription-based support. 600 EUR/month, 6 months duration (3,600 EUR total).

---

## Next Arrangements

### Ivan Paudice
- Import existing candidates from Flatchr CSV (~3,000 records)
- Develop the "Activity Tracking" feature to log interviews, offers, and meetings
- Implement the 3 packages as "Offers" on the platform (Price, Duration, Hours) with automation logic (Lead → Qualified → Client transitions based on actions)
- Implement the Tier 2 star system (1-5) for ranking qualified candidates (manual selection by Re-New users)
- Implement Tier 1 scoring system:
  - Implement all fields in the DB based on Bertrand's questions
  - Implement scoring for each field as per Bertrand's instructions
  - Display overall score in profile with detailed breakdown view
  - Implement scoring sorting in the candidate overview list
- Add "Rejected" button to candidate profiles (reversible)
- Redesign pipeline view (dismantle Kanban, explore alternative UI for action-driven status)
- Improve candidate list with:
  - Grouping by Lead/Qualified/Client
  - Score column for Leads, Star column for Qualified, Offer column for Clients
  - Sorting and filtering for different columns

### Bertrand (Re-New) - By End of Day
- Provide the complete list of questions (Q1-Q17), rationale, and drop-down values (especially Sectors). Indicate which questions are single-choice vs. multiple-choice.
- Provide the detailed scoring system logic (points per answer) and the Excel file with formulas for screening candidates.
- Define and send the list of standard activities/routines (emails, calls) performed with candidates.
- Review the platform prototype using the provided chat link.

### Future / Low Priority
- Clarify specific stages of the "Candidate Journey" (concept not mature, confirmation needed from Bertrand).
- Cost estimation per candidate based on activity duration.
