import type { UiCopyKey } from "./ui-copy"

type PublicAuthError = { code?: unknown; status?: unknown } | null | undefined

/** Never render provider prose in the authentication UI. */
export function signInErrorCopy(error: PublicAuthError): UiCopyKey {
  if (error?.status === 429 || error?.code === "TOO_MANY_REQUESTS") {
    return "Too many sign-in attempts. Please try again later."
  }
  if (
    error?.code === "INVALID_EMAIL_OR_PASSWORD" ||
    error?.code === "INVALID_PASSWORD" ||
    error?.code === "USER_NOT_FOUND"
  ) return "Email or password is incorrect."
  return "Sign-in is temporarily unavailable. Please try again."
}
