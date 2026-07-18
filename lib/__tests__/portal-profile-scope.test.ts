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

  it("renders the complete anonymized opportunity facts on every portal list surface", () => {
    const dealList = source("components/opportunities/repreneur-opportunity-list.tsx")
    const profileSummary = source("components/portal/repreneur-profile-summary.tsx")

    for (const surface of [dealList, profileSummary]) {
      for (const field of [
        "Re-New ref",
        "Sector",
        "Revenue",
        "EBITDA",
        "EBITDA margin",
        "Employees",
      ]) {
        expect(surface).toContain(field)
      }
      expect(surface).toContain("teaser_summary")
      expect(surface).toMatch(/line-clamp-[23]/)
      expect(surface).toContain("View detail")
    }

    expect(dealList).toContain("Added {formatDate(opportunity.date_added)}")
    expect(dealList).toContain("opportunity.match_id ?? opportunity.opportunity_id")
    expect(profileSummary).toContain("Date added")
  })

  it("keeps staff-only opportunity data out of the repreneur information contract", () => {
    const opportunityTypes = source("lib/types/opportunity.ts")
    const portalExposureTypes = opportunityTypes.slice(
      opportunityTypes.indexOf("export interface RepreneurOpportunityExposure"),
      opportunityTypes.indexOf("export function getOpportunityStatusLabel"),
    )

    for (const staffOnlyField of [
      "description",
      "internal_notes",
      "source_id",
      "source_label",
      "platform_score",
      "platform_reasons",
      "human_notes",
      "relevance_score",
    ]) {
      expect(portalExposureTypes).not.toContain(staffOnlyField)
    }
  })

  it("opens unmatched deal details without adding response or locked-deal actions", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const detailGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
      portalOpportunities.indexOf("async function updateMyOpportunityResponse"),
    )
    const opportunityDetail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(detailGetter).toContain("activeOwnerByOpportunity.has(opportunity.id)")
    expect(detailGetter).toContain("withoutRelevanceScore(toDealFlowOpportunity(opportunity, repreneur))")
    expect(opportunityDetail).toContain("const interestAction = opportunity.match_id")
    expect(opportunityDetail).toContain("const declineAction = opportunity.match_id")
    expect(opportunityDetail).toContain("{opportunity.match_status ? <Card>")
  })

  it("resolves proposed deal details only through the current repreneur's owned match", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const detailGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
      portalOpportunities.indexOf("async function updateMyOpportunityResponse"),
    )
    const detailPage = source("app/portal/deals/[matchId]/page.tsx")

    expect(detailGetter).toContain('from("opportunity_matches")')
    expect(detailGetter).toContain('.eq("id", dealId)')
    expect(detailGetter).toContain('.eq("repreneur_id", repreneur.id)')
    expect(detailGetter).toContain('.in("status", VISIBLE_MATCH_STATUSES)')
    expect(detailGetter).toContain("if (matchResult.error) throw new Error(matchResult.error.message)")
    expect(detailGetter).toContain("const exposure = matchResult.data ? normalizeExposure(matchResult.data) : null")
    expect(detailPage).toContain("const opportunity = await getMyRepreneurOpportunity(matchId)")
    expect(detailPage).toContain("if (!opportunity)")
    expect(detailPage).toContain("notFound()")
  })
})
