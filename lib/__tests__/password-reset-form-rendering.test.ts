import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}))

import { ResetPasswordForm } from "@/app/auth/reset-password/reset-password-form"

function renderResetForm() {
  return renderToStaticMarkup(
    createElement(ResetPasswordForm, {
      portalSetup: true,
    }),
  )
}

describe("password reset form rendering", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does not render password fields before client preflight", () => {
    const markup = renderResetForm()

    expect(markup).not.toContain('name="password"')
    expect(markup).not.toContain('name="confirmPassword"')
    expect(markup).toContain("Validation du lien...")
  })
})
