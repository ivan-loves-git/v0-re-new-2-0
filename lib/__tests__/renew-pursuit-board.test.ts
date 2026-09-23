import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ReNewPursuitBoard } from "@/components/pursuits/renew-pursuit-board"
import { filterStaffReNewPursuits, projectStaffReNewPursuit, sortStaffReNewPursuits, type ReNewStaffBoardRecord } from "@/lib/utils/renew-pursuit-board"
import type { OpportunityMatchStatus, OpportunityPursuitStage, OpportunityStatus } from "@/lib/types/opportunity"

function project(matchStatus: OpportunityMatchStatus, pursuitStage: OpportunityPursuitStage | null = null, opportunityStatus: OpportunityStatus = "active") {
  return projectStaffReNewPursuit({ opportunityStatus, matchStatus, pursuitStage })
}

function record(overrides: Partial<ReNewStaffBoardRecord> = {}): ReNewStaffBoardRecord {
  return { id: "sofia-alfa", title: "Company Alfa", ownerName: "Sofia Example", href: "/opportunities/alfa", stageProvenance: null, ...project("active_pursuit", "qa_with_ma_firm"), ...overrides }
}

describe("staff Re-New board v1.0 (Decision #166)", () => {
  it("separates preparation, proposal, unvalidated interest and confirmed pursuit", () => {
    expect(project("draft").column).toBe("matching")
    expect(project("shortlisted").column).toBe("matching")
    expect(project("proposed").column).toBe("proposed")
    expect(project("interested")).toMatchObject({ stage: "interest_received", column: "interest_received" })
    expect(project("active_pursuit")).toMatchObject({ stage: "active_pursuit", column: "active_pursuit" })
    expect(project("active_pursuit", "interest")).toEqual(project("active_pursuit"))
    // A stale pursuit-stage field must not promote an unvalidated response.
    expect(project("interested", "loi").stage).toBe("interest_received")
  })

  it.each(["nda_signed", "info_memo_received", "qa_with_ma_firm", "intermediary_meeting", "seller_meeting"] as const)("retains %s inside Active pursuit", (stage) => {
    expect(project("active_pursuit", stage)).toEqual({ stage, column: "active_pursuit", view: "active", context: null })
  })

  it("keeps LOI separate and never treats a closed opportunity's siblings as completed", () => {
    expect(project("active_pursuit", "loi")).toMatchObject({ stage: "loi", column: "loi", view: "active" })
    expect(project("completed", null, "closed")).toMatchObject({ stage: "completed", view: "completed", column: null })
    expect(project("active_pursuit", "closed", "closed").view).toBe("completed")
    expect(project("proposed", null, "closed")).toMatchObject({ stage: "proposed", view: "inactive", context: "Opportunity closed · pursuit not completed" })
    expect(project("declined", null, "closed")).toMatchObject({ stage: "declined", view: "dropped" })
    expect(project("dropped", "loi")).toMatchObject({ stage: "dropped", view: "dropped" })
  })

  it.each(["draft", "paused", "archived"] as const)("retains the actual stage outside the active view for %s opportunities", (status) => {
    expect(project("active_pursuit", "qa_with_ma_firm", status)).toMatchObject({ stage: "qa_with_ma_firm", view: "inactive", column: null, context: `Opportunity ${status}` })
  })

  it("places every supported combination in exactly one view without inventing a date", () => {
    const statuses: OpportunityMatchStatus[] = ["draft", "shortlisted", "proposed", "interested", "active_pursuit", "completed", "dropped", "declined"]
    const stages: (OpportunityPursuitStage | null)[] = [null, "interest", "nda_signed", "info_memo_received", "qa_with_ma_firm", "intermediary_meeting", "seller_meeting", "loi", "closed", "dropped"]
    const opportunities: OpportunityStatus[] = ["draft", "active", "paused", "closed", "archived"]
    for (const status of statuses) for (const stage of stages) for (const opportunity of opportunities) {
      const projection = project(status, stage, opportunity)
      expect(["active", "completed", "dropped", "inactive"].filter((view) => view === projection.view)).toHaveLength(1)
      expect(projection.column !== null).toBe(projection.view === "active")
      expect(projection).not.toHaveProperty("date")
      expect(projection).not.toHaveProperty("updatedAt")
    }
  })

  it("filters by view AND precise stage AND either identity without mutating facts", () => {
    const records = [record(), record({ id: "marco-beta", ownerName: "Marco Example", title: "Company Beta", ...project("active_pursuit", "nda_signed") }), record({ id: "sofia-dropped", ...project("dropped") })]
    expect(filterStaffReNewPursuits(records, { view: "active", stage: "qa_with_ma_firm", query: " SOFIA " })).toEqual([records[0]])
    expect(filterStaffReNewPursuits(records, { view: "active", stage: "all", query: "beta" })).toEqual([records[1]])
    expect(filterStaffReNewPursuits(records, { view: "dropped", stage: "all", query: "" })).toEqual([records[2]])
    expect(filterStaffReNewPursuits(records, { view: "active", stage: "nda_signed", query: "alfa" })).toEqual([])
    expect(records).toHaveLength(3)
    expect(records[0].stage).toBe("qa_with_ma_firm")
  })

  it("renders the five columns, exact stage, safe provenance and existing detail link", () => {
    const html = renderToStaticMarkup(createElement(ReNewPursuitBoard, { records: [record({ stageProvenance: "staff_confirmed_history" }), record({ id: "done", title: "Completed target", ...project("completed") })] }))
    for (const label of ["Matching", "Proposed", "Interest to validate", "Active pursuit", "LOI"]) expect(html).toContain(label)
    expect(html).toContain("Sofia Example")
    expect(html).toContain("Stage: Q&amp;A with M&amp;A firm")
    expect(html).toContain("Stage confirmed by Re-New")
    expect(html).toContain("milestone date unknown")
    expect(html).toContain("Document access is checked separately")
    expect(html).toContain('href="/opportunities/alfa"')
    expect(html).not.toContain("Completed target")
    expect(html).not.toContain("Access granted")
    expect(html).not.toContain("Move ")
  })

  it("sorts by business progression, then identities, without mutating input facts", () => {
    const records = [
      record({ id: "seller", ownerName: "Alice", ...project("active_pursuit", "seller_meeting") }),
      record({ id: "nda-z", ownerName: "Zoé", ...project("active_pursuit", "nda_signed") }),
      record({ id: "unknown", stage: "unknown" }),
      record({ id: "nda-a", ownerName: "Alice", ...project("active_pursuit", "nda_signed") }),
      record({ id: "start", ...project("active_pursuit") }),
    ]
    const before = structuredClone(records)
    expect(sortStaffReNewPursuits(records, "stage").map((r) => r.id)).toEqual(["start", "nda-a", "nda-z", "seller", "unknown"])
    expect(records).toEqual(before)
  })

  it("sorts repreneurs naturally with missing names last and opportunity tie-breaks", () => {
    const records = [
      record({ id: "missing", ownerName: null }),
      record({ id: "zoe", ownerName: "Zoé" }),
      record({ id: "e10", ownerName: "Élodie", title: "Projet 10" }),
      record({ id: "e2", ownerName: "elodie", title: "Projet 2" }),
      record({ id: "blank", ownerName: "  " }),
      record({ id: "alice", ownerName: " Alice " }),
    ]
    expect(sortStaffReNewPursuits(records, "repreneur").map((r) => r.id)).toEqual(["alice", "e2", "e10", "zoe", "blank", "missing"])
  })

  it("sorts opportunities then repreneurs and uses a deterministic final tie-break", () => {
    const records = [
      record({ id: "z", title: "Projet 10" }),
      record({ id: "b", title: "Énergie", ownerName: "Alice" }),
      record({ id: "a", title: "energie", ownerName: "alice" }),
      record({ id: "c", title: "Énergie", ownerName: "Zoé" }),
      record({ id: "p2", title: "Projet 2" }),
    ]
    expect(sortStaffReNewPursuits(records, "opportunity").map((r) => r.id)).toEqual(["a", "b", "c", "p2", "z"])
    expect(sortStaffReNewPursuits([...records].reverse(), "opportunity")).toEqual(sortStaffReNewPursuits(records, "opportunity"))
  })

  it("sorts filtered outcome records without moving them to another view", () => {
    const records = [
      record({ id: "z", ownerName: "Zoé", ...project("declined") }),
      record({ id: "active", ownerName: "Alice" }),
      record({ id: "a", ownerName: "Alice", ...project("declined") }),
      record({ id: "dropped", ...project("dropped") }),
    ]
    const filtered = filterStaffReNewPursuits(records, { view: "dropped", stage: "declined", query: "alfa" })
    const sorted = sortStaffReNewPursuits(filtered, "repreneur")
    expect(sorted.map((r) => r.id)).toEqual(["a", "z"])
    expect(sorted.every((r) => r.view === "dropped" && r.column === null)).toBe(true)
  })

  it("renders cards in default progression order within their macro-column", () => {
    const html = renderToStaticMarkup(createElement(ReNewPursuitBoard, { records: [
      record({ id: "seller", title: "Later seller discussion", ...project("active_pursuit", "seller_meeting") }),
      record({ id: "nda", title: "Earlier NDA stage", ...project("active_pursuit", "nda_signed") }),
    ] }))
    expect(html.indexOf("Earlier NDA stage")).toBeLessThan(html.indexOf("Later seller discussion"))
    expect(html).toContain('id="renew-pursuit-sort"')
    expect(html).toContain("Sort by")
  })
})
