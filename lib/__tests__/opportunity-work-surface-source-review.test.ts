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
  sourceIdentityToVerify = false,
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
    source_identity_to_verify: sourceIdentityToVerify,
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

  it("uses the neutral identity label only for the verified chain", () => {
    const html = renderToStaticMarkup(
      createElement(OpportunityWorkSurfaceTable, {
        mode: "groups",
        opportunities: [opportunity("001", true, true), opportunity("002", true)],
      }),
    )

    expect(html.match(/Source identity to verify/g)).toHaveLength(1)
    expect(html.match(/Source review required/g)).toHaveLength(1)
  })
})
