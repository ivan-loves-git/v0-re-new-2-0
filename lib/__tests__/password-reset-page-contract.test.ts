import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("password reset page contract", () => {
  const page = source("app/auth/reset-password/page.tsx")
  const form = source("app/auth/reset-password/reset-password-form.tsx")
  const recovery = source("app/auth/forgot-password/page.tsx")
  const proxy = source("proxy.ts")
  const authRoute = source("app/api/auth/[...all]/route.ts")
  const auth = source("lib/auth.ts")

  it("validates on the server before exposing the password form", () => {
    expect(page).not.toContain('"use client"')
    expect(page).toContain("await connection()")
    expect(page).toContain("validatePasswordResetLink")
    expect(page).toContain("isLinkValid={isLinkValid}")
    expect(form.indexOf("if (!isLinkValid)")).toBeLessThan(
      form.indexOf("<form"),
    )
  })

  it("uses one privacy-safe recovery state for bad or consumed links", () => {
    expect(form).toContain("invalide, a expire ou a deja ete utilise")
    expect(form).toContain(
      'const recoveryHref = portalSetup\n    ? "/auth/forgot-password?intent=portal"',
    )
    expect(form).toContain("href={recoveryHref}")
    expect(form).not.toContain("result.error.message")
    expect(form).not.toContain("err?.message")
  })

  it("keeps a valid token through reload, then scrubs it after use or rejection", () => {
    expect(form).toContain("if (!isLinkValid) scrubResetTokenFromUrl()")
    expect(form).toContain('result.error.code === "INVALID_TOKEN"')
    expect(form).toContain("scrubResetTokenFromUrl()")
    expect(form).toContain("window.history.replaceState")
    expect(form).toContain('window.addEventListener("pageshow"')
    expect(form).toContain("router.refresh()")
    expect(form).not.toContain('result.error.message')
    expect(form).toContain("Impossible de terminer maintenant")
  })

  it("preserves portal recovery intent with localized, non-enumerating copy", () => {
    expect(recovery).toContain('searchParams.get("intent") === "portal"')
    expect(recovery).toContain(
      'redirectTo: portalSetup\n          ? "/auth/reset-password?intent=portal"',
    )
    expect(recovery).toContain("Si cette adresse est associee")
    expect(recovery).not.toContain("result.error.message")
    expect(recovery).not.toContain("err?.message")
  })

  it("prevents reset tokens from being cached, indexed or sent as referrers", () => {
    expect(proxy).toContain('pathname === "/auth/reset-password"')
    expect(proxy).toContain(
      'response.headers.set("Cache-Control", "private, no-store, max-age=0")',
    )
    expect(proxy).toContain('response.headers.set("Pragma", "no-cache")')
    expect(proxy).toContain(
      'response.headers.set("Referrer-Policy", "no-referrer")',
    )
    expect(proxy).toContain(
      'response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")',
    )
  })

  it("guards the native reset mutation with current role and revocation authority", () => {
    expect(authRoute).toContain('pathname === "/api/auth/reset-password"')
    expect(authRoute).toContain('"/api/auth/request-password-reset"')
    expect(authRoute).toContain("withPasswordResetAuthority")
    expect(authRoute).toContain(
      'pathname.startsWith("/api/auth/reset-password/")',
    )
    expect(authRoute).toContain('code: "INVALID_TOKEN"')
    expect(authRoute).not.toContain("console.error(error")
    const resetHook = auth.indexOf("sendResetPassword:")
    const deliveryAuthority = auth.indexOf(
      "await authorizePasswordResetDelivery",
      resetHook,
    )
    const providerSend = auth.indexOf("await resend.emails.send", resetHook)
    expect(resetHook).toBeGreaterThanOrEqual(0)
    expect(deliveryAuthority).toBeGreaterThan(resetHook)
    expect(deliveryAuthority).toBeLessThan(providerSend)
    expect(auth).toContain('"/request-password-reset"')
    expect(auth).not.toContain('"/forget-password"')
  })
})
