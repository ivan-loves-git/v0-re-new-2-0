import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("M2 journey requested-event semantics", () => {
  it("labels repreneur requests with the fixed portal workflow vocabulary", () => {
    const lockedInterest = source("components/opportunities/locked-opportunity-interest-action.tsx")
    const matchedInterest = source("components/opportunities/repreneur-opportunity-detail.tsx")
    const decline = source("components/opportunities/repreneur-opportunity-decline-action.tsx")
    const ndaUpload = source("components/opportunities/repreneur-nda-signature-upload.tsx")

    for (const interestSource of [lockedInterest, matchedInterest]) {
      expect(interestSource).toContain('data-wave-action="express_interest"')
      expect(interestSource).toContain('data-wave-workflow="portal_deals"')
    }
    expect(decline).toContain('data-wave-action="decline"')
    expect(decline).toContain('data-wave-workflow="portal_deals"')
    expect(ndaUpload).toContain('data-wave-action="upload"')
    expect(ndaUpload).toContain('data-wave-workflow="portal_pursuit"')
  })

  it("labels staff pursuit requests without exposing record context", () => {
    const pursuitPanel = source("components/opportunities/opportunity-pursuit-panel.tsx")

    expect(pursuitPanel).toContain('data-wave-action="confirm"')
    expect(pursuitPanel).toContain('data-wave-action="update"')
    expect(pursuitPanel).toContain('data-wave-workflow="portal_pursuit"')
    expect(pursuitPanel).not.toContain("data-wave-opportunity")
    expect(pursuitPanel).not.toContain("data-wave-match")
    expect(pursuitPanel).not.toContain("data-wave-document")
  })
})
