import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { OpportunityWorkSurfaceRecord } from "@/lib/types/opportunity"

vi.mock("next/navigation", () => ({
  usePathname: () => "/opportunities/groups",
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/hooks/use-hydrated-now", () => ({ useHydratedNow: () => Date.parse("2026-09-27T12:00:00Z") }))

import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"

function row(id: string, day: string, confirmation: OpportunityWorkSurfaceRecord["freshness_confirmation"] = null): OpportunityWorkSurfaceRecord {
  return {
    id, reference: `QA-${id}`, status: "active", is_demo: false,
    repreneur_exposure: "staff_only", date_added: day, date_added_precision: "day",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    matches: [], freshness_confirmation: confirmation,
  }
}

describe("opportunity source-freshness display", () => {
  it("shows a 45-day check only for a due recorded clock and respects exact confirmation", () => {
    const html = renderToStaticMarkup(createElement(OpportunityWorkSurfaceTable, {
      mode: "find", opportunities: [
        row("day-45", "2026-08-13"),
        row("day-44", "2026-08-14"),
        row("confirmed", "2026-01-01", { id: "reply-1", at: "2026-09-01T10:00:00Z" }),
      ],
    }))
    expect(html.match(/45-day source check due/g)).toHaveLength(1)
    expect(html).toContain("Confirmed open 2026-09-01")
  })
})
