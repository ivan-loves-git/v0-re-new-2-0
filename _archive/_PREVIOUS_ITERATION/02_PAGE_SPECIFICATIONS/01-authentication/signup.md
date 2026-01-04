# Page Specification: Sign Up

**Route:** `/signup`
**Section:** Authentication
**Authentication Required:** No

---

## Purpose

Register new users and create their Renew Dashboard account. First touchpoint for converting prospects into platform users.

---

## Layout Structure

**Layout Type:** Centered single-column with split-screen design

```
┌─────────────────────────────────────────────────────┐
│  [Logo]                                             │
│                                                     │
│  ┌─────────────┬─────────────┐                     │
│  │             │             │                     │
│  │   LEFT:     │   RIGHT:    │                     │
│  │   Branding  │   Sign Up   │                     │
│  │   + Value   │   Form      │                     │
│  │   Props     │             │                     │
│  │             │             │                     │
│  └─────────────┴─────────────┘                     │
│                                                     │
│  [Footer: Terms, Privacy]                          │
└─────────────────────────────────────────────────────┘
```

**Responsive:**
- Desktop: 50/50 split (left branding, right form)
- Tablet: Stacked (branding top, form below)
- Mobile: Form only (branding minimal/header)

---

## Key Components

### Left Panel (Branding)
- **Renew Logo** (top-left, 120px width)
- **Hero Image/Illustration** (repreneur success imagery)
- **Headline:** "Join Renew - Your Acquisition Journey Starts Here"
- **Subheadline:** "Connect with deals, expert guidance, and a community of repreneurs"
- **Value Proposition Bullets** (3 items with icons):
  - 🔍 "Access curated acquisition opportunities in France"
  - 🎓 "Get expert coaching throughout your journey"
  - 👥 "Join a vetted community of acquisition entrepreneurs"

### Right Panel (Sign Up Form)
- **Form Title:** "Create Your Account"
- **Social Sign-Up Options:**
  - Google button (with logo)
  - LinkedIn button (with logo)
- **Divider:** "or sign up with email"
- **Form Fields:**
  1. First Name (text input, required)
  2. Last Name (text input, required)
  3. Email (email input, required)
  4. Password (password input with show/hide toggle, required)
  5. Confirm Password (password input, required)
  6. Country (dropdown, default: France, required)
- **Checkboxes:**
  - [ ] I agree to the Terms of Service (required, link opens modal)
  - [ ] I agree to the Privacy Policy (required, link opens modal)
- **Submit Button:** "Create Account" (primary button, full width)
- **Login Link:** "Already have an account? [Log in](#)"

### Footer
- Legal links: Terms of Service, Privacy Policy
- Copyright notice

---

## Interactive Elements

### Form Interactions
1. **Real-Time Validation:**
   - Email format check (must be valid email)
   - Password strength indicator (visual bar: weak/medium/strong)
   - Password match validation (confirm password must match)
   - Field-level error messages (red text below field)

2. **Show/Hide Password:**
   - Eye icon toggle on password fields
   - Reveals/hides password text

3. **Checkbox Validation:**
   - Must check both Terms and Privacy to enable submit
   - Links open modal overlays with full text

4. **Social OAuth:**
   - Clicking Google/LinkedIn button initiates OAuth flow
   - Returns to onboarding after successful authentication

5. **Submit Button:**
   - Disabled (gray) until all required fields valid and checkboxes checked
   - Shows loading spinner during account creation
   - Transforms to success state briefly before redirect

### Keyboard Navigation
- Tab through form fields
- Enter key submits form (if valid)
- Esc key closes modals

---

## Navigation

### FROM (Entry Points)
- Marketing website (renew.com CTA buttons)
- Email campaigns (invitation links)
- Referral links from existing users
- Direct URL entry
- Login page (if user clicks "Sign up" link)

### TO (Exit Points)
- `/onboarding` (automatic redirect after successful registration)
- `/login` (if user clicks "Already have account?" link)
- Terms/Privacy modals (temporary, returns to signup)

---

## Content

### Text Content

**Headline:** "Join Renew - Your Acquisition Journey Starts Here"

**Subheadline:** "Connect with deals, expert guidance, and a community of repreneurs"

**Value Props:**
1. "Access curated acquisition opportunities in France"
2. "Get expert coaching throughout your journey"
3. "Join a vetted community of acquisition entrepreneurs"

**Form Labels:**
- "First Name"
- "Last Name"
- "Email Address"
- "Password"
- "Confirm Password"
- "Country"

**Checkbox Labels:**
- "I agree to the [Terms of Service](#)"
- "I agree to the [Privacy Policy](#)"

**Button Text:**
- Primary: "Create Account"
- Social: "Sign up with Google" / "Sign up with LinkedIn"

**Help Text:**
- Password field: "Minimum 8 characters, include uppercase, lowercase, and number"

**Error Messages:**
- Email format: "Please enter a valid email address"
- Password weak: "Password must be at least 8 characters with uppercase, lowercase, and number"
- Passwords don't match: "Passwords do not match"
- Terms not accepted: "You must accept the Terms of Service to continue"
- Email already exists: "An account with this email already exists. [Log in instead](#)"

**Success Message:** (Brief, 1 second before redirect)
- "Account created successfully! Redirecting to onboarding..."

**Footer:**
- "© 2025 Renew. All rights reserved."
- Links: "Terms of Service" | "Privacy Policy"

### Imagery
- **Hero Image:** Illustration or photo suggesting success, ownership, entrepreneurship
- **Brand Colors:** Renew blue primary, warm accents
- **Icons:** Check icons for value props, social brand logos

---

## States

### 1. Default State
**Description:** Page loads, form is empty and ready for input

**Visuals:**
- Clean, empty form fields
- Submit button disabled (gray)
- Social buttons active and clickable
- Password strength indicator not shown yet

### 2. Filling Form (In Progress)
**Description:** User is entering information

**Visuals:**
- Active field has blue border (focus state)
- Real-time validation as user types
- Password strength bar appears and updates (red → yellow → green)
- Error messages appear/disappear as user corrects issues

### 3. Validation Error State
**Description:** User tries to submit with invalid data

**Visuals:**
- Fields with errors have red borders
- Error messages display below each invalid field (red text)
- Submit button remains disabled if validation fails
- Focus automatically moves to first error field

**Common Errors:**
- "Please enter a valid email address"
- "Password must be at least 8 characters"
- "Passwords do not match"
- "Please select your country"
- "You must accept the Terms of Service"

### 4. Submitting (Loading)
**Description:** Form is being processed (account creation in progress)

**Visuals:**
- Submit button shows loading spinner
- Button text: "Creating your account..."
- Form fields disabled (can't edit)
- Slight opacity overlay on form

**Duration:** 1-3 seconds typically

### 5. Success State
**Description:** Account created successfully

**Visuals:**
- Green checkmark appears briefly
- Success message: "Account created successfully!"
- Automatic redirect countdown (1 second)

**Then:** Redirects to `/onboarding`

### 6. Server Error State
**Description:** Account creation failed (server-side issue)

**Visuals:**
- Error banner at top of form (red background):
  - "Unable to create account. Please try again or [contact support](#)"
- Submit button re-enabled
- Form fields remain populated (don't lose user data)

**User Actions:**
- Can retry submission
- Can contact support link

### 7. Email Already Exists
**Description:** User tries to sign up with email that's already registered

**Visuals:**
- Error message on email field: "An account with this email already exists"
- Helpful link: "Already have an account? [Log in instead](/login)"

**User Actions:**
- Can try different email
- Can go to login page

---

## Edge Cases & Error Handling

### OAuth Failures
- **Google/LinkedIn auth fails:** Error banner "Unable to authenticate with [Provider]. Please try again or sign up with email."
- **OAuth returns but no email:** Prompt user to enter email manually

### Network Issues
- **No internet connection:** "No internet connection. Please check your connection and try again."
- **Timeout:** "Request timed out. Please try again."

### Browser Autofill
- Support browser password managers (autocomplete attributes)
- Validate autofilled data on blur or submit

### Password Requirements
- Minimum 8 characters
- Must include: uppercase, lowercase, number
- Optional: special character (not required for MVP)
- Visual strength indicator helps users create strong passwords

---

## Accessibility

### WCAG AA Compliance
- ✅ Color contrast: 4.5:1 minimum on all text
- ✅ Keyboard navigation: Full tab order, visible focus states
- ✅ Screen reader: All form labels properly associated
- ✅ Error identification: Errors clearly marked and announced
- ✅ Form validation: Errors announced to screen readers

### ARIA Labels
- `role="form"` on form element
- `aria-required="true"` on required fields
- `aria-invalid="true"` on fields with errors
- `aria-describedby` linking fields to error messages
- `aria-live="polite"` for dynamic error messages

### Focus Management
- Focus first field on page load
- Focus first error field on validation failure
- Focus stays within modal when open

---

## Analytics & Tracking

### Events to Track
1. **Page View:** "signup_page_viewed"
2. **Social Sign-Up Click:** "signup_social_clicked" (property: provider)
3. **Form Field Focus:** "signup_field_focused" (property: field_name)
4. **Validation Error:** "signup_validation_error" (property: error_type)
5. **Submit Attempt:** "signup_submit_attempted"
6. **Account Created:** "signup_success"
7. **Error Occurred:** "signup_error" (property: error_message)
8. **Login Link Clicked:** "signup_login_clicked"

### Conversion Funnel
- Page viewed
- Form started (first field focused)
- Social sign-up attempted OR form filled
- Account created successfully
- Redirected to onboarding

**Key Metric:** Signup → Onboarding completion rate (target: >70%)

---

## Technical Notes

### API Integration
- **Endpoint:** `POST /api/auth/signup`
- **Payload:**
  ```json
  {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "password": "string",
    "country": "string",
    "acceptedTerms": boolean,
    "acceptedPrivacy": boolean
  }
  ```
- **Response Success (201):**
  ```json
  {
    "userId": "string",
    "email": "string",
    "token": "JWT_string"
  }
  ```
- **Response Error (400/409/500):**
  ```json
  {
    "error": "string",
    "message": "string"
  }
  ```

### OAuth Integration
- **Google OAuth 2.0:** Use Google Sign-In library
- **LinkedIn OAuth 2.0:** Use LinkedIn API
- **Callback URL:** `/api/auth/oauth/callback`

### Security
- ✅ HTTPS only
- ✅ Password hashing (bcrypt, 10 rounds minimum)
- ✅ Email verification (send confirmation email after signup)
- ✅ Rate limiting (max 5 attempts per IP per hour)
- ✅ CSRF protection
- ✅ SQL injection prevention (parameterized queries)

### Performance
- **Target Load Time:** <2 seconds
- **Form Validation:** Debounce to avoid excessive API calls
- **Image Optimization:** Hero image <200KB, WebP format

---

## Design System References

**Components Used:**
- Primary Button ([03_DESIGN_SYSTEM/components.md#buttons](../../03_DESIGN_SYSTEM/components.md))
- Text Input ([03_DESIGN_SYSTEM/components.md#inputs](../../03_DESIGN_SYSTEM/components.md))
- Checkbox ([03_DESIGN_SYSTEM/components.md#checkbox](../../03_DESIGN_SYSTEM/components.md))
- Modal ([03_DESIGN_SYSTEM/components.md#modal](../../03_DESIGN_SYSTEM/components.md))

**Colors:**
- Primary: `#2D65F8`
- Error: `#EF4444`
- Success: `#10B981`
- Background: `#F9FAFB`

**Typography:**
- Headline: 36px, Bold
- Subheadline: 18px, Regular
- Form labels: 13px, Semibold
- Body: 14px, Regular

**Spacing:**
- Form field gaps: 16px
- Section padding: 32px
- Button padding: 12px × 24px

---

*Page Specification Version: 1.0*
*Last Updated: 2025-11-11*
*Status: Ready for Development*
