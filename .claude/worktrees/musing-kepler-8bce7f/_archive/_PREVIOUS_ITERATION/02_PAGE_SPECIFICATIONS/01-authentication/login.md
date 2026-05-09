# Page Specification: Login

**Route:** `/login`
**Section:** Authentication
**Authentication Required:** No

---

## Purpose

Allow existing users to authenticate and access their Renew Dashboard account.

---

## Layout Structure

Split-screen design (50/50 on desktop, stacked on mobile)

```
┌─────────────────────────────────────┐
│  [Logo]                             │
│  ┌──────────┬──────────┐            │
│  │ Branding │  Login   │            │
│  │  + Hero  │   Form   │            │
│  └──────────┴──────────┘            │
└─────────────────────────────────────┘
```

---

## Key Components

### Left Panel
- Renew logo
- Hero image/illustration
- Tagline: "Welcome Back to Renew"
- Subheadline: "Continue your acquisition journey"

### Right Panel - Login Form
- Form title: "Log In to Your Account"
- Social login buttons (Google, LinkedIn)
- Divider: "or log in with email"
- **Email input** (required)
- **Password input** (required, show/hide toggle)
- "Remember me" checkbox
- "Forgot password?" link
- "Log In" button (primary, full width)
- Sign up link: "Don't have an account? Sign up"

---

## Interactive Elements

1. **Form Validation:**
   - Email format check
   - Required field validation
   - Real-time error display

2. **Show/Hide Password:** Eye icon toggle

3. **Social OAuth:** Google/LinkedIn authentication flow

4. **Forgot Password:** Opens password reset modal/page

5. **Remember Me:** Persists session for 30 days

6. **Keyboard:** Tab navigation, Enter to submit

---

## Navigation

### FROM
- Marketing website
- Signup page ("Already have account?" link)
- Logout action
- Expired session redirect
- Email links

### TO
- `/dashboard` (successful login → last visited page or home)
- `/signup` (if new user)
- `/forgot-password` (password reset flow)
- `/onboarding` (if account incomplete)

---

## Content

**Headline:** "Welcome Back to Renew"

**Error Messages:**
- "Invalid email or password"
- "Account not found"
- "Please enter your email"
- "Please enter your password"

**Locked Account:** "Too many failed attempts. Try again in 15 minutes or reset your password."

**Success:** Brief flash "Logging you in..." then redirect

---

## States

### 1. Default
- Empty form, ready for input
- Login button enabled

### 2. Filling Form
- Active field has blue border
- Real-time validation

### 3. Validation Error
- Red borders on invalid fields
- Error messages below fields

### 4. Submitting (Loading)
- Button shows spinner: "Logging in..."
- Form disabled

### 5. Authentication Error
- Error banner: "Incorrect email or password"
- Fields remain populated
- Focus on email field

### 6. Account Locked
- Warning message with timer
- "Reset password" link offered

### 7. Success
- Brief success indicator
- Redirect to dashboard (1 second)

---

## Edge Cases

- **OAuth failure:** "Unable to authenticate with [Provider]. Try email login."
- **Network timeout:** "Request timed out. Please try again."
- **Account inactive:** "Your account is inactive. Contact support."
- **Email not verified:** "Please verify your email. [Resend verification](#)"

---

## Accessibility

- Color contrast: 4.5:1 minimum
- Keyboard navigation: Full tab order
- Screen reader labels on all inputs
- Error announcement via aria-live
- Focus management on errors

**ARIA:**
- `role="form"`
- `aria-required="true"` on required fields
- `aria-invalid="true"` on error fields
- `aria-describedby` for error messages

---

## Analytics

**Events:**
1. "login_page_viewed"
2. "login_social_clicked" (provider)
3. "login_submit_attempted"
4. "login_success"
5. "login_error" (error_type)
6. "forgot_password_clicked"
7. "signup_link_clicked"

---

## Technical Notes

**API Endpoint:** `POST /api/auth/login`

**Payload:**
```json
{
  "email": "string",
  "password": "string",
  "remember": boolean
}
```

**Response (200):**
```json
{
  "userId": "string",
  "token": "JWT_string",
  "redirectTo": "string"
}
```

**Response Error (401/429/500):**
```json
{
  "error": "string",
  "message": "string",
  "lockoutEnd": "timestamp" (if locked)
}
```

**Security:**
- HTTPS only
- Rate limiting: 5 attempts per 15 minutes per IP
- Account lockout after 5 failed attempts
- Secure JWT tokens (HttpOnly cookies)
- CSRF protection

---

## Design System References

**Components:** Primary Button, Text Input, Checkbox
**Colors:** Primary `#2D65F8`, Error `#EF4444`
**Typography:** H1 36px Bold, Body 14px Regular
**Spacing:** Form gaps 16px, section padding 32px

---

*Version: 1.0 | Updated: 2025-11-11 | Status: Ready for Development*
