import { describe, expect, it } from "vitest"
import {
  getSyntheticMaCutoverRehearsal,
  reconcileSyntheticMaCutover,
} from "@/lib/utils/ma-cutover"
import type { MaCutoverSyntheticFixture } from "@/lib/types/ma-cutover"

describe("M&A cutover rehearsal", () => {
  it("exercises the required valid chain and exception cases without input parsing", () => {
    const rehearsal = getSyntheticMaCutoverRehearsal()
    const codes = new Set(rehearsal.issues.map((issue) => issue.code))
    const validChain = rehearsal.normalizedOpportunities.find(
      (opportunity) => opportunity.temporaryId === "opportunity-valid-chain",
    )
    const reviewGeography = rehearsal.normalizedOpportunities.find(
      (opportunity) =>
        opportunity.temporaryId === "opportunity-review-geography-null-metrics",
    )

    expect(validChain).toMatchObject({
      reference: "SYN-001",
      sourceOfficeTemporaryId: "office-paris",
      selectedContactTemporaryIds: ["contact-valid", "contact-secondary"],
      primaryContactTemporaryId: "contact-valid",
      sector: "Industrial services",
      activity: "Engineering services",
      location: "Paris",
      geographyDecision: "confirmed",
      revenueMeur: 3.4,
      ebitdaKeur: 620,
      headcount: 18,
      headcountRange: "10-25",
      dateAdded: "2026-07-01",
      publicTitle: "Established industrial-services business",
      teaserSummary: "Synthetic public summary for rehearsal only.",
      internalNotes: "Synthetic staff-only cutover note.",
    })
    expect(reviewGeography).toMatchObject({
      location: null,
      geographyDecision: "review",
      revenueMeur: null,
      ebitdaKeur: null,
      headcount: null,
      dateAdded: null,
    })

    for (const code of [
      "DUPLICATE_OPPORTUNITY_REFERENCE",
      "OPPORTUNITY_SOURCE_OFFICE_REQUIRED",
      "OPPORTUNITY_DESCRIPTION_REQUIRED",
      "PRIMARY_CONTACT_IDENTITY_REQUIRED",
      "PRIMARY_CONTACT_EMAIL_INVALID",
      "OFFICE_PARENT_MAPPING_UNRESOLVED",
      "GEOGRAPHY_REVIEW_REQUIRED",
      "INVALID_REVENUE_SUPPLIED",
      "INVALID_DATE_SUPPLIED",
    ]) {
      expect(codes).toContain(code)
    }
    expect(rehearsal.summary.opportunityRows.duplicateReferences).toBe(1)
    expect(rehearsal.summary.opportunityRows.readyForActivation).toBe(1)
    expect(rehearsal.summary.resolvedMappings.opportunityContactLinks).toBe(7)
    const suppliedInvalidIssues = rehearsal.issues.filter((issue) =>
      [
        "INVALID_REVENUE_SUPPLIED",
        "INVALID_EBITDA_SUPPLIED",
        "INVALID_HEADCOUNT_SUPPLIED",
        "INVALID_DATE_SUPPLIED",
      ].includes(issue.code),
    )
    expect(suppliedInvalidIssues).toHaveLength(4)
    expect(suppliedInvalidIssues.every((issue) => issue.severity === "blocker")).toBe(true)
    expect(rehearsal.summary.issues.blockers).toBeGreaterThan(0)
    expect(rehearsal.summary.issues.warnings).toBeGreaterThan(0)
  })

  it("keeps reconciliation totals deterministic when source order changes", () => {
    const fixture: MaCutoverSyntheticFixture = {
      id: "deterministic-fixture",
      sourceFingerprint: "synthetic:deterministic:v1",
      firms: [{ temporaryId: "firm-1", name: "North Advisory" }],
      offices: [
        {
          temporaryId: "office-1",
          firmTemporaryId: "firm-1",
          name: "North office",
        },
      ],
      contacts: [
        {
          temporaryId: "contact-1",
          officeTemporaryIds: ["office-1"],
          firstName: "Jo",
          lastName: "Example",
          email: "jo@example.test",
        },
      ],
      opportunities: [
        {
          temporaryId: "opportunity-2",
          reference: "SYN-2",
          sourceOfficeTemporaryId: "office-1",
          contactTemporaryIds: ["contact-1"],
          primaryContactTemporaryId: "contact-1",
          description: "Second synthetic opportunity.",
        },
        {
          temporaryId: "opportunity-1",
          reference: "SYN-1",
          sourceOfficeTemporaryId: "office-1",
          contactTemporaryIds: ["contact-1"],
          primaryContactTemporaryId: "contact-1",
          description: "First synthetic opportunity.",
        },
      ],
    }
    const reordered: MaCutoverSyntheticFixture = {
      ...fixture,
      firms: [...fixture.firms].reverse(),
      offices: [...fixture.offices].reverse(),
      contacts: [...fixture.contacts].reverse(),
      opportunities: [...fixture.opportunities].reverse(),
    }

    const first = reconcileSyntheticMaCutover(fixture)
    const second = reconcileSyntheticMaCutover(reordered)

    expect(second.summary).toEqual(first.summary)
    expect(second.issues).toEqual(first.issues)
    expect(second.normalizedOpportunities).toEqual(first.normalizedOpportunities)
  })

  it("requires every selected contact to be office-affiliated and the primary to be selected", () => {
    const fixture: MaCutoverSyntheticFixture = {
      id: "multi-contact-validation",
      sourceFingerprint: "synthetic:multi-contact:v1",
      firms: [{ temporaryId: "firm-1", name: "North Advisory" }],
      offices: [
        {
          temporaryId: "office-a",
          firmTemporaryId: "firm-1",
          name: "North Paris",
        },
        {
          temporaryId: "office-b",
          firmTemporaryId: "firm-1",
          name: "North Lyon",
        },
      ],
      contacts: [
        {
          temporaryId: "contact-primary",
          officeTemporaryIds: ["office-a"],
          firstName: "Ari",
          lastName: "Primary",
          email: "ari.primary@example.test",
        },
        {
          temporaryId: "contact-other-office",
          officeTemporaryIds: ["office-b"],
          firstName: "Bea",
          lastName: "Other",
          email: "bea.other@example.test",
        },
      ],
      opportunities: [
        {
          temporaryId: "opportunity-primary-not-selected",
          reference: "SYN-MULTI-1",
          sourceOfficeTemporaryId: "office-a",
          contactTemporaryIds: ["contact-other-office"],
          primaryContactTemporaryId: "contact-primary",
          description: "Primary-contact membership validation.",
        },
        {
          temporaryId: "opportunity-selected-contact-wrong-office",
          reference: "SYN-MULTI-2",
          sourceOfficeTemporaryId: "office-a",
          contactTemporaryIds: ["contact-primary", "contact-other-office"],
          primaryContactTemporaryId: "contact-primary",
          description: "Selected-contact office affiliation validation.",
        },
      ],
    }

    const rehearsal = reconcileSyntheticMaCutover(fixture)
    const codesFor = (temporaryId: string) =>
      rehearsal.issues
        .filter((issue) => issue.rowKey === `opportunity:${temporaryId}`)
        .map((issue) => issue.code)

    expect(codesFor("opportunity-primary-not-selected")).toEqual(
      expect.arrayContaining([
        "PRIMARY_CONTACT_NOT_SELECTED",
        "OPPORTUNITY_CONTACT_MAPPING_UNRESOLVED",
      ]),
    )
    expect(codesFor("opportunity-selected-contact-wrong-office")).toContain(
      "OPPORTUNITY_CONTACT_MAPPING_UNRESOLVED",
    )
    expect(rehearsal.summary.resolvedMappings.opportunityContactLinks).toBe(1)
    expect(rehearsal.summary.resolvedMappings.primaryContactLinks).toBe(1)
    expect(rehearsal.summary.opportunityRows.readyForActivation).toBe(0)
  })

  it("blocks a synthetic fallback alongside a real office regardless of temporary-ID order", () => {
    function fixtureWithOfficeOrder(
      syntheticTemporaryId: string,
      realTemporaryId: string,
    ): MaCutoverSyntheticFixture {
      return {
        id: `synthetic-default-${syntheticTemporaryId}`,
        sourceFingerprint: "synthetic:default-office:v1",
        firms: [{ temporaryId: "firm-1", name: "North Advisory" }],
        offices: [
          {
            temporaryId: syntheticTemporaryId,
            firmTemporaryId: "firm-1",
            name: "North Advisory",
            isSyntheticDefault: true,
          },
          {
            temporaryId: realTemporaryId,
            firmTemporaryId: "firm-1",
            name: "North desk",
            isSyntheticDefault: false,
          },
        ],
        contacts: [],
        opportunities: [],
      }
    }

    const syntheticFirst = reconcileSyntheticMaCutover(
      fixtureWithOfficeOrder("office-a-synthetic", "office-z-real"),
    )
    const realFirst = reconcileSyntheticMaCutover(
      fixtureWithOfficeOrder("office-z-synthetic", "office-a-real"),
    )

    for (const rehearsal of [syntheticFirst, realFirst]) {
      expect(
        rehearsal.issues.map((issue) => issue.code),
      ).toContain("SYNTHETIC_DEFAULT_REQUIRES_UNKNOWN_OFFICE")
      expect(rehearsal.summary.issues.blockers).toBe(1)
    }
  })
})
