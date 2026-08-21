import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  unstableRethrow: vi.fn(),
}))

vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.unstableRethrow }))

import { rethrowNextNavigationControlFlow } from "@/lib/utils/next-navigation-control-flow"

describe("Next navigation control flow", () => {
  it("rethrows a successful server-action redirect instead of letting a form report it as a failure", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/repreneurs/repreneur-1;307;",
    })
    mocks.unstableRethrow.mockImplementation((error: unknown) => {
      throw error
    })

    expect(() => rethrowNextNavigationControlFlow(redirect)).toThrow(redirect)
    expect(mocks.unstableRethrow).toHaveBeenCalledWith(redirect)
  })

  it("leaves an ordinary persistence error available for the form's friendly feedback", () => {
    const error = new Error("This email already belongs to another Repreneur.")
    mocks.unstableRethrow.mockImplementation(() => undefined)

    expect(() => rethrowNextNavigationControlFlow(error)).not.toThrow()
  })
})
