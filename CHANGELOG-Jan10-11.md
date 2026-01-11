# Wave Platform Update - Last 36 Hours
**30 commits | Jan 10-11, 2026 | Version 0.6.0 → 0.7.0**

---

## New Features

### Tier 1 Rating Improvements (v0.7.0)
- **Compact inline editor on profile page** - All 15 Tier 1 questions now editable directly from the repreneur profile. No need to open the full questionnaire wizard for quick corrections. Includes searchable dropdowns for long lists.
- **Lettre de Cadrage upload in intake form** - Added LDC document upload to Step 4 (Goals) of the public intake form. Optional with skip button. Amber-styled to distinguish from CV upload.
- **Scoring algorithm fix** - Critical fix: admin edits to scoring criteria in /guide/evaluation now actually affect new intake scores. Previously the algorithm ignored database values.

### Documents Management (v0.6.6)
- **CV upload in intake form** - Repreneurs can upload their CV during the questionnaire (PDF only, 10MB limit)
- **Documents card on profile** - New card showing CV and Lettre de Cadrage with view/upload/replace/delete controls
- **Avatar storage fixed** - Custom photo uploads now work properly

### Email System Live (v0.6.8)
- **Resend integration complete** - Production email sending via notifications@renew-wave.com
- **Founder notification emails sent** - Welcome and High Score test emails delivered to Bertrand, Amelie, Antoine
- **Sandbox warning removed** - Email Cockpit UI cleaned up

### Evaluation Criteria (v0.6.0)
- **New Guide page** - View all Tier 1 scoring questions, answers, and point values at /guide/evaluation
- **Inline editing** - Edit question labels, answer text, and scores directly from the page

### Client Offers Timeline (v0.6.5)
- **Offers page redesigned** - Now shows client offer timeline instead of package list
- **Visual progress tracking** - Status flow (Offered → Active → Completed) with milestone counts
- **Package management moved to side panel** - Cleaner UI focusing on daily use case

---

## Repreneurs List Improvements

- **Grouped view with pagination** - Each status group (Lead, Qualified, Client, Rejected) has its own pagination
- **Per-group column sorting** - Sort each group independently by name, email, status-specific column, or date
- **Empty groups collapsed by default** - Groups with zero repreneurs auto-collapse on page load
- **8 items per page** - Reduced from 10 for better visual balance

---

## Data Import

- **Flatchr import system** - SQL script for importing historical data from Flatchr export
- **Score breakdown for imports** - Imported records now include tier1_score_breakdown field

---

## Technical Improvements

- **Terminology standardized** - "Candidate" → "Repreneur" throughout codebase
- **Roadmap versioning** - Renumbered to 0.1→0.7 (we're at 70% to v1.0 launch)
- **Documentation** - Roadmap update process documented for consistency

---

## What's Next

Platform is approximately **70% complete** toward v1.0 launch. Remaining work includes final polish, team onboarding documentation, and Flatchr data migration.

---

**Current build: 150.b3a9056**
**View roadmap in app: /guide/roadmap**
