import { describe, expect, it } from "vitest"
import {
  deriveOpportunityJourney,
  getOpportunityJourneyLabel,
  type OpportunityJourney,
  type OpportunityJourneyInput,
} from "../opportunity-journey"

describe("deriveOpportunityJourney", () => {
  const cases: Array<{ name: string; input: OpportunityJourneyInput; expected: OpportunityJourney }> = [
    { name: "draft opportunity", input: { status: "draft" }, expected: "draft" },
    { name: "paused opportunity", input: { status: "paused" }, expected: "paused" },
    { name: "archived opportunity", input: { status: "archived" }, expected: "archived" },
    { name: "closed opportunity", input: { status: "closed" }, expected: "closed" },
    { name: "active opportunity with no matches", input: { status: "active", matches: [] }, expected: "live_in_inventory" },
    {
      name: "draft or shortlisted matches",
      input: { status: "active", matches: [{ status: "draft" }, { status: "shortlisted" }] },
      expected: "matching",
    },
    {
      name: "proposed match",
      input: { status: "active", matches: [{ status: "shortlisted" }, { status: "proposed" }] },
      expected: "proposed",
    },
    {
      name: "interested match",
      input: { status: "active", matches: [{ status: "proposed" }, { status: "interested" }] },
      expected: "interest_received",
    },
    {
      name: "active pursuit without stage",
      input: { status: "active", matches: [{ status: "active_pursuit" }] },
      expected: "active_pursuit",
    },
    {
      name: "active pursuit at intermediary meeting",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "intermediary_meeting" }] },
      expected: "intermediary_meeting",
    },
    {
      name: "active pursuit with info memo received",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "info_memo_received" }] },
      expected: "info_memo_received",
    },
    {
      name: "active pursuit at seller meeting",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "seller_meeting" }] },
      expected: "seller_meeting",
    },
    {
      name: "active pursuit at LOI",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "loi" }] },
      expected: "loi",
    },
    {
      name: "active pursuit closed",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "closed" }] },
      expected: "closed",
    },
    {
      name: "active pursuit dropped",
      input: { status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "dropped" }] },
      expected: "dropped",
    },
    {
      name: "only declined or dropped matches",
      input: { status: "active", matches: [{ status: "declined" }, { status: "dropped" }] },
      expected: "dropped",
    },
  ]

  it.each(cases)("returns $expected for $name", ({ input, expected }) => {
    expect(deriveOpportunityJourney(input)).toBe(expected)
  })
})

describe("getOpportunityJourneyLabel", () => {
  it("returns readable labels", () => {
    expect(getOpportunityJourneyLabel("live_in_inventory")).toBe("Live in inventory")
    expect(getOpportunityJourneyLabel("interest_received")).toBe("Interest received")
    expect(getOpportunityJourneyLabel("info_memo_received")).toBe("Info memo received")
    expect(getOpportunityJourneyLabel("loi")).toBe("LOI")
  })
})
