import { describe, expect, it } from "vitest"
import {
  businessCc,
  businessCategory,
  trackingReadiness,
  plainEmailHtml,
} from "@/lib/email/business-mail-policy"

describe("accepted business email policy", () => {
  it("copies both canonical staff members once, excluding primary recipients", () => {
    expect(
      businessCc([" BERTRAND@RE-NEW.TEAM "], [], ["bertrand@re-new.team", "colin@re-new.team"]),
    ).toEqual(["colin@re-new.team"])
    expect(
      businessCc(
        ["client@example.test"],
        ["Colin@re-new.team", "bertrand@re-new.team"],
        ["bertrand@re-new.team", "colin@re-new.team"],
      ),
    ).toEqual(["colin@re-new.team", "bertrand@re-new.team"])
  })
  it("classifies opportunity correspondence as M&A and access outside business rates", () => {
    expect(businessCategory("interest_outcome_validated")).toBe("ma")
    expect(businessCategory("code:e6_nda_ready")).toBe("ma")
    expect(businessCategory("password_reset")).toBe(null)
  })
  it("keeps reviewed destination links usable while escaping individual prose", () => {
    const html = plainEmailHtml(
      "Bonjour <script>alert(1)</script>\n\nhttps://app.example.test/deals/one?x=1&y=2",
    )
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).toContain('href="https://app.example.test/deals/one?x=1&amp;y=2"')
  })
  it("does not claim tracking capability on the shared access domain", () => {
    expect(
      trackingReadiness({
        businessFrom: "hello@news.re-new.team",
        accessFrom: "access@news.re-new.team",
        verifiedAt: "2026-10-07T10:00:00Z",
        trackingDomain: "track.re-new.team",
      }).verified,
    ).toBe(false)
    expect(
      trackingReadiness({
        businessFrom: "hello@news.re-new.team",
        accessFrom: "access@access.re-new.team",
        verifiedAt: "2026-10-07T10:00:00Z",
        trackingDomain: "track.re-new.team",
      }).verified,
    ).toBe(true)
  })
})
