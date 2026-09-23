import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

const opportunity: RepreneurDealFlowOpportunity = {
  match_id: "match-1", match_status: "active_pursuit", pursuit_stage: "loi",
  visible_documents: [], opportunity_id: "opportunity-1", reference: "Confidential opportunity",
  public_title: "Safe deal", updated_at: "2026-09-23T10:00:00Z",
  is_staff_recommended: false, is_outside_current_criteria: false,
}
const journey: PortalCurrentPursuit = {
  matchId: "match-1", enabled: true, gate1Passed: true, ndaReadyNotified: true,
  gate2Passed: true, dispatched: true, revoked: false, evidenceRequired: false,
  confidentialGrant: {
    informationMemoDocumentId: "memo-1", grantedAt: "2026-09-23T10:00:00Z",
    source: { firmName: "Disclosed firm", officeName: "Disclosed office", contactNames: ["Disclosed contact"] },
  },
}

describe("staff preview deal detail", () => {
  it("uses exact selected-owner document routes and omits owner-only controls", () => {
    const html = renderToStaticMarkup(createElement(RepreneurOpportunityDetail, {
      opportunity, journey, readOnly: true,
      documentHrefs: {
        ndaTemplate: "/portal-preview/deals/match-1/nda-template?repreneurId=owner-1",
        informationMemorandum: "/portal-preview/deals/match-1/documents/memo-1?repreneurId=owner-1",
      },
    }))

    expect(html).toContain('href="/portal-preview/deals/match-1/nda-template?repreneurId=owner-1"')
    expect(html).toContain('href="/portal-preview/deals/match-1/documents/memo-1?repreneurId=owner-1"')
    expect(html).not.toContain('href="/portal/deals/')
    expect(html).not.toContain("Mark as reviewed")
    expect(html).not.toContain("Upload signed copy")
  })

  it("never falls back to the staff account's owner-session document links", () => {
    const html = renderToStaticMarkup(createElement(RepreneurOpportunityDetail, {
      opportunity, journey, readOnly: true,
    }))

    expect(html).not.toContain('href="/portal/deals/')
    expect(html).not.toContain("Download template")
    expect(html).not.toContain("Download IM")
  })
})
