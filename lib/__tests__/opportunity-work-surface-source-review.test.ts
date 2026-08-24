import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/opportunities/groups",
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { OpportunityWorkSurfaceTable } from "@/components/opportunities/opportunity-work-surface-table"
import type { OpportunityWorkSurfaceRecord } from "@/lib/types/opportunity"

function opportunity(
  id: string,
  sourceReviewRequired: boolean,
): OpportunityWorkSurfaceRecord {
  return {
    id,
    reference: `OPP-${id}`,
    is_demo: false,
    status: "active",
    repreneur_exposure: "staff_only",
    created_at: "2026-07-27T09:00:00.000Z",
    updated_at: "2026-07-27T09:00:00.000Z",
    matches: [],
    source_review_required: sourceReviewRequired,
  }
}

describe("grouped opportunity source-review badge", () => {
  it("renders the badge only for the review-required group row", () => {
    const html = renderToStaticMarkup(
      createElement(OpportunityWorkSurfaceTable, {
        mode: "groups",
        opportunities: [opportunity("001", true), opportunity("002", false)],
      }),
    )

    expect(html.match(/Source review required/g)).toHaveLength(1)
  })
})
