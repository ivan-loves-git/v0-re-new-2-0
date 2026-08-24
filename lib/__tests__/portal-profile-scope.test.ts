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

  it("keeps the deal flow compact while retaining complete facts in profile and detail", () => {
    const dealList = source("components/opportunities/repreneur-opportunity-list.tsx")
    const profileSummary = source("components/portal/repreneur-profile-summary.tsx")
    const dealDetail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    for (const field of ["Re-New ref", "Sector", "Revenue", "EBITDA", "EBITDA margin", "Employees"]) {
      expect(profileSummary).toContain(field)
    }
    for (const field of ["Re-New ref", "Sector", "Revenue", "EBITDA", "EBITDA margin", "Team"]) {
      expect(dealDetail).toContain(field)
    }
    expect(profileSummary).toContain("teaser_summary")
    expect(dealDetail).toContain("teaser_summary")

    for (const field of ["Re-New ref", "Sector", "Revenue", "EBITDA", "EBITDA margin", "Employees"]) {
      expect(dealList).toContain(field)
    }
    expect(dealList).not.toContain("teaser_summary")
    expect(dealList).not.toMatch(/line-clamp-[23]/)
    expect(dealList).toContain("View detail")
    expect(profileSummary).toContain("View detail")
    expect(dealList).toContain('Added {opportunity.date_added_display ?? "-"}')
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

  it("opens eligible unmatched deal details with the self-interest action", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const detailGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
      portalOpportunities.indexOf("async function updateMyOpportunityResponse"),
    )
    const opportunityDetail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(detailGetter).toContain("is_locked_for_other_repreneur: isLockedForOtherRepreneur(")
    expect(detailGetter).toContain("withoutRelevanceScore({")
    expect(opportunityDetail).toContain("const interestAction = opportunity.match_id")
    expect(opportunityDetail).toContain("opportunity.match_id &&")
    expect(opportunityDetail).toContain("matchId={opportunity.match_id}")
    expect(opportunityDetail).toContain("const canExpressUnassignedInterest = !opportunity.match_id")
    expect(opportunityDetail).toContain("(opportunity.match_status || canExpressUnassignedInterest) ? <Card>")
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

  it("keeps a staff-only opportunity out of broad discovery while its exact proposed match remains visible to its owner", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const normalizeExposureSource = portalOpportunities.slice(
      portalOpportunities.indexOf("function normalizeExposure"),
      portalOpportunities.indexOf("async function getActivePursuitOwners"),
    )
    const dealFlowGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function listMyRepreneurDealFlow"),
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
    )
    const detailGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
      portalOpportunities.indexOf("async function updateMyOpportunityResponse"),
    )

    expect(normalizeExposureSource).not.toContain('opportunity.repreneur_exposure === "staff_only"')
    expect(normalizeExposureSource).toContain("current repreneur's exact")
    expect(dealFlowGetter).toContain('.neq("repreneur_exposure", "staff_only")')
    expect(detailGetter).toContain('.eq("repreneur_id", repreneur.id)')
    expect(detailGetter).toContain('.neq("repreneur_exposure", "staff_only")')
  })

  it("suppresses only automatic discovery when the shared thesis is incomplete", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const dealFlowGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function listMyRepreneurDealFlow"),
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
    )
    const detailGetter = portalOpportunities.slice(
      portalOpportunities.indexOf("export async function getMyRepreneurOpportunity"),
      portalOpportunities.indexOf("async function updateMyOpportunityResponse"),
    )
    const dealsPage = source("app/portal/deals/page.tsx")

    expect(dealFlowGetter).toContain("const statefulDeals = matchedOpportunities")
    expect(dealFlowGetter).toContain('const staffRecommended = deals.filter((opportunity) => opportunity.deal_bucket === "recommended")')
    expect(dealFlowGetter).toContain("const automaticMatching = automaticMatchingThesisCompleteness(repreneur)")
    expect(dealFlowGetter).toContain("const liveDeals = automaticMatching.complete ?")
    expect(detailGetter).toContain("if (!automaticMatchingThesisCompleteness(repreneur).complete) return null")
    expect(dealsPage).toContain("Re-New selections remain available")
    expect(dealsPage).toContain('href="/portal/profile#target-thesis"')
  })

  it("filters DEMO opportunity parents in PostgREST before portal and staff-preview normalization", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const staffPreview = source("lib/actions/repreneur-portal-preview.ts")

    expect((portalOpportunities.match(/opportunity:opportunities!inner\(/g) ?? [])).toHaveLength(3)
    expect(portalOpportunities).toContain('.eq("opportunity.is_demo", false)')
    expect(staffPreview).toContain("opportunity:opportunities!inner(")
    expect(staffPreview).toContain('.eq("opportunity.is_demo", false)')
    expect(staffPreview).toContain("isRepreneurEligibleOpportunity(opportunity)")
  })

  it("keeps Staff Portal Preview aligned with exact staff-only and dropped portal history", () => {
    const staffPreview = source("lib/actions/repreneur-portal-preview.ts")
    const opportunityList = source("components/opportunities/repreneur-opportunity-list.tsx")
    const normalizePreview = staffPreview.slice(
      staffPreview.indexOf("function normalizeExposure"),
      staffPreview.indexOf("async function getActivePursuitOwners"),
    )

    expect(staffPreview).toContain('"active_pursuit", "dropped"')
    expect(normalizePreview).not.toContain('opportunity.repreneur_exposure === "staff_only"')
    expect(staffPreview).toContain('opportunity:opportunities!inner(is_demo,status)')
    expect(staffPreview).toContain('if (opportunity.status !== "active") continue')
    expect(opportunityList).toContain('opportunity.match_status === "declined" || opportunity.match_status === "dropped"')
  })
})
