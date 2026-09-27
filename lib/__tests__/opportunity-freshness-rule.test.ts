import { describe, expect, it } from "vitest"
import { freshnessDueBasis } from "@/lib/opportunity-freshness-policy"

const now = new Date("2026-09-27T12:00:00Z")

describe("the 45-day source freshness clock", () => {
  const opportunity = { status: "active" as const, isDemo: false, hasActiveRealPursuit: false, dateAdded: "2026-08-13", dateAddedPrecision: "day" as const }

  it("starts on day 45, not day 44", () => {
    expect(freshnessDueBasis({ ...opportunity, dateAdded: "2026-08-14" }, now)).toBeNull()
    expect(freshnessDueBasis(opportunity, now)?.basis).toBe("recorded_source_day")
  })

  it("includes old unknown-precision inventory without claiming a confirmed day", () => {
    expect(freshnessDueBasis({ ...opportunity, dateAdded: "2026-01-01", dateAddedPrecision: null }, now)?.basis).toBe("older_inventory_no_confirmation")
  })

  it("does not invent a day from a known month or technical created timestamp", () => {
    expect(freshnessDueBasis({ ...opportunity, dateAdded: "2026-08-01", dateAddedPrecision: "month" }, now)).toBeNull()
    expect(freshnessDueBasis({ ...opportunity, dateAdded: "2026-01-01", dateAddedPrecision: "month" }, now)?.basis).toBe("older_inventory_no_confirmation")
    expect(freshnessDueBasis({ ...opportunity, dateAdded: null }, now)).toBeNull()
  })

  it("only explicit confirmed-open evidence resets the clock", () => {
    const confirmed = { id: "reply-1", at: "2026-09-01T10:00:00Z" }
    expect(freshnessDueBasis({ ...opportunity, confirmation: confirmed }, now)).toBeNull()
    expect(freshnessDueBasis({ ...opportunity, confirmation: { ...confirmed, at: "2026-08-13T10:00:00Z" } }, now)?.episode).toBe("reply-1")
  })

  it("excludes paused, draft, DEMO and active REAL pursuits", () => {
    expect(freshnessDueBasis({ ...opportunity, status: "paused" }, now)).toBeNull()
    expect(freshnessDueBasis({ ...opportunity, status: "draft" }, now)).toBeNull()
    expect(freshnessDueBasis({ ...opportunity, isDemo: true }, now)).toBeNull()
    expect(freshnessDueBasis({ ...opportunity, hasActiveRealPursuit: true }, now)).toBeNull()
  })
})
