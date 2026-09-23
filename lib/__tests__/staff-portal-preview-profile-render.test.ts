import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import { normalizePortalRepreneurProfile } from "@/lib/data/portal-profile"

describe("staff preview profile rendering", () => {
  it("does not describe the staff login as an unlinked repreneur when a selected profile is unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(RepreneurProfileSummary, { repreneur: null, opportunities: [], mode: "staff-preview" }),
    )

    expect(markup).toContain("Selected repreneur profile unavailable")
    expect(markup).not.toContain("This login is not connected")
  })

  it("shows selected-person profile facts without owner-only edit or personal certification controls", () => {
    const repreneur = normalizePortalRepreneurProfile({
      id: "00000000-0000-4000-8000-000000000001",
      first_name: "Ada", last_name: "Example",
      q13_target_sectors_v2: ["services"],
      ldc_url: "private/ldc.pdf",
      ms_ldc_validated: false,
      ms_advisory_team: false,
    })
    const markup = renderToStaticMarkup(
      createElement(RepreneurProfileSummary, { repreneur, opportunities: [], mode: "staff-preview" }),
    )

    expect(markup).toContain("Selected repreneur&#x27;s Re-New profile")
    expect(markup).toContain("Ada Example")
    expect(markup).toContain("Personal declarations belong to the repreneur")
    expect(markup).not.toContain("Edit thesis")
    expect(markup).not.toContain("Certify as current")
    expect(markup).not.toContain("My advisory team is in place")
    expect(markup).not.toContain('type="file"')
  })
})
