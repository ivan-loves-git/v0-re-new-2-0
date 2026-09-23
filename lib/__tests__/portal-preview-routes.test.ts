import { describe, expect, it } from "vitest"
import {
  createPortalPreviewDealHrefMap,
  createPortalPreviewSectionHref,
  createPortalPreviewSelectionHref,
  createPortalPreviewDocumentHref,
  resolvePortalPreviewRepreneur,
} from "@/lib/portal-preview-routes"

describe("portal preview deal routes", () => {
  it("creates serializable exact preview links for every visible deal", () => {
    const hrefs = createPortalPreviewDealHrefMap("repreneur & one", [
      { opportunityId: "opportunity-1", matchId: "match one" },
      { opportunityId: "opportunity-2", matchId: null },
    ])

    expect(hrefs).toStrictEqual({
      "match one": "/portal-preview?repreneurId=repreneur+%26+one&dealId=match+one",
      "opportunity-2": "/portal-preview?repreneurId=repreneur+%26+one&dealId=opportunity-2",
    })
    expect(Object.values(hrefs).every((href) => typeof href === "string")).toBe(true)
  })

  it("does not replace a stale requested repreneur with the default preview", () => {
    const options = [
      { id: "repreneur-a", email: "a@example.test" },
      { id: "repreneur-b", email: "myworkmail4@gmail.com" },
    ]

    expect(resolvePortalPreviewRepreneur(options, "missing-repreneur")).toBeNull()
    expect(resolvePortalPreviewRepreneur(options, undefined)).toEqual(options[1])
  })

  it("changes owner without carrying a stale deal, match, dossier or action", () => {
    expect(createPortalPreviewSelectionHref("other & person")).toBe(
      "/portal-preview?repreneurId=other+%26+person",
    )
    expect(createPortalPreviewSectionHref("other & person", "external-pursuits")).toBe(
      "/portal-preview?repreneurId=other+%26+person&view=external-pursuits",
    )
    expect(createPortalPreviewSelectionHref("other & person", "workspace-1")).toBe(
      "/portal-preview?repreneurId=other+%26+person&workspaceId=workspace-1",
    )
    expect(createPortalPreviewSectionHref("other & person", "profile", "workspace-1")).toBe(
      "/portal-preview?repreneurId=other+%26+person&view=profile&workspaceId=workspace-1",
    )
  })

  it("builds staff-selected-person document links instead of owner-session URLs", () => {
    expect(createPortalPreviewDocumentHref("person & one", "match-1", { kind: "nda-template" })).toBe(
      "/portal-preview/deals/match-1/nda-template?repreneurId=person+%26+one",
    )
    expect(createPortalPreviewDocumentHref("person & one", "match-1", {
      kind: "information-memorandum",
      documentId: "memo-1",
    })).toBe(
      "/portal-preview/deals/match-1/documents/memo-1?repreneurId=person+%26+one",
    )
  })
})
