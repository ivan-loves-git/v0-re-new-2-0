import {
  isAllowedMcpRedirectUri,
  mcpLoginRedirectPath,
  type McpDestination,
} from "@/lib/mcp/oauth-policy"

/**
 * WAVE's staff step in front of Better Auth's authorization (#265).
 *
 * Signed-out people sign in first; non-staff are refused before a code
 * exists; staff confirm on a WAVE page whose same-site POST issues the code.
 * Following a link alone therefore never connects an account.
 */

export type WaveRole = "staff" | "repreneur" | "unassigned"

export type AuthorizeStep =
  | { kind: "invalid" }
  | { kind: "login"; location: string }
  | { kind: "forbidden" }
  | { kind: "confirm"; location: string }

export function hasValidAuthorizeRequest(params: URLSearchParams) {
  return (
    Boolean(params.get("client_id")) &&
    params.get("response_type") === "code" &&
    Boolean(params.get("code_challenge")) &&
    params.get("code_challenge_method") === "S256" &&
    isAllowedMcpRedirectUri(params.get("redirect_uri"))
  )
}

/** `role` is null when nobody is signed in. */
export function nextAuthorizeStep(params: URLSearchParams, role: WaveRole | null): AuthorizeStep {
  if (!hasValidAuthorizeRequest(params)) return { kind: "invalid" }
  if (role === null) return { kind: "login", location: mcpLoginRedirectPath(params) }
  if (role !== "staff") return { kind: "forbidden" }
  return { kind: "confirm", location: `/auth/connect?${params.toString()}` }
}

/**
 * Better Auth's token step splits the account's display name and fails when
 * it is empty, so WAVE stops earlier with an explanation instead.
 */
export function lacksDisplayName(user: { name?: string | null }) {
  return !user.name?.trim()
}

export const MISSING_DISPLAY_NAME =
  "Your WAVE account has no display name, which the sign-in needs. Ask Ivan to add your name, then try again."

const HOSTED_APP_NAMES: Record<Exclude<McpDestination, "this_computer">, string> = {
  claude_app: "Claude",
  chatgpt: "ChatGPT",
}

/**
 * Confirmation-page wording. It names the destination WAVE enforces, never the
 * client's self-chosen name. A hosted app's sign-in delivers access to whichever
 * account started it, so those pages also warn against forwarded links.
 */
export function connectionCopy(destination: McpDestination, email: string) {
  if (destination === "this_computer") {
    return {
      title: "Connect an app on this computer to WAVE",
      description: `An app on this computer, such as Claude Code or Codex, is asking to read WAVE as ${email}.`,
      caution:
        "Only continue if you started this yourself just now from Claude Code, Codex or another app on this computer.",
      warning: null,
    }
  }
  const app = HOSTED_APP_NAMES[destination]
  return {
    title: destination === "claude_app" ? "Connect the Claude app to WAVE" : "Connect ChatGPT to WAVE",
    description: `The ${app} account that started this connection is asking to read WAVE as ${email}.`,
    caution: `Only continue if you started this from ${app} yourself just now.`,
    warning: `If someone sent you this link, press Cancel: approving would give their ${app} account your read access to WAVE.`,
  }
}

/** Cancelling tells the app's waiting sign-in that access was refused. */
export function cancelledAuthorizeLocation(params: URLSearchParams) {
  const target = new URL(params.get("redirect_uri")!)
  target.searchParams.set("error", "access_denied")
  const state = params.get("state")
  if (state) target.searchParams.set("state", state)
  return target.toString()
}

/** The confirmation must come from a WAVE page, never from another site. */
export function isSameOriginPost(headers: Headers, origin: string) {
  return headers.get("origin") === origin
}

/**
 * Accepts Better Auth's answer only when it is a redirect back to the exact
 * callback Claude asked for, carrying a code.
 */
export function issuedCodeLocation(response: Response, redirectUri: string) {
  if (response.status < 300 || response.status >= 400) return null
  const location = response.headers.get("location")
  if (!location) return null
  try {
    const target = new URL(location)
    const expected = new URL(redirectUri)
    if (`${target.origin}${target.pathname}` !== `${expected.origin}${expected.pathname}`) {
      return null
    }
    return target.searchParams.get("code") ? location : null
  } catch {
    return null
  }
}
