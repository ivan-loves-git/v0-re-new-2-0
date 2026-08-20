import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  formatCivilDate,
  formatDisplayDate,
  formatDisplayDateTime,
} from "@/lib/utils/display-date-time"

describe("display date and time", () => {
  it("renders instants in the canonical Paris timezone", () => {
    expect(formatDisplayDateTime("2026-08-20T23:30:00.000Z", "en-GB")).toBe("21 Aug 2026, 01:30")
  })

  it("keeps a YYYY-MM-DD civil date on its literal calendar day", () => {
    expect(formatCivilDate("2026-08-20", "en-US")).toBe("Aug 20, 2026")
  })

  it("formats display dates in Paris rather than the runtime timezone", () => {
    expect(formatDisplayDate("2026-08-20T23:30:00.000Z", "fr-FR")).toBe("21 août 2026")
  })

  it("is stable across the server and browser timezone matrix", () => {
    const originalTimeZone = process.env.TZ
    const outputs = ["UTC", "Europe/Rome", "America/Los_Angeles"].map((timeZone) => {
      process.env.TZ = timeZone
      return [
        formatDisplayDateTime("2026-08-20T23:30:00.000Z", "en-GB"),
        formatCivilDate("2026-08-20", "en-US"),
      ]
    })
    if (originalTimeZone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimeZone

    expect(outputs).toEqual([
      ["21 Aug 2026, 01:30", "Aug 20, 2026"],
      ["21 Aug 2026, 01:30", "Aug 20, 2026"],
      ["21 Aug 2026, 01:30", "Aug 20, 2026"],
    ])
  })

  it("keeps audited client date surfaces on the shared deterministic formatter", () => {
    const timestampSurfaces = [
      "components/opportunities/opportunity-documents-panel.tsx",
      "components/opportunities/ma-contact-directory.tsx",
      "components/opportunities/opportunity-closure-controls.tsx",
      "components/opportunities/opportunity-ma-workflow-panel.tsx",
      "components/opportunities/ma-relationship-workspace.tsx",
      "components/repreneurs/repreneur-table.tsx",
      "components/repreneurs/repreneur-form.tsx",
      "components/repreneurs/repreneur-notes.tsx",
      "components/repreneurs/leadership-results-card.tsx",
      "components/repreneurs/repreneur-opportunity-matches-card.tsx",
      "components/repreneurs/scoring-accuracy.tsx",
      "components/portal/repreneur-target-thesis-editor.tsx",
      "components/pursuits/external-pursuit-attachments-panel.tsx",
      "app/(dashboard)/emails/components/email-log.tsx",
      "components/offers/client-offer-card.tsx",
      "components/offers/repreneur-offers-list.tsx",
    ]
    const civilDateSurfaces = [
      "components/offers/offer-milestones.tsx",
      "app/(dashboard)/emails/components/email-overview.tsx",
      "components/repreneurs/activity-history.tsx",
    ]

    for (const path of timestampSurfaces) {
      const source = readFileSync(path, "utf8")
      expect(source).toContain('from "@/lib/utils/display-date-time"')
      expect(source).not.toMatch(/toLocaleDateString|Intl\.DateTimeFormat/)
    }
    for (const path of civilDateSurfaces) {
      expect(readFileSync(path, "utf8")).toContain("formatCivilDate")
    }
  })

  it("pins the locale for visible numeric formatting", () => {
    const numericSurfaces = [
      "components/strategy/revenue-journey.tsx",
      "components/wave-ai/usage-dashboard.tsx",
      "components/evilcharts/ui/tooltip.tsx",
    ]

    for (const path of numericSurfaces) {
      expect(readFileSync(path, "utf8"), path).not.toContain(".toLocaleString()")
    }
  })
})
