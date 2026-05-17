import { type NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  // Check for Better Auth session cookie (works in Edge runtime)
  // The actual session validation happens in server components/actions
  // In production, cookies have __Secure- prefix
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token")
  const isLoggedIn = !!sessionCookie?.value
  const { pathname } = request.nextUrl

  // Protected routes - require authentication
  const protectedPaths = [
    "/dashboard",
    "/repreneurs",
    "/pipeline",
    "/offers",
    "/journey",
    "/emails",
    "/guide",
    "/opportunities",
    "/my-opportunities",
    "/account",
    "/settings",
    "/tasks",
  ]
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  )

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !isLoggedIn) {
    const loginUrl = new URL("/auth/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect root to dashboard if logged in
  if (pathname === "/" && isLoggedIn) {
    const dashboardUrl = new URL("/dashboard", request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (pathname === "/auth/login" && isLoggedIn) {
    const dashboardUrl = new URL("/dashboard", request.url)
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
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
