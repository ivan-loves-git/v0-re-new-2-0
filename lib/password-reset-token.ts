// Native recovery tokens and staff-only setup tokens have distinct, bounded
// shapes. A URL's intent is presentation only, never authority to extend TTL.
export const PORTAL_SETUP_TOKEN_PREFIX = "portal_setup_"
export const PASSWORD_RESET_TOKEN_PATTERN = /^(?:[A-Za-z0-9]{24}|portal_setup_[a-f0-9]{48})$/

export const PASSWORD_RESET_TOKEN_STORAGE_KEY = "wave.password-reset-token.v1"

export const PASSWORD_RESET_BROWSER_PATH = "/auth/reset-password"

export const PASSWORD_RESET_PREFLIGHT_PATH =
  "/api/auth/reset-password/preflight"

export function isPasswordResetToken(
  token: string | null | undefined,
): token is string {
  return Boolean(token && PASSWORD_RESET_TOKEN_PATTERN.test(token))
}
