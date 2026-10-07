import { PROJECT } from "./project.mjs"

export async function verifyRepreneurAccess(env, fetchImpl) {
  let cookie
  const result = {
    schema: 1, command: "role", state: "failed", readOnly: false,
    loginSucceeded: false, staffEmailsDenied: false, qaSessionClosed: null,
    sessionMaterialPersisted: false,
  }
  try {
    const login = await fetchImpl(`${PROJECT.appOrigin}/api/auth/sign-in/email`, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", Origin: PROJECT.appOrigin },
      body: JSON.stringify({ email: env.QA_REPRENEUR_EMAIL, password: env.QA_REPRENEUR_PASSWORD, rememberMe: false }),
    })
    const lines = login.headers.getSetCookie()
    if (lines.some(line => /^(?:__Secure-|__Host-)?better-auth\.session_token=/.test(line))) {
      cookie = lines.map(line => line.split(";")[0]).join("; ")
    }
    if (!login.ok || !cookie) return result
    result.loginSucceeded = true
    const page = await fetchImpl(`${PROJECT.appOrigin}/emails`, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { Cookie: cookie },
    })
    if ([302, 303, 307, 308].includes(page.status)) {
      const location = new URL(page.headers.get("location") ?? "", PROJECT.appOrigin)
      result.staffEmailsDenied = location.origin === PROJECT.appOrigin && location.pathname === "/portal/deals"
    } else if (page.status === 200) {
      const html = await page.text()
      result.staffEmailsDenied = html.includes("NEXT_REDIRECT;replace;/portal/deals;307;")
        && !html.includes("Monitor delivery, manage templates, and send workflow communications")
    }
  } catch {
    // Never export HTML, cookies, provider errors or the login response body.
  } finally {
    if (cookie) {
      try {
        const logout = await fetchImpl(`${PROJECT.appOrigin}/api/auth/sign-out`, {
          method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
          headers: { Cookie: cookie, Origin: PROJECT.appOrigin, "Content-Type": "application/json" }, body: "{}",
        })
        result.qaSessionClosed = logout.ok
      } catch { result.qaSessionClosed = false }
      cookie = undefined
    }
  }
  result.state = result.staffEmailsDenied && result.qaSessionClosed ? "verified" : "failed"
  return result
}
