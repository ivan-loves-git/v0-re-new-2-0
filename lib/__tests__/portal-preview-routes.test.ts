import { describe, expect, it } from "vitest"
import {
  createPortalPreviewDealHrefMap,
  resolvePortalPreviewRepreneur,
} from "@/lib/portal-preview-routes"

describe("portal preview deal routes", () => {
  it("creates serializable exact preview links for every visible deal", () => {
    const hrefs = createPortalPreviewDealHrefMap("repreneur & one", [
      { opportunityId: "opportunity-1", matchId: "match one" },
      { opportunityId: "opportunity-2", matchId: null },
    ])

    expect(hrefs).toStrictEqual({
      "match one": "/portal-preview?repreneurId=repreneur+%26+one&matchId=match+one",
      "opportunity-2": "/portal-preview?repreneurId=repreneur+%26+one",
    })
    expect(Object.values(hrefs).every((href) => typeof href === "string")).toBe(true)
  })

  it("does not replace a stale requested repreneur with the default preview", () => {
    const options = [
      { id: "repreneur-a", email: "a@example.test" },
      { id: "repreneur-b", email: "myworkmail4@gmail.com" },
    ]

    expect(resolvePortalPreviewRepreneur(options, "missing-repreneur")).toBeNull()
    expect(resolvePortalPreviewRepreneur(options, undefined)).toEqual(options[1])
  })
})
