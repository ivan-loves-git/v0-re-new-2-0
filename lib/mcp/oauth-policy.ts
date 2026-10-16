/**
 * Sign-in rules for the staff Claude connection (#265).
 *
 * A registered OAuth client may only send authorization codes to the loopback
 * listener an app such as Claude Code or Codex opens on the staff member's own
 * computer, or to the hosted connector callbacks of the Claude app (#273) and
 * ChatGPT. A hosted callback delivers the code to whichever account started
 * the sign-in, so the confirmation page warns staff never to approve a
 * sign-in someone sent them.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
const CLAUDE_APP_CALLBACKS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
])
// ChatGPT uses the stable callback only for servers with RFC 9207 issuer
// identification; otherwise one callback id per connection.
const CHATGPT_STABLE_CALLBACK = "https://chatgpt.com/connector_platform_oauth_redirect"
const CHATGPT_CALLBACK_ID_PATH = /^\/connector\/oauth\/[A-Za-z0-9_-]{1,128}$/

export type McpDestination = "this_computer" | "claude_app" | "chatgpt"

export const MCP_AUTHORIZE_PATH = "/api/mcp/authorize"
export const MCP_CONTINUE_PARAM = "mcp_continue"

/** The OAuth request fields WAVE forwards to Better Auth; anything else is dropped. */
export const MCP_AUTHORIZE_FIELDS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
  "nonce",
  "resource",
] as const

/** Where a callback delivers the code, or null when WAVE refuses it. */
export function mcpRedirectDestination(value: unknown): McpDestination | null {
  // Better Auth stores the list comma-joined, so a comma could smuggle in a
  // second address after this check.
  if (typeof value !== "string" || value.length > 2048 || value.includes(",")) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.username || url.password || url.hash) return null
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return "this_computer"
  if (url.search) return null
  const address = `${url.origin}${url.pathname}`
  if (CLAUDE_APP_CALLBACKS.has(address)) return "claude_app"
  if (address === CHATGPT_STABLE_CALLBACK) return "chatgpt"
  if (url.origin === "https://chatgpt.com" && CHATGPT_CALLBACK_ID_PATH.test(url.pathname)) {
    return "chatgpt"
  }
  return null
}

export function isAllowedMcpRedirectUri(value: unknown): boolean {
  return mcpRedirectDestination(value) !== null
}

export function areAllowedMcpRedirectUris(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 10 &&
    value.every(isAllowedMcpRedirectUri)
  )
}

/** Keeps only the known OAuth fields, each as a single string value. */
export function pickMcpAuthorizeParams(
  source: URLSearchParams | FormData,
): URLSearchParams {
  const picked = new URLSearchParams()
  for (const field of MCP_AUTHORIZE_FIELDS) {
    const value = source.get(field)
    if (typeof value === "string" && value.length > 0 && value.length <= 2048) {
      picked.set(field, value)
    }
  }
  return picked
}

/**
 * The login page may only continue to WAVE's own authorize step. Any other
 * value is ignored so the parameter can never become an open redirect.
 */
export function safeMcpContinuation(value: string | null | undefined) {
  if (!value || !value.startsWith(`${MCP_AUTHORIZE_PATH}?`)) return null
  if (value.includes("\\")) return null
  try {
    const base = "https://wave.invalid"
    const url = new URL(value, base)
    if (url.origin !== base || url.pathname !== MCP_AUTHORIZE_PATH) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export function mcpLoginRedirectPath(authorizeParams: URLSearchParams) {
  const continuation = `${MCP_AUTHORIZE_PATH}?${authorizeParams.toString()}`
  const login = new URLSearchParams({ [MCP_CONTINUE_PARAM]: continuation })
  return `/auth/login?${login.toString()}`
}
