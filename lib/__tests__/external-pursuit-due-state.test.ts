import { describe, expect, it } from "vitest"
import { externalPursuitDueState, parisDateKey } from "@/lib/utils/external-pursuit-due-state"

describe("External Pursuit Paris due states", () => {
  const parisMidday = new Date("2026-08-16T10:00:00.000Z")

  it("uses Europe/Paris rather than the caller's UTC calendar", () => {
    expect(parisDateKey(new Date("2026-08-16T22:30:00.000Z"))).toBe("2026-08-17")
  })

  it("makes only dates before today overdue", () => {
    expect(externalPursuitDueState(null, parisMidday)).toBe("no_date")
    expect(externalPursuitDueState("2026-08-15", parisMidday)).toBe("overdue")
    expect(externalPursuitDueState("2026-08-16", parisMidday)).toBe("due_today")
    expect(externalPursuitDueState("2026-08-17", parisMidday)).toBe("upcoming")
  })
})
