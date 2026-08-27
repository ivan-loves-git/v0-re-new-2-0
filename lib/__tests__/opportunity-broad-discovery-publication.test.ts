import { describe, expect, it } from "vitest"
import {
  broadDiscoveryPublicationState,
  missingBroadDiscoveryReaderFields,
} from "@/lib/opportunity-broad-discovery-publication"

const completeOpportunity = {
  status: "active" as const,
  is_demo: false,
  repreneur_exposure: "staff_only" as const,
  public_title: "Industrial services company",
  teaser_summary: "An anonymized industrial services opportunity.",
  sector: "Industrial services",
  location: "Occitanie",
}

describe("lifecycle-derived Deal Flow publication", () => {
  it("uses lifecycle as the publication control in both namespaces", () => {
    expect(broadDiscoveryPublicationState(completeOpportunity)).toEqual({
      mode: "visible",
      namespace: "REAL",
      missingFields: [],
    })
    expect(
      broadDiscoveryPublicationState({ ...completeOpportunity, is_demo: true }),
    ).toMatchObject({ mode: "visible", namespace: "DEMO" })
    expect(
      broadDiscoveryPublicationState({ ...completeOpportunity, status: "draft" }),
    ).toMatchObject({ mode: "hidden", namespace: "REAL" })
    expect(
      broadDiscoveryPublicationState({ ...completeOpportunity, status: "paused" }),
    ).toMatchObject({ mode: "hidden", namespace: "REAL" })
  })

  it("treats missing reader-facing fields as warnings, never publication blockers", () => {
    const incomplete = {
      ...completeOpportunity,
      public_title: " ",
      teaser_summary: null,
      sector: null,
      location: "",
    }

    expect(missingBroadDiscoveryReaderFields(incomplete)).toEqual([
      "title",
      "teaser",
      "sector",
      "location",
    ])
    expect(broadDiscoveryPublicationState(incomplete)).toMatchObject({
      mode: "visible",
      missingFields: ["title", "teaser", "sector", "location"],
    })
  })

  it("shows the lifecycle result without a second staff visibility control", async () => {
    const control = await import("node:fs/promises").then(({ readFile }) =>
      readFile("components/opportunities/opportunity-broad-discovery-control.tsx", "utf8"),
    )

    expect(control).toContain("Active lifecycle")
    expect(control).toContain("warning, not a visibility blocker")
    expect(control).not.toContain("Make visible in Deal Flow")
    expect(control).not.toContain("setOpportunityBroadDiscoveryVisibility")
  })
})
