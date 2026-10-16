import { NextResponse } from "next/server"
import { getCurrentUserAccessFromHeaders } from "@/lib/access-control"
import {
  MISSING_DISPLAY_NAME,
  hasValidAuthorizeRequest,
  isSameOriginPost,
  issuedCodeLocation,
  lacksDisplayName,
  nextAuthorizeStep,
} from "@/lib/mcp/authorize-flow"
import { mcpLoginRedirectPath, pickMcpAuthorizeParams } from "@/lib/mcp/oauth-policy"
import { mcpOrigin } from "@/lib/mcp/origin"
import { requestAuthorizationCode } from "@/lib/mcp/runtime"

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
}

function plainText(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  })
}

const INVALID_REQUEST =
  "This Claude connection request is not valid. In Claude, remove the WAVE connection and add it again."
const NOT_STAFF =
  "This WAVE account is not a staff account, so it cannot connect Claude to WAVE."

function redirectTo(path: string, request: Request, status = 307) {
  const response = NextResponse.redirect(new URL(path, request.url), status)
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(name, value)
  return response
}

/** Claude opens this page in the browser to start the WAVE sign-in. */
export async function GET(request: Request) {
  const params = pickMcpAuthorizeParams(new URL(request.url).searchParams)
  const access = await getCurrentUserAccessFromHeaders(request.headers)
  const step = nextAuthorizeStep(params, access?.role ?? null)
  switch (step.kind) {
    case "invalid":
      return plainText(400, INVALID_REQUEST)
    case "forbidden":
      return plainText(403, NOT_STAFF)
    case "login":
    case "confirm":
      return redirectTo(step.location, request)
  }
}

/** The staff member pressed Allow on /auth/connect. */
export async function POST(request: Request) {
  if (!isSameOriginPost(request.headers, mcpOrigin())) {
    return plainText(403, INVALID_REQUEST)
  }
  const form = await request.formData().catch(() => null)
  if (!form) return plainText(400, INVALID_REQUEST)
  const params = pickMcpAuthorizeParams(form)
  if (!hasValidAuthorizeRequest(params)) return plainText(400, INVALID_REQUEST)

  const access = await getCurrentUserAccessFromHeaders(request.headers)
  if (!access) return redirectTo(mcpLoginRedirectPath(params), request, 303)
  if (access.role !== "staff") return plainText(403, NOT_STAFF)
  if (lacksDisplayName(access.user)) return plainText(409, MISSING_DISPLAY_NAME)

  const response = await requestAuthorizationCode(params, request.headers.get("cookie"))
  const location = issuedCodeLocation(response, params.get("redirect_uri")!)
  if (!location) return plainText(400, INVALID_REQUEST)
  console.info(JSON.stringify({ event: "wave_mcp.connected", userId: access.user.id }))
  return redirectTo(location, request, 303)
}
