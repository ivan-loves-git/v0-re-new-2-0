import { APIError, createAuthMiddleware } from "better-auth/api"
import { mcp } from "better-auth/plugins"
import { areAllowedMcpRedirectUris } from "@/lib/mcp/oauth-policy"

/**
 * Better Auth settings for the staff Claude connection (#265), shared by the
 * production auth instance and its disposable rehearsal.
 *
 * Sign-in starts at WAVE's own /api/mcp/authorize staff step; the plugin's
 * public authorize route is closed in the auth route handler.
 */
export function staffMcpPlugin(origin: string) {
  return mcp({
    loginPage: "/auth/login",
    resource: `${origin}/api/mcp`,
    oidcConfig: {
      loginPage: "/auth/login",
      defaultScope: "openid profile email offline_access",
      requirePKCE: true,
      refreshTokenExpiresIn: 30 * 24 * 60 * 60,
    },
  })
}

function bodyFields(body: unknown): Record<string, unknown> {
  if (body instanceof FormData || body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries())
  }
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {}
}

/**
 * The plugin issues a new refresh token on every refresh but keeps the old
 * one valid. Retire the presented token once its successor exists, so a
 * copied refresh token cannot be replayed alongside Claude's own.
 */
export const staffMcpRefreshRotation = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/mcp/token") return
  const fields = bodyFields(ctx.body)
  if (fields.grant_type !== "refresh_token" || typeof fields.refresh_token !== "string") return
  if (ctx.context.returned === undefined || ctx.context.returned instanceof Error) return
  await ctx.context.adapter.delete({
    model: "oauthAccessToken",
    where: [{ field: "refreshToken", value: fields.refresh_token }],
  })
})

/** A registered client may only return codes to Claude itself. */
export const staffMcpRegistrationGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/mcp/register") return
  const redirectUris = (ctx.body as { redirect_uris?: unknown } | undefined)?.redirect_uris
  if (!areAllowedMcpRedirectUris(redirectUris)) {
    throw new APIError("BAD_REQUEST", {
      error: "invalid_redirect_uri",
      error_description:
        "WAVE only accepts Claude's own callback addresses for this connection.",
    })
  }
})
