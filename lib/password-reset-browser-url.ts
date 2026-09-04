import {
  isPasswordResetToken,
  PASSWORD_RESET_BROWSER_PATH,
} from "@/lib/password-reset-token"

/**
 * Builds an email link whose credential stays in the browser fragment. URL
 * fragments are not included in HTTP requests, proxy logs, or referrers.
 */
export function buildPasswordResetBrowserUrl(
  baseUrl: string,
  token: string,
  portalSetup: boolean,
) {
  if (!isPasswordResetToken(token)) {
    throw new Error("Invalid password-reset token format.")
  }

  const url = new URL(PASSWORD_RESET_BROWSER_PATH, baseUrl)
  if (portalSetup) url.searchParams.set("intent", "portal")
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}
