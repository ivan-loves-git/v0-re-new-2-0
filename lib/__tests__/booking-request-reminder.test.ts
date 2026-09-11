import { describe, expect, it } from "vitest"
import { bookingReminderDueOn, isBookingReminderDue } from "@/lib/booking-request-reminder"

describe("booking request reminder calendar", () => {
  it("uses Paris civil weekdays and no holiday inference", () => {
    expect(bookingReminderDueOn("2026-09-11T15:00:00.000Z")).toBe("2026-09-18")
    expect(bookingReminderDueOn("2026-09-14T08:00:00.000Z")).toBe("2026-09-21")
  })
  it("becomes due on its fifth business civil day", () => {
    expect(isBookingReminderDue("2026-09-11T15:00:00.000Z", "2026-09-17T20:00:00.000Z")).toBe(false)
    expect(isBookingReminderDue("2026-09-11T15:00:00.000Z", "2026-09-18T07:00:00.000Z")).toBe(true)
  })
})
