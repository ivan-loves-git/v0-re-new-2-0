import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}))

import { ResetPasswordForm } from "@/app/auth/reset-password/reset-password-form"

function renderResetForm({
  token,
  isLinkValid,
}: {
  token: string | null
  isLinkValid: boolean
}) {
  return renderToStaticMarkup(
    createElement(ResetPasswordForm, {
      token,
      isLinkValid,
      portalSetup: true,
    }),
  )
}

describe("password reset form rendering", () => {
  beforeEach(() => vi.clearAllMocks())

  it("renders both password fields for a server-validated invitation", () => {
    const markup = renderResetForm({
      token: "aB3dE5gH7jK9mN2pQ4sT6vX8",
      isLinkValid: true,
    })

    expect(markup).toContain('name="password"')
    expect(markup).toContain('name="confirmPassword"')
    expect(markup).toContain("Creer mon mot de passe")
  })

  it.each([
    ["missing", null],
    ["rejected", "aB3dE5gH7jK9mN2pQ4sT6vX8"],
  ])("does not render password fields for a %s invitation", (_case, token) => {
    const markup = renderResetForm({ token, isLinkValid: false })

    expect(markup).not.toContain('name="password"')
    expect(markup).not.toContain('name="confirmPassword"')
    expect(markup).toContain("Demander un nouveau lien")
  })
})
