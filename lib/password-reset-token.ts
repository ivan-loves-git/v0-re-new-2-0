export const PASSWORD_RESET_TOKEN_PATTERN = /^[A-Za-z0-9]{24}$/

export const PASSWORD_RESET_TOKEN_STORAGE_KEY = "wave.password-reset-token.v1"

export const PASSWORD_RESET_BROWSER_PATH = "/auth/reset-password"

export const PASSWORD_RESET_PREFLIGHT_PATH =
  "/api/auth/reset-password/preflight"

export function isPasswordResetToken(
  token: string | null | undefined,
): token is string {
  return Boolean(token && PASSWORD_RESET_TOKEN_PATTERN.test(token))
}
