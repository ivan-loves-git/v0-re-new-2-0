import { describe, expect, it } from "vitest"
import { projectSelectedReNewPursuits } from "@/lib/portal-preview-pursuits"

describe("selected repreneur Re-New pursuits", () => {
  it("projects only matched canonical journeys with safe titles and selected-owner links", () => {
    const records = projectSelectedReNewPursuits("owner & one", [
      { match_id: "active-match", match_status: "active_pursuit", pursuit_stage: "loi", pursuit_stage_provenance: "staff_confirmed_history", public_title: "Safe title", updated_at: "2026-09-23T10:00:00Z" },
      { match_id: "declined-match", match_status: "declined", pursuit_stage: null, pursuit_stage_provenance: null, public_title: "Declined title", updated_at: "2026-09-22T10:00:00Z" },
      { match_id: null, match_status: null, pursuit_stage: null, pursuit_stage_provenance: null, public_title: "Live deal", updated_at: "2026-09-21T10:00:00Z" },
    ])

    expect(records).toEqual([expect.objectContaining({
      id: "active-match", title: "Safe title", stage: "loi", canonicalJourney: "loi",
      href: "/portal-preview?repreneurId=owner+%26+one&dealId=active-match",
    })])
    expect(JSON.stringify(records)).not.toContain("Declined title")
    expect(JSON.stringify(records)).not.toContain("Live deal")
  })
})
