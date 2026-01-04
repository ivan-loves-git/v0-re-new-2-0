# Figma Design Specifications - Discovery Pages

## Design System
- **Font:** Inter
- **Primary Color:** #2D65F8 (blue)
- **Success:** #10B981 (green)
- **Warning:** #F59E0B (orange)
- **Error:** #EF4444 (red)
- **Text:** #1F2937 (dark gray)
- **Muted:** #6B7280 (medium gray)
- **Border:** #E5E7EB (light gray)
- **Background:** #F9FAFB (off-white)
- **Spacing:** 8px grid system

---

## Page 1: Lead de Cadrage (Criteria Form)

### Layout
- **Container:** Max-width 800px, centered
- **Padding:** 24px mobile, 48px desktop
- **Sections:** 7 steps with progress bar

### Components

**Progress Bar**
- Height: 8px
- Background: #E5E7EB
- Fill: #2D65F8
- 7 segments with labels below

**Section Cards** (7 total)
Each section in a white card with:
- Padding: 24px
- Border-radius: 12px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)

**Form Controls**
- **Checkboxes:** 20x20px, border 2px #D1D5DB
- **Radio buttons:** 20x20px circular
- **Sliders:** Track 4px high, handle 20px
- **Input fields:** Height 44px, border 1px #E5E7EB
- **Preset buttons:** Height 40px, border-radius 8px

**Navigation**
- Back button: Ghost style, left side
- Next button: Primary blue, right side
- Save draft: Text link, center bottom

### Mobile Layout
- Single column
- Full width cards
- Sticky navigation bar at bottom

---

## Page 2: Results Page

### Layout
- **Hero Section:** Full width gradient background
- **Score Section:** Centered, 600px max-width
- **Details Section:** 3-column grid on desktop

### Components

**Overall Score Circle**
- Size: 200px diameter
- Border: 16px thick
- Colors: Gradient from red→yellow→green
- Center text: 72px font size
- Label below: 18px, medium gray

**Category Cards** (3 cards)
- Width: Equal thirds with 24px gap
- Height: Auto
- Each contains:
  - Title: 18px bold
  - Score bar: Height 8px, rounded
  - Score text: 36px bold
  - Bullet list: 14px with checkmarks/x marks

**Action Plan Box**
- Full width
- Light blue background #EBF1FF
- Border-left: 4px solid #2D65F8
- Numbered list with 16px font

**CTA Section**
- 2 buttons side by side on desktop
- Stacked on mobile
- Primary: Blue, 48px height
- Secondary: White with border

### Mobile Layout
- Stack all cards vertically
- Reduce score circle to 160px
- Single column throughout

---

## Page 3: Learning Path

### Layout
- **Header:** Title + overall progress
- **Tracks:** 3 sections with titles
- **Modules:** Card grid, 2 columns desktop

### Components

**Progress Header**
- Linear progress bar: Full width, 12px height
- Text: "X of Y modules completed"
- Percentage badge: Rounded, blue background

**Track Sections** (3 sections)
Each track:
- Title: 24px bold
- Subtitle: 14px gray
- Required badge if score < 70
- Module cards below

**Module Cards**
- Size: Equal width in 2-column grid
- Padding: 20px
- Contents:
  - Number badge: 32px circle, top-left
  - Title: 16px semibold
  - Time: 12px gray with clock icon
  - Format badge: Pill shape, colored
  - Progress bar: Bottom of card
  - Button: Full width at bottom

**Status Indicators**
- Not started: Gray border
- In progress: Blue border, progress shown
- Completed: Green checkmark badge

### Mobile Layout
- Single column for modules
- Collapsible track sections
- Sticky progress header

---

## Page 4: Consultation Booking

### Layout
- **Left Column:** Advisor cards + calendar
- **Right Column:** Booking form
- **Confirmation:** Full screen modal

### Components

**Advisor Cards**
- Width: 100% of column
- Height: 80px
- Contents:
  - Avatar: 60px circle
  - Name: 16px semibold
  - Specialties: 12px gray tags
  - Select button: Right aligned

**Calendar Widget**
- Month grid: 7 columns
- Day cells: 40px squares
- Available dates: Blue text
- Selected: Blue background
- Today: Bold border

**Time Slots**
- Grid: 4 columns, 2 rows
- Button size: Equal width
- Height: 40px
- Available: White with border
- Selected: Blue background
- Unavailable: Gray, disabled

**Form Fields**
- Standard inputs: 44px height
- Textarea: 100px min-height
- Checkboxes: In vertical list
- File upload: Dashed border zone

**Confirmation Modal**
- Width: 500px max
- Centered with overlay
- Success icon: 48px green check
- Details list: 16px with icons
- CTA buttons: Stacked

### Mobile Layout
- Full screen steps
- Step 1: Choose advisor
- Step 2: Pick date/time
- Step 3: Fill form
- Step 4: Confirmation

---

## Interactive States

### Buttons
- Default: As designed
- Hover: Darken 10%
- Active: Darken 20%
- Disabled: 50% opacity
- Loading: Spinner icon

### Form Fields
- Default: Gray border
- Focus: Blue border, shadow
- Error: Red border, message below
- Success: Green checkmark inside
- Disabled: Gray background

### Cards
- Default: White background
- Hover: Slight shadow increase
- Selected: Blue border
- Disabled: 50% opacity

---

## Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Animation Guidelines
- Transitions: 200ms ease
- Progress bars: 500ms ease-out
- Page transitions: Slide left/right
- Modals: Fade in with scale
- Success states: Checkmark draw

---

## Accessibility Requirements
- All interactive elements: 44px minimum touch target
- Color contrast: WCAG AA (4.5:1 minimum)
- Focus indicators: 2px blue outline
- Screen reader labels on all icons
- Form validation: Inline with clear messages
- Progress announcements: Live regions

---

## Export Requirements
- Components: As symbols/components
- Icons: SVG format
- Spacing: Use 8px grid
- Fonts: Inter family only
- Colors: Use defined palette only
- States: Create all hover/active/disabled