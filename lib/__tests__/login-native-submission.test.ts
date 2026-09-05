import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-client", () => ({ signIn: { email: vi.fn() } }))
vi.mock("@/lib/actions/waitlist", () => ({ submitWaitlistRequest: vi.fn() }))
vi.mock("@/lib/telemetry/runtime", () => ({ captureWaveEvent: vi.fn() }))

import LoginPage from "@/app/auth/login/page"

describe("login before hydration", () => {
  it("keeps native credential submission out of the URL", () => {
    const html = renderToStaticMarkup(createElement(LoginPage))
    const form = html.match(/<form\b[^>]*>/)?.[0]

    // A missing method defaults to GET before React can prevent submission.
    expect(form).toContain('method="post"')
  })

  it("renders Sign In unavailable until its handler is ready", () => {
    const html = renderToStaticMarkup(createElement(LoginPage))
    const submit = html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]

    expect(submit).toContain('disabled=""')
  })
})
