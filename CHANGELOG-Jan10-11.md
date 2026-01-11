# Wave Platform Update - 48 Hours of Progress
**41 commits | Jan 10-11, 2026 | Version 0.6.0 → 0.7.5**

---

## Major New Feature: Structured Readiness Journey (v0.7.5)

The repreneur journey system has been completely redesigned to make progress tracking clearer and more actionable.

### Journey Page Redesign
- **Visual pipeline** - Clean 4-stage visualization (Explorer → Learner → Ready → Serial Acquirer)
- **Milestone badges** - Each repreneur card shows progress (e.g., 6/11 milestones)
- **Click-to-access** - Click any name to jump directly to their profile

### Milestones Grouped by Stage Transition
Instead of a flat list, milestones are now organized into 3 logical groups:
1. **Explorer → Learner** (3 milestones): Define acquisition criteria, set investment capacity, identify target sectors
2. **Learner → Ready** (4 milestones): Create letter of intent, funding secured, due diligence ready, advisory team in place
3. **Ready → Serial Acquirer** (4 milestones): Active search, under LOI, completed first acquisition, seeking additional deals

### 11th Milestone Added
- New milestone: "First acquisition completed"
- Serial Acquirer status now requires all 11 milestones complete (clear goal)

### Profile Page Updates
- Status and Journey badges moved to top-right header for quick visibility
- Milestones displayed in 2-column layout (cleaner on desktop)
- Journey stage shown alongside status (e.g., "Qualified | Learner 6/11")

---

## Tier 1 Rating Improvements (v0.7.0)

- **Compact inline editor** - Edit all 15 Tier 1 questions directly from profile (no wizard needed)
- **Lettre de Cadrage upload** - Added to Step 4 of intake form (amber-styled, optional)
- **Scoring algorithm fix** - Admin edits to scoring criteria now actually affect new intake scores

---

## Documents Management (v0.6.6)

- **CV upload in intake form** - PDF only, 10MB limit
- **Documents card on profile** - View/upload/replace/delete CV and LDC
- **Avatar storage fixed** - Custom photos now upload and display correctly everywhere (including table views)

---

## Email System Live (v0.6.8)

- **Resend integration** - Production emails via notifications@renew-wave.com
- **Founder notifications sent** - Welcome + High Score emails delivered to team
- **Clean UI** - Sandbox warning removed from Email Cockpit

---

## Other Improvements

### Repreneurs List
- Grouped view with per-group pagination
- Per-group column sorting
- Empty groups auto-collapse
- 8 items per page

### Evaluation Criteria (v0.6.0)
- New Guide page at /guide/evaluation
- Inline editing of questions, answers, and point values

### Client Offers Timeline (v0.6.5)
- Redesigned to show client offer timeline
- Visual status flow (Offered → Active → Completed)
- Package management moved to side panel

### Data Import
- Flatchr SQL import script
- Score breakdown included for imported records

### Technical
- "Candidate" → "Repreneur" terminology standardized
- Roadmap versioned (we're at ~75% to v1.0)

---

## Database Migrations Required

If updating an existing deployment, run these SQL scripts in Supabase:
1. `scripts/add-avatar-url-column.sql` (if avatar column missing)
2. `scripts/add-first-acquisition-milestone.sql` (adds 11th milestone)

---

## What's Next

Platform is approximately **75% complete** toward v1.0 launch. The Structured Readiness Journey provides a clear framework for tracking repreneurs from first contact to serial acquirer status.

Remaining work:
- Review milestone/stage labels with team
- Research intermediary portal requirements
- Final polish and team onboarding docs

---

**Current build: 162.2e3734d**
**View roadmap: /guide/roadmap**
