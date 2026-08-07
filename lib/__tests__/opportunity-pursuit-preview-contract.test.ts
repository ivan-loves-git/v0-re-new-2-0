import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const projectionSource = fs.readFileSync(path.join(process.cwd(), "lib/data/opportunity-pursuit-projection.ts"), "utf8")
const previewPageSource = fs.readFileSync(path.join(process.cwd(), "app/(dashboard)/portal-preview/page.tsx"), "utf8")
const panelSource = fs.readFileSync(path.join(process.cwd(), "components/opportunities/opportunity-pursuit-panel.tsx"), "utf8")

describe("portal preview and pursuit action contract", () => {
  it("passes the same canonical, sanitized pursuit projection to the staff preview", () => {
    expect(projectionSource).toContain("getStaffPortalPreviewPursuitProjection")
    expect(projectionSource).toContain("journey_repreneur_can_access_confidential")
    expect(projectionSource).toContain("firmName: projection.confidentialGrant.source_firm_name")
    expect(projectionSource).toContain("contactNames: (projection.confidentialGrant.disclosed_contacts ?? [])")
    expect(projectionSource).not.toContain("email: projection.confidentialGrant.source")
    expect(previewPageSource).toContain("getStaffPortalPreviewPursuitProjection(selectedOpportunity.match_id, selectedRepreneurId)")
  })

  it("permits a regrant only when the existing grant is no longer canonically live", () => {
    expect(projectionSource).toContain("hasLiveConfidentialGrant && projection.nextAction === \"grant_confidential_access\"")
    expect(panelSource).toContain("!hasLiveGrant && <form")
    expect(panelSource).toContain("Confidential access is no longer live")
  })

  it("does not expose Continue or Complete before their canonical predecessors", () => {
    expect(projectionSource).toContain("hasContinuedCurrentCycle = currentCycleEntries.some")
    expect(projectionSource).toContain("hasLiveConfidentialGrant && !hasContinuedCurrentCycle")
    expect(projectionSource).toContain("hasLiveConfidentialGrant && hasContinuedCurrentCycle")
    expect(panelSource).toContain("const canComplete = projection?.allowedActions.includes(\"complete\")")
    expect(panelSource).toContain("const canDrop = projection?.allowedActions.includes(\"drop\")")
  })
})
