import { type NextRequest, NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  // Check for Better Auth session cookie (works in Edge runtime)
  // The actual session validation happens in server components/actions
  // In production, cookies have __Secure- prefix
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token")
  const isLoggedIn = !!sessionCookie?.value
  const { pathname } = request.nextUrl
  const isStrategicPdr = pathname === "/strategic-pdr" || pathname.startsWith("/strategic-pdr/")
  const applyStrategicPdrPrivacyHeaders = (response: NextResponse) => {
    if (isStrategicPdr) {
      response.headers.set("Cache-Control", "private, no-store, max-age=0")
      response.headers.set("Pragma", "no-cache")
      response.headers.set("Referrer-Policy", "no-referrer")
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    }
    return response
  }

  if (pathname === "/my-opportunities" || pathname.startsWith("/my-opportunities/")) {
    const suffix = pathname.slice("/my-opportunities".length)
    const redirectUrl = new URL(`/portal/deals${suffix}`, request.url)
    redirectUrl.search = request.nextUrl.search
    return NextResponse.redirect(redirectUrl, 308)
  }

  // Protected routes - require authentication
  const protectedPaths = [
    "/dashboard",
    "/dashboard_re",
    "/dashboard_op",
    "/analytics",
    "/analytics_re",
    "/analytics_op",
    "/repreneurs",
    "/pipeline",
    "/offers",
    "/journey",
    "/emails",
    "/guide",
    "/opportunities",
    "/my-opportunities",
    "/portal",
    "/routing",
    "/account",
    "/settings",
    "/scrapbook",
    "/tasks",
    "/strategic-pdr",
  ]
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !isLoggedIn) {
    const loginUrl = new URL("/auth/login", request.url)
    return applyStrategicPdrPrivacyHeaders(NextResponse.redirect(loginUrl))
  }

  // Redirect root through role routing if logged in
  if (pathname === "/" && isLoggedIn) {
    const routingUrl = new URL("/routing", request.url)
    return NextResponse.redirect(routingUrl)
  }

  // Redirect through role routing if already logged in and trying to access login
  if (pathname === "/auth/login" && isLoggedIn) {
    const routingUrl = new URL("/routing", request.url)
    return NextResponse.redirect(routingUrl)
  }

  if (pathname === "/auth/reset-password") {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "private, no-store, max-age=0")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Referrer-Policy", "no-referrer")
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")
    return response
  }

  return applyStrategicPdrPrivacyHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - api/auth (Better Auth API routes)
     * - intake (public intake form)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/auth|intake).*)",
  ],
}
