import { describe, expect, it } from "vitest"
import { repreneurWriteErrorMessage } from "@/lib/repreneur-write-error"

describe("repreneur write feedback", () => {
  it("turns duplicate email persistence failures into a staff repair instruction", () => {
    expect(
      repreneurWriteErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "repreneurs_email_key"',
      }),
    ).toBe("This email already belongs to another Repreneur. Open the existing profile or use a different email.")
  })

  it("keeps a safe generic message for unrelated persistence failures", () => {
    expect(repreneurWriteErrorMessage({ code: "XX000", message: "internal detail" })).toBe(
      "We could not save this Repreneur. Please try again.",
    )
  })
})
