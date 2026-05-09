# Page Specification: Discovery Hub

**Route:** `/discovery`
**Section:** Discovery
**Authentication Required:** Yes

---

## Purpose

Landing page for discovery phase with overview and access to readiness assessment and criteria building tools.

---

## Layout Structure

Standard app layout with hero section and tool cards grid

---

## Key Components

### Hero Section
- Icon (magnifying glass/compass)
- Headline: "Discover Your Path to Acquisition"
- Subheadline: "Assess your readiness and define your ideal opportunity"
- CTA: "Start Readiness Assessment" (if not completed)

### Progress Overview Card (full width)
- Visual checklist:
  - ✓ Readiness Quiz (completed/not completed)
  - ✓ Lead de Cadrage (completed/not completed)
  - ○ Consultation Booked (premium)
- Overall discovery phase completion %

### Tool Cards Grid (2 columns)

1. **Readiness Assessment**
   - Icon, title, description
   - Status badge: "Not Started"/"In Progress"/"Completed"
   - Button: "Start Quiz"/"View Results"

2. **Acquisition Criteria (Lead de Cadrage)**
   - Icon, title, description
   - Status badge
   - Button: "Build Criteria"/"Edit Criteria"

3. **Learning Path**
   - Icon, title: "Personalized Learning"
   - Badge: "[X] courses recommended"
   - Button: "View Learning Path"

4. **Expert Consultation** (premium)
   - Icon, 🔒 Premium badge
   - Title, description
   - Button: "Book Consultation"/"Upgrade to Access"

---

## Interactive Elements

- Click CTA in hero to start assessment
- Click tool cards to navigate to pages
- Hover on cards shows animation

---

## Navigation

FROM: Dashboard, sidebar nav
TO: readiness-quiz, lead-de-cadrage, learning-path, consultation

---

## States

- **Not Started:** All "Start" CTAs
- **Partially Completed:** Some cards "Complete", progress indicators
- **Fully Completed:** All checkmarks, success message
- **Premium Gate:** Consultation card locked for free users

---

## Design System

Components: Hero, Progress Card, Tool Cards
Colors: Primary `#2D65F8`, Success `#10B981`
Spacing: Card grid 24px gaps, section padding 32px

---

*Version: 1.0 | Updated: 2025-11-11 | Status: Ready for Development*
