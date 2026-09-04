import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { proxy } from "../../proxy"

const privacyHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

describe("password reset response privacy", () => {
  it("makes reset links non-cacheable, non-indexable and non-referring", async () => {
    const response = await proxy(
      new NextRequest(
        "https://app.re-new.team/auth/reset-password?token=abcdefghijklmnopqrstuvwx",
      ),
    )

    for (const [header, value] of Object.entries(privacyHeaders)) {
      expect(response.headers.get(header)).toBe(value)
    }
  })

  it("does not add reset-link privacy headers to another auth route", async () => {
    const response = await proxy(
      new NextRequest("https://app.re-new.team/auth/forgot-password"),
    )

    for (const header of Object.keys(privacyHeaders)) {
      expect(response.headers.get(header)).toBeNull()
    }
  })
})
