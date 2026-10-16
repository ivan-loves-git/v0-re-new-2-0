/**
 * HTTP pieces of the staff Claude connection (#265): discovery documents,
 * the staff gate in front of every MCP request, and its refusal responses.
 */

export const MCP_PATH = "/api/mcp"
export const MCP_SCOPES = ["openid", "profile", "email", "offline_access"]

export function protectedResourceMetadataUrl(origin: string) {
  return `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`
}

/** RFC 9728: tells Claude which server signs people in for this endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [origin],
    scopes_supported: MCP_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Re-New WAVE (read-only)",
  }
}

/**
 * RFC 8414. Sign-in starts at WAVE's own staff authorize step; token
 * exchange and client registration are Better Auth's MCP endpoints.
 */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/authorize`,
    token_endpoint: `${origin}/api/auth/mcp/token`,
    registration_endpoint: `${origin}/api/auth/mcp/register`,
    scopes_supported: MCP_SCOPES,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [
      "none",
      "client_secret_basic",
      "client_secret_post",
    ],
    code_challenge_methods_supported: ["S256"],
  }
}

export function metadataResponse(body: unknown) {
  return Response.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  })
}

export type StaffGateResult =
  | { status: "staff"; userId: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" }

export interface StaffGateDependencies {
  /** The user id behind a valid, unexpired access token, or null. */
  findTokenUserId: (headers: Headers) => Promise<string | null>
  /** The user's current WAVE role, read fresh on every request. */
  findRole: (userId: string) => Promise<"staff" | "repreneur" | "unassigned" | null>
}

/** Only a current staff account gets data; a revoked staff role stops at the next request. */
export async function checkMcpStaff(
  headers: Headers,
  dependencies: StaffGateDependencies,
): Promise<StaffGateResult> {
  if (!headers.get("authorization")?.startsWith("Bearer ")) {
    return { status: "unauthenticated" }
  }
  const userId = await dependencies.findTokenUserId(headers)
  if (!userId) return { status: "unauthenticated" }
  const role = await dependencies.findRole(userId)
  if (role === null) return { status: "unauthenticated" }
  return role === "staff" ? { status: "staff", userId } : { status: "forbidden" }
}

function jsonRpcError(status: number, message: string, headers: HeadersInit = {}) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status, headers },
  )
}

export function unauthenticatedResponse(origin: string) {
  return jsonRpcError(401, "Sign in to WAVE to use this connection.", {
    "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl(origin)}", scope="${MCP_SCOPES.join(" ")}"`,
    "Access-Control-Expose-Headers": "WWW-Authenticate",
  })
}

export function forbiddenResponse() {
  return jsonRpcError(
    403,
    "This WAVE account is not a staff account, so it cannot use the staff connection.",
  )
}
