import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/lib/actions/staff-email-review", () => ({ prepareMaEmailReview: vi.fn() }))

import { OpportunityMaWorkflowPanel } from "@/components/opportunities/opportunity-ma-workflow-panel"
import type { MaOpportunityWorkflow } from "@/lib/actions/ma-workflows"

const workflow: MaOpportunityWorkflow = {
  contacts: [],
  recipientContactId: null,
  recipientEmail: null,
  sourceName: "Synthetic current source",
  contactName: null,
  recommendedTemplateKey: null,
  activePursuitName: null,
  stalledReminder: null,
  drafts: [],
  interactions: [
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `synthetic-newer-${index}`,
      opportunity_id: "synthetic-opportunity",
      original_office_name: "Current office",
      original_firm_name: "Synthetic current firm",
      template_key: "",
      channel: "email",
      direction: "outbound",
      recipient_email: "current@example.test",
      subject: `Newer follow-up ${index}`,
      status: "sent",
      created_at: "2026-09-02T12:00:00Z",
    })),
    {
      id: "synthetic-old-interaction",
      opportunity_id: "synthetic-opportunity",
      original_office_name: "Original office",
      original_firm_name: "Synthetic original firm",
      template_key: "",
      channel: "email",
      direction: "outbound",
      recipient_email: "original@example.test",
      subject: "Retained sent email",
      status: "sent",
      created_at: "2026-09-01T12:00:00Z",
    },
  ],
}

describe("staff opportunity history attribution", () => {
  it("keeps an older original-office interaction visible after newer entries", () => {
    const html = renderToStaticMarkup(
      React.createElement(OpportunityMaWorkflowPanel, {
        opportunityId: "synthetic-opportunity",
        workflow,
      }),
    )
    expect(html).toContain("Retained sent email")
    expect(html).toContain("Original source: Synthetic original firm · Original office")
    expect(html).not.toContain("synthetic-old-interaction")
  })
})
