# Page Specification: [PAGE NAME]

**Route:** `/path/to/page`
**Section:** [Section Name]
**Authentication Required:** Yes/No

---

## Purpose

[What this page accomplishes for the user in 1-2 sentences]

---

## Layout Structure

**Layout Type:** [e.g., Standard app layout, Centered single-column, Split-screen, etc.]

```
[ASCII diagram showing layout structure]
┌─────────────────────────────────────┐
│  [Component areas]                  │
│  ┌─────────┬─────────┐              │
│  │  Left   │  Right  │              │
│  └─────────┴─────────┘              │
└─────────────────────────────────────┘
```

**Responsive:**
- Desktop: [layout description]
- Tablet: [layout description]
- Mobile: [layout description]

---

## Key Components

### [Component Group 1]
- **Component A:** [Description and specs]
- **Component B:** [Description and specs]

### [Component Group 2]
- **Component C:** [Description and specs]
- **Component D:** [Description and specs]

[List all UI components needed: buttons, forms, cards, lists, etc.]

---

## Interactive Elements

### [Interaction Category 1]
1. **[Interaction A]:** [Description of what happens]
2. **[Interaction B]:** [Description of what happens]

### [Interaction Category 2]
1. **[Interaction C]:** [Description of what happens]

### Keyboard Navigation
- [Tab behavior]
- [Enter/Esc behavior]
- [Shortcuts]

---

## Navigation

### FROM (Entry Points)
- [Where users come from - list pages/actions]
- [Another entry point]

### TO (Exit Points)
- [Where users can go - list pages/actions]
- [Another exit point]

---

## Content

### Text Content

**Headline:** "[Main page heading]"

**Subheadline:** "[Supporting text]"

**[Section Name]:**
- [Content item 1]
- [Content item 2]

**Button Text:**
- Primary: "[Button label]"
- Secondary: "[Button label]"

**Error Messages:**
- [Error scenario]: "[Error message text]"
- [Error scenario]: "[Error message text]"

**Success Messages:**
- [Success scenario]: "[Success message text]"

**Help Text:**
- [Field name]: "[Help text for this field]"

### Imagery
- **[Image type]:** [Description and specs]
- **Icons:** [Which icons, sizes, colors]

---

## States

### 1. Default State
**Description:** [When this state appears]

**Visuals:**
- [Visual element 1]
- [Visual element 2]

### 2. Loading State
**Description:** [When this state appears]

**Visuals:**
- [Visual element 1]
- [Visual element 2]

**Duration:** [Typical duration]

### 3. Error State
**Description:** [When this state appears]

**Visuals:**
- [Visual element 1]
- [Visual element 2]

**User Actions:**
- [What user can do]

### 4. Empty State
**Description:** [When this state appears]

**Visuals:**
- [Visual element 1]
- [Visual element 2]

**User Actions:**
- [What user can do to populate]

### 5. Success State
**Description:** [When this state appears]

**Visuals:**
- [Visual element 1]
- [Visual element 2]

---

## Edge Cases & Error Handling

### [Edge Case 1]
- **Scenario:** [Description]
- **Handling:** [How the system responds]

### [Edge Case 2]
- **Scenario:** [Description]
- **Handling:** [How the system responds]

---

## Accessibility

### WCAG AA Compliance
- ✅ Color contrast: 4.5:1 minimum
- ✅ Keyboard navigation: [Specifics]
- ✅ Screen reader: [Specifics]
- ✅ Error identification: [Specifics]

### ARIA Labels
- [ARIA attribute]: [Usage]
- [ARIA attribute]: [Usage]

### Focus Management
- [Focus behavior 1]
- [Focus behavior 2]

---

## Analytics & Tracking

### Events to Track
1. **Event Name:** "event_name" (property: value)
2. **Event Name:** "event_name" (property: value)

### Conversion Funnel
- Step 1
- Step 2
- Step 3

**Key Metric:** [Main metric to measure]

---

## Technical Notes

### API Integration
- **Endpoint:** `METHOD /api/path`
- **Payload:**
  ```json
  {
    "field": "type"
  }
  ```
- **Response:**
  ```json
  {
    "result": "type"
  }
  ```

### Security
- ✅ [Security consideration 1]
- ✅ [Security consideration 2]

### Performance
- **Target Load Time:** <X seconds
- **Optimization notes:** [Any specific optimizations]

---

## Design System References

**Components Used:**
- [Component Name] ([Link to design system](../../03_DESIGN_SYSTEM/components.md))
- [Component Name] ([Link to design system](../../03_DESIGN_SYSTEM/components.md))

**Colors:**
- Primary: `#2D65F8`
- [Other colors used]

**Typography:**
- [Typography specs used]

**Spacing:**
- [Spacing specs used]

---

*Page Specification Version: 1.0*
*Last Updated: [Date]*
*Status: [Draft/Ready for Development/In Development/Complete]*
