import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("repreneur portal profile scope", () => {
  it("reads only the profile fields required by the portal", () => {
    const profileAction = source("lib/actions/repreneur-profile.ts")
    const profileData = source("lib/data/portal-profile.ts")

    expect(profileAction.indexOf("requirePortalAccess")).toBeLessThan(profileAction.indexOf("createAdminClient"))
    expect(profileAction).toContain("PORTAL_REPRENEUR_PROFILE_SELECT")
    expect(profileAction).not.toContain('select("*")')
    expect(profileAction).not.toContain("leadership_assessments")

    for (const requiredField of [
      "q13_target_sectors_v2",
      "q12_geo_zones",
      "q14_deal_size",
      "target_revenue_min_meur",
      "target_ebitda_margin_min_pct",
      "target_staff_size_min",
    ]) {
      expect(profileData).toContain(requiredField)
    }
  })

  it("keeps staff scoring and recommendation fields out of portal opportunity responses", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const portalExposureType = source("lib/types/opportunity.ts").slice(
      source("lib/types/opportunity.ts").indexOf("export interface RepreneurOpportunityExposure"),
    )

    for (const staffOnlyField of [
      "platform_recommendation",
      "platform_score",
      "platform_reasons",
      "human_recommendation",
    ]) {
      expect(portalOpportunities).not.toContain(staffOnlyField)
      expect(portalExposureType).not.toContain(staffOnlyField)
    }
  })

  it("renders only the approved profile sections", () => {
    const profileSummary = source("components/portal/repreneur-profile-summary.tsx")

    expect(profileSummary).toContain("Target thesis")
    expect(profileSummary).toContain("Readiness milestones")
    expect(profileSummary).toContain("Proposed deals")
    expect(profileSummary).toContain("Pursued deals")

    for (const staffOnlySurface of [
      "RepreneurRadarChart",
      "RecommendationBadge",
      "who_score",
      "when_score",
      "platform_score",
      "Strengths",
    ]) {
      expect(profileSummary).not.toContain(staffOnlySurface)
    }
  })
})
