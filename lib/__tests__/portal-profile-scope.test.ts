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
      "target_ebitda_min_keur",
      "target_ebitda_max_keur",
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

  it("resolves deal details through an owned match or the namespace-safe live inventory", () => {
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
    expect(detailGetter).toContain("const exposure = matchResult.data ? normalizeExposure(matchResult.data, repreneur) : null")
    expect(detailGetter).toContain('supabase.rpc("w164_repreneur_live_inventory"')
    expect(detailPage).toContain("const opportunity = await getMyRepreneurOpportunity(matchId)")
    expect(detailPage).toContain("if (!opportunity)")
    expect(detailPage).toContain("notFound()")
  })

  it("ignores the legacy exposure value and uses lifecycle plus namespace authority", () => {
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
    expect(dealFlowGetter).toContain('supabase.rpc("w164_repreneur_live_inventory"')
    expect(dealFlowGetter).not.toContain('.neq("repreneur_exposure", "staff_only")')
    expect(detailGetter).toContain('.eq("repreneur_id", repreneur.id)')
    expect(detailGetter).not.toContain('.neq("repreneur_exposure", "staff_only")')
  })

  it("keeps neutral inventory visible while suppressing only personalized ranking for an incomplete thesis", () => {
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
    expect(dealFlowGetter).toContain("const thesisCompleteness = automaticMatchingThesisCompleteness(repreneur)")
    expect(dealFlowGetter).not.toContain("isAcceptedPaidMatchingClient")
    expect(dealFlowGetter).toContain("const automaticMatching = thesisCompleteness")
    expect(dealFlowGetter).toMatch(
      /automaticMatching\.complete[\s\S]*toDealFlowOpportunity[\s\S]*toNeutralDealFlowOpportunity\(withMatchingGeography\(opportunity, geography\)\)/,
    )
    expect(dealFlowGetter).not.toContain("const liveDeals = automaticMatching.complete ?")
    expect(detailGetter).not.toContain("if (!thesisCompleteness.complete) return null")
    expect(dealsPage).toContain("Your current Re-New selections remain available")
    expect(dealsPage).toContain('href="/portal/profile#target-thesis"')
  })

  it("uses invitation, not offer or lifecycle, in both staff manual-recommendation pickers", () => {
    const opportunityMatches = source("lib/actions/opportunity-matches.ts")
    const pickerByOpportunity = opportunityMatches.slice(
      opportunityMatches.indexOf("export async function listOpportunityMatchCandidates"),
      opportunityMatches.indexOf("export async function listOpportunityCandidatesForRepreneur"),
    )
    const pickerByRepreneur = opportunityMatches.slice(
      opportunityMatches.indexOf("export async function listOpportunityCandidatesForRepreneur"),
      opportunityMatches.indexOf("export async function saveOpportunityMatch"),
    )

    for (const picker of [pickerByOpportunity, pickerByRepreneur]) {
      expect(picker).toContain('from("app_user_roles")')
      expect(picker).toContain("hasInvitedLinkedIdentity")
      expect(picker).not.toContain("isAcceptedPaidMatchingClient")
    }
    expect(pickerByOpportunity).toContain("candidate.is_demo === opportunity.is_demo")
    expect(pickerByRepreneur).toContain("opportunity.is_demo === repreneur.is_demo")
    expect(pickerByRepreneur).not.toContain('.neq("repreneur_exposure", "staff_only")')
  })

  it("excludes DEMO active-pursuit owners from the staff response read", () => {
    const opportunityMatches = source("lib/actions/opportunity-matches.ts")
    const activeOwnerRead = opportunityMatches.slice(
      opportunityMatches.indexOf("const { data: activeRows"),
      opportunityMatches.indexOf("const activeByOpportunity"),
    )

    expect(activeOwnerRead).toContain("repreneurs!inner")
    expect(activeOwnerRead).toContain('.eq("repreneur.is_demo", false)')
  })

  it("filters opportunity parents to the current REAL or DEMO namespace before normalization", () => {
    const portalOpportunities = source("lib/actions/repreneur-opportunities.ts")
    const staffPreview = source("lib/actions/repreneur-portal-preview.ts")

    expect((portalOpportunities.match(/opportunity:opportunities!inner\(/g) ?? [])).toHaveLength(3)
    expect(portalOpportunities).toContain('.eq("opportunity.is_demo", repreneur.is_demo === true)')
    expect(staffPreview).toContain("opportunity:opportunities!inner(")
    expect(staffPreview).toContain('.eq("opportunity.is_demo", repreneur.is_demo === true)')
    expect(staffPreview).toContain("isOpportunityInRepreneurNamespace(opportunity, repreneur)")
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

  it("feeds Portal Preview the same safe canonical fields used by Deal Flow filters", () => {
    const staffPreview = source("lib/actions/repreneur-portal-preview.ts")
    const normalizePreview = staffPreview.slice(
      staffPreview.indexOf("function normalizeExposure"),
      staffPreview.indexOf("async function getActivePursuitOwners"),
    )
    const previewList = staffPreview.slice(
      staffPreview.indexOf("async function listVisibleOpportunitiesForRepreneur"),
      staffPreview.indexOf("export async function listStaffPortalPreviewOptions"),
    )
    const portalExposureTypes = source("lib/types/opportunity.ts").slice(
      source("lib/types/opportunity.ts").indexOf("export interface RepreneurOpportunityExposure"),
      source("lib/types/opportunity.ts").indexOf("export function getOpportunityStatusLabel"),
    )

    expect(normalizePreview).toContain("geography_node_id: opportunity.geography_node_id")
    expect(normalizePreview).toContain("canonical_sector: normalizeOpportunitySector(opportunity.sector)")
    expect(previewList).toContain("withRepreneurGeographyLabel(exposure, geography)")
    expect(previewList).toContain("loadMatchingGeographyContext(supabase, [repreneur.id])")
    expect(portalExposureTypes).toContain("geography_node_id")
    expect(portalExposureTypes).toContain("geography_label")
    expect(portalExposureTypes).toContain("canonical_sector")
    for (const rawOrInternalField of ["description", "internal_notes", "source_id", "source_label"]) {
      expect(portalExposureTypes).not.toContain(rawOrInternalField)
    }
  })
})
