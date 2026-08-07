import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const detailSource = fs.readFileSync(
  path.join(process.cwd(), "components/opportunities/repreneur-opportunity-detail.tsx"),
  "utf8",
)
const pursuitSource = fs.readFileSync(
  path.join(process.cwd(), "components/opportunities/opportunity-pursuit-panel.tsx"),
  "utf8",
)

describe("canonical source disclosure UI", () => {
  it("renders only the granted source names beside the exact information memorandum", () => {
    expect(detailSource).toContain("memoAvailable && journey?.confidentialGrant")
    expect(detailSource).toContain("journey.confidentialGrant.source.firmName")
    expect(detailSource).toContain("journey.confidentialGrant.source.officeName")
    expect(detailSource).toContain("journey.confidentialGrant.source.contactNames")
    expect(detailSource).not.toContain("source_firm_id")
    expect(detailSource).not.toContain("contact.email")
  })

  it("requires an explicit NDA expiry when staff grants the exact IM", () => {
    expect(pursuitSource).toContain('name="nda_expires_at"')
    expect(pursuitSource).toContain(
      "grantOpportunityPursuitConfidentialAccess(activeMatch.id, documentId, ndaExpiresAt)",
    )
  })
})
