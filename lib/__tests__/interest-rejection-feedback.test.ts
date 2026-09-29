import { describe, expect, it } from "vitest"
import { interestRejectionFeedback } from "@/lib/interest-rejection-feedback"

describe("exact interest rejection staff feedback", () => {
  it.each(["sent", "already_sent"] as const)("confirms only a %s client notice", (status) => {
    expect(interestRejectionFeedback(status)).toContain("was sent")
  })

  it("says an inactive-key notice was not dispatched", () => {
    expect(interestRejectionFeedback("suppressed")).toContain("was not dispatched")
  })

  it.each(["busy", "failed", "review_required"] as const)(
    "never rules out provider acceptance for %s",
    (status) => {
      const message = interestRejectionFeedback(status)
      expect(message).toContain("not confirmed")
      expect(message).not.toContain("was not sent")
      expect(message).not.toContain("was not dispatched")
    },
  )
})
