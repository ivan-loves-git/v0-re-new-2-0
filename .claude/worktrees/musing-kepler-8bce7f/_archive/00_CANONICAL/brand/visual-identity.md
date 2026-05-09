# Re-New Visual Identity

*Last updated: November 2024*

This document defines Re-New's visual identity system. Until formal brand assets are created, this serves as a guide for consistent visual presentation.

---

## Brand Status

**Current Status:** Pre-design phase
**Priority:** Medium (content and platform functionality come first)
**Next Steps:** Engage designer once MVP is funded

---

## Visual Principles

### Core Principles

1. **Professional but Approachable**
   - Clean, modern aesthetic
   - Not intimidating or overly corporate
   - Warmth through color and imagery

2. **Clear and Functional**
   - Clarity over decoration
   - Every element has a purpose
   - Accessibility-first design

3. **Trust and Stability**
   - Consistent application
   - Reliable visual system
   - Quality in every touchpoint

4. **Tech-Forward but Human**
   - Modern digital aesthetic
   - Human touches (photos, illustrations)
   - Balance between automated and personal

---

## Color Palette (Proposed)

### Primary Colors

**Deep Blue** - Trust, Professionalism
- Use: Headers, CTAs, primary actions
- Suggests: Reliability, expertise
- Hex: #1E3A5F (placeholder)

**Warm Green** - Growth, Success
- Use: Success states, positive actions
- Suggests: Progress, opportunity
- Hex: #2E7D32 (placeholder)

### Secondary Colors

**Soft Gray** - Balance, Sophistication
- Use: Body text, secondary elements
- Hex: #616161 (placeholder)

**Light Blue** - Openness, Clarity
- Use: Backgrounds, subtle accents
- Hex: #E3F2FD (placeholder)

### Accent Colors

**Orange** - Energy, Action
- Use: Urgent CTAs, notifications
- Hex: #FF6B35 (placeholder)

**Red** - Alerts, Errors
- Use: Error states, warnings
- Hex: #D32F2F (placeholder)

### Neutral Palette

- **White**: #FFFFFF - Primary background
- **Light Gray**: #F5F5F5 - Secondary background
- **Medium Gray**: #9E9E9E - Disabled states
- **Dark Gray**: #424242 - Primary text
- **Black**: #000000 - High emphasis only

---

## Typography (Proposed)

### Font Selection Criteria

**Headers:** Modern, professional, good readability
**Body:** Clear, friendly, excellent screen reading
**UI:** System fonts for performance

### Recommended Stack

```css
/* Headers */
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;

/* Body Text */
font-family: 'Open Sans', 'Segoe UI', Arial, sans-serif;

/* Monospace (data, code) */
font-family: 'Roboto Mono', 'Courier New', monospace;
```

### Type Scale

| Level | Size | Weight | Use Case |
|-------|------|--------|----------|
| H1 | 48px | Bold | Page titles |
| H2 | 36px | Semibold | Section headers |
| H3 | 28px | Semibold | Subsections |
| H4 | 24px | Medium | Card headers |
| Body | 16px | Regular | Primary content |
| Small | 14px | Regular | Secondary text |
| Caption | 12px | Regular | Labels, hints |

---

## Logo Concept (To Be Designed)

### Conceptual Direction

**Symbol Ideas:**
- Arrow + Building (progress + business)
- Bridge (connecting entrepreneurs to opportunities)
- Key + Graph (unlock growth)
- Handshake + Upward trend (partnership + success)

**Style Direction:**
- Modern, geometric
- Works at all sizes
- Clear in mono and color
- Professional but friendly

### Logo Variations Needed

1. **Primary Logo**: Full name + symbol
2. **Secondary Mark**: Symbol only
3. **Wordmark**: Text only
4. **Favicon**: Simplified for 16x16px
5. **App Icon**: For mobile applications

---

## Imagery Style

### Photography

**Style:** Authentic, professional, diverse
**Subjects:**
- Real entrepreneurs (not stock models)
- Actual SME environments
- Genuine interactions
- French business context

**Avoid:**
- Generic corporate stock photos
- Overly staged scenes
- Tech startup clichés
- American business imagery

### Illustration

**When to Use:**
- Complex concepts
- Empty states
- Onboarding flows
- Feature explanations

**Style Direction:**
- Simple, geometric
- Limited color palette
- Friendly but professional
- Consistent line weights

### Icons

**Style:** Outlined, consistent weight
**Set:** Use established library (Feather, Heroicons)
**Size:** 16px, 24px, 32px standard sizes
**Color:** Monochrome primarily, color for emphasis

---

## UI Components Style

### Buttons

**Primary Button**
- Background: Primary blue
- Text: White
- Padding: 12px 24px
- Border-radius: 6px
- Hover: 10% darker

**Secondary Button**
- Background: White
- Text: Primary blue
- Border: 2px solid primary
- Hover: Light blue background

### Cards

- White background
- Subtle shadow (0 2px 4px rgba(0,0,0,0.1))
- 8px border-radius
- 16px padding minimum
- Clear hierarchy

### Forms

- Clear labels above fields
- Generous spacing
- Obvious focus states
- Helpful error messages
- Progress indicators for multi-step

### Navigation

- Clean, minimal
- Clear active states
- Responsive design
- Accessibility compliant

---

## Platform UI Patterns

### Dashboard Design
- Card-based layout
- Clear information hierarchy
- Progressive disclosure
- Data visualization: simple, clear

### Color Usage in Platform

| Purpose | Color | Example |
|---------|-------|---------|
| New/Unread | Blue dot | New deals |
| In Progress | Orange | Active evaluations |
| Success | Green | Completed steps |
| Warning | Yellow | Attention needed |
| Error | Red | Failed actions |
| Disabled | Gray | Unavailable features |

---

## Marketing Materials

### Website
- Hero section with clear value prop
- Plenty of white space
- Trust signals (testimonials, logos)
- Clear CTAs throughout
- Mobile-first responsive

### Pitch Deck
- Clean, minimal slides
- Consistent color use
- Data visualization over text
- Professional but approachable

### Email Templates
- Simple, clean header
- Single column layout
- Clear CTA buttons
- Mobile optimized
- Branded footer

### Social Media
- Template for quotes
- Consistent color overlays
- Platform-appropriate sizing
- Branded but not overwhelming

---

## Accessibility Requirements

### Color Contrast
- WCAG AA compliance minimum
- 4.5:1 for normal text
- 3:1 for large text
- Test all color combinations

### Typography
- Minimum 14px for body text
- Line height 1.5x minimum
- Adequate paragraph spacing
- Avoid all-caps for long text

### Interactive Elements
- 44x44px minimum touch targets
- Clear focus indicators
- Keyboard navigation support
- Screen reader compatibility

---

## Brand Asset Management

### File Organization
```
/brand-assets/
  /logo/
    - logo-primary.svg
    - logo-secondary.svg
    - favicon.ico
  /colors/
    - color-palette.pdf
    - color-values.txt
  /fonts/
    - [font files]
  /templates/
    - email-template.html
    - presentation-template.pptx
  /guidelines/
    - brand-guidelines.pdf
```

### Version Control
- Date all assets (YYYY-MM-DD)
- Keep archive of previous versions
- Document changes in log
- Single source of truth

---

## Implementation Priority

### Phase 1: MVP (Current)
- Basic color palette
- System fonts only
- Simple, functional UI
- No custom illustrations

### Phase 2: Post-Funding
- Professional logo design
- Refined color palette
- Custom icon set
- Brand guidelines document

### Phase 3: Scale
- Illustration system
- Motion design principles
- Extended brand applications
- Brand enforcement tools

---

## Vendor Recommendations

### When Hiring Designers

**Logo/Brand Designer:**
- Experience with SaaS brands
- European market understanding
- Provide: This document + strategy docs

**UI/UX Designer:**
- Platform design experience
- French market knowledge
- Accessibility expertise

**Budget Estimates:**
- Logo & basic identity: ¬2,000-5,000
- Full brand system: ¬10,000-15,000
- UI design system: ¬15,000-25,000

---

## Quick Reference

### Do's
 Keep it simple and clean
 Prioritize readability
 Maintain consistency
 Test accessibility
 Use plenty of white space

### Don'ts
 Over-design
 Use too many colors
 Ignore mobile views
 Sacrifice function for form
 Copy competitors directly

---

## Inspiration & References

### Brands We Admire
- **Stripe**: Clean, professional, technical
- **Notion**: Simple, functional, friendly
- **Carta**: Trust, clarity, professional
- **Mercury**: Modern, clean, efficient

### Not Our Style
- Overly corporate (IBM, Oracle)
- Too playful (Mailchimp, Spotify)
- Too minimal (extreme brutalism)
- Too complex (heavy gradients, 3D)

---

## Next Steps

### Immediate (Pre-funding)
1. Use this guide for consistency
2. Apply colors to MVP
3. Collect visual preferences

### Post-funding Priority
1. Hire brand designer
2. Create logo and core assets
3. Develop full guidelines
4. Implement across platforms

---

## Change History

### November 2024 - Initial Creation
Created placeholder visual identity guidelines to ensure consistency until professional brand design can be commissioned. Focused on principles and practical guidance for MVP development.

---

*This document provides direction for visual consistency. Once funded, engage professional designers to create formal brand assets.*