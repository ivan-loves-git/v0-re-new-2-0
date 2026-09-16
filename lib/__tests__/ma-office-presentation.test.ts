import { describe, expect, it } from "vitest"
import { matchesMaOfficeSearch, presentMaOffice, presentMaOfficeOptions } from "@/lib/ma-office-presentation"
import { filterMaRelationshipTimeline, maRelationshipResultSummary } from "@/lib/ma-relationship-filters"
import type { MaRelationshipTimelineItem } from "@/lib/actions/ma-relationships"

describe("Activity presentation contract (#148 / Decision #149)", () => {
  it("compacts equal names without rewriting either canonical field or the office ID", () => {
    const input = Object.freeze({ id: "office-a", firmName: "M&A CAPITAL", officeName: " m&a  capital " })
    const result = presentMaOffice(input)
    expect(result.label).toBe("M&A CAPITAL")
    expect(result.id).toBe("office-a")
    expect(result.identity).toContain("Office:  m&a  capital ")
    expect(input.officeName).toBe(" m&a  capital ")
    expect(result).toMatchObject({ needsReview: false, isProvisionalSource: false })
  })

  it("preserves a distinct office verbatim, without guessing a city or headquarters", () => {
    expect(presentMaOffice({ id: "b", firmName: "Meridian", officeName: "Meridian - Lyon" })).toMatchObject({
      primary: "Meridian", secondary: "Meridian - Lyon", label: "Meridian · Meridian - Lyon",
    })
    expect(presentMaOffice({ id: "c", firmName: "Cafe", officeName: "Café" }).secondary).toBe("Café")
  })

  it("keeps separate IDs selectable even when every displayed name collides", () => {
    const options = presentMaOfficeOptions([
      { id: "shared-prefix-a", firmName: "Meridian", officeName: "Meridian" },
      { id: "shared-prefix-b", firmName: "MERIDIAN", officeName: "MERIDIAN" },
    ])
    expect(options.map((o) => o.id)).toEqual(["shared-prefix-a", "shared-prefix-b"])
    expect(options.map((o) => o.reference)).toEqual(["Office ID: shared-prefix-a", "Office ID: shared-prefix-b"])
  })

  it.each(["", "(à compléter)", " à compléter ", null])("keeps missing identity %s searchable and marks it for review", (name) => {
    const [option] = presentMaOfficeOptions([{ id: "incomplete-id", firmName: name, officeName: name }])
    expect(option.needsReview).toBe(true)
    expect(option.reference).toBe("Office ID: incomplete-id")
    expect(matchesMaOfficeSearch(option.searchText, "needs review")).toBe(true)
    expect(matchesMaOfficeSearch(option.searchText, "incomplete-id")).toBe(true)
    if (name) expect(matchesMaOfficeSearch(option.searchText, name)).toBe(true)
  })

  it("does not classify provisional context from its name", () => {
    const identity = { id: "ordinary", firmName: "Acme Co.", officeName: "Acme Paris" }
    expect(presentMaOffice(identity).isProvisionalSource).toBe(false)
    expect(presentMaOffice({ ...identity, isProvisionalSource: true }).isProvisionalSource).toBe(true)
  })

  it("finds accent-insensitive terms across the firm and office without reordering names", () => {
    const option = presentMaOffice({ id: "office-a", firmName: "Élan Advisory", officeName: "Paris" })
    expect(matchesMaOfficeSearch(option.searchText, "paris elan")).toBe(true)
    expect(matchesMaOfficeSearch(option.searchText, "elan lyon")).toBe(false)
    expect(option.label).toBe("Élan Advisory · Paris")
  })

  it("discloses the capped loaded window even when the filtered result is empty", () => {
    expect(maRelationshipResultSummary(0, 250)).toEqual({
      count: "0 of 250 loaded activities",
      windowNotice: "Filters apply only to the latest 250 loaded activities. Older activity is not included.",
    })
    expect(maRelationshipResultSummary(1, 1)).toEqual({ count: "1 of 1 loaded activity", windowNotice: null })
    expect(maRelationshipResultSummary(0, 0)).toEqual({ count: "0 of 0 loaded activities", windowNotice: null })
  })

  it("keeps office, historical person and opportunity as independent AND constraints", () => {
    const rows = [
      { id: "old", officeId: "old-office", contactId: "same-person", opportunityId: "deal" },
      { id: "new", officeId: "current-office", contactId: "same-person", opportunityId: null },
    ] as MaRelationshipTimelineItem[]
    expect(filterMaRelationshipTimeline(rows, { contactId: "same-person" })).toEqual(rows)
    expect(filterMaRelationshipTimeline(rows, { contactId: "same-person", officeId: "old-office", opportunityId: "deal" })).toEqual([rows[0]])
    expect(filterMaRelationshipTimeline(rows, { contactId: "same-person", officeId: "current-office", opportunityId: "deal" })).toEqual([])
  })
})
