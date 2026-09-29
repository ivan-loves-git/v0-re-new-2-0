import { describe, expect, it } from "vitest"
import { buildPortalNextActions, type NextActionDealSource, type NextActionExternalSource } from "@/lib/portal-next-actions"

const asOf = "2026-09-30T12:00:00.000Z"

function deal(overrides: Partial<NextActionDealSource> = {}): NextActionDealSource {
  return {
    matchId: "match-1", status: "proposed", title: "Public opportunity", href: "/portal/deals/match-1",
    responseExpiresAt: null, currentInterestAt: null, interestRejected: false,
    respondAuthorized: true, pursuit: null, ...overrides,
  }
}

function external(overrides: Partial<NextActionExternalSource> = {}): NextActionExternalSource {
  return {
    id: "dossier-1", title: "My external dossier", stage: "identified",
    deletionStatus: "active", nextAction: "Call the intermediary", responsibleParty: "owner",
    dueAt: null, href: "/portal/pursuits?view=external", ...overrides,
  }
}

describe("Ticket #132 exact next-action derivation", () => {
  it("returns truthful empty groups when no current fact creates a next step", () => {
    const result = buildPortalNextActions({ deals: [], external: [], asOf })
    expect(result).toEqual({ state: "ready", asOf, yourActions: [], waiting: [], resources: [] })
  })

  it("keeps an explicit 72-hour response open, removes it at expiry, and never clocks a historical null", () => {
    const live = buildPortalNextActions({ deals: [
      deal({ matchId: "live", responseExpiresAt: "2026-09-30T12:00:01.000Z" }),
      deal({ matchId: "unclocked", responseExpiresAt: null }),
      deal({ matchId: "expired", responseExpiresAt: asOf }),
      deal({ matchId: "denied", respondAuthorized: false }),
      deal({ matchId: "withdrawn", status: "withdrawn" }),
    ], external: [], asOf })
    expect(live.yourActions).toHaveLength(2)
    expect(live.yourActions.map((action) => action.responseExpiresAt)).toEqual([
      "2026-09-30T12:00:01.000Z", null,
    ])
    expect(live.yourActions.every((action) => action.kind === "respond")).toBe(true)
    expect(live.waiting).toEqual([])
  })

  it("waits only for a current submitted interest that has not been rejected or withdrawn", () => {
    const result = buildPortalNextActions({ deals: [
      deal({ matchId: "current", status: "interested", currentInterestAt: "2026-09-29T09:00:00Z" }),
      deal({ matchId: "legacy", status: "interested", currentInterestAt: null }),
      deal({ matchId: "rejected", status: "interested", currentInterestAt: "2026-09-29T09:00:00Z", interestRejected: true }),
      deal({ matchId: "withdrawn", status: "withdrawn", currentInterestAt: "2026-09-29T09:00:00Z" }),
    ], external: [], asOf })
    expect(result.waiting).toEqual([{ kind: "interest_validation", title: "Public opportunity",
      href: "/portal/deals/match-1", explicitText: null }])
  })

  it("uses only current NDA action, submission and grant evidence; resources are separate", () => {
    const signed = deal({ status: "active_pursuit", pursuit: {
      action: "sign_nda", signedCopyState: "not_submitted",
      ndaTemplateHref: "/portal/deals/match-1/nda-template", informationMemorandumHref: null,
    } })
    const awaiting = deal({ matchId: "awaiting", status: "active_pursuit", pursuit: {
      action: null, signedCopyState: "awaiting_validation",
      ndaTemplateHref: null, informationMemorandumHref: null,
    } })
    const granted = deal({ matchId: "granted", status: "active_pursuit", pursuit: {
      action: null, signedCopyState: "validated", ndaTemplateHref: null,
      informationMemorandumHref: "/portal/deals/granted/documents/current-memo",
    } })
    const revoked = deal({ matchId: "revoked", status: "active_pursuit", pursuit: {
      action: "unknown", signedCopyState: "unknown", ndaTemplateHref: null,
      informationMemorandumHref: null,
    } })
    const blocked = deal({ matchId: "blocked", status: "active_pursuit", pursuit: {
      action: "sign_nda", signedCopyState: "not_submitted", ndaTemplateHref: null,
      informationMemorandumHref: null,
    } })
    const result = buildPortalNextActions({ deals: [signed, awaiting, granted, revoked, blocked], external: [], asOf })
    expect(result.yourActions.map((action) => action.kind)).toEqual(["sign_nda"])
    expect(result.waiting.map((item) => item.kind)).toEqual(["nda_validation"])
    expect(result.resources.map((item) => item.kind).sort()).toEqual(["information_memorandum", "nda_template"])
    expect(result.resources.every((item) => !Object.hasOwn(item, "dueAt"))).toBe(true)
  })

  it("requires the exact open External action/owner pair, with no inferred due date or overdue label", () => {
    const result = buildPortalNextActions({ deals: [], external: [
      external(),
      external({ id: "dated", dueAt: "2026-10-04" }),
      external({ id: "staff", responsibleParty: "staff", nextAction: "Ask for a public summary" }),
      external({ id: "missing-owner", responsibleParty: null }),
      external({ id: "missing-action", nextAction: "   " }),
      external({ id: "terminal", stage: "completed" }),
      external({ id: "dropped", stage: "dropped_archived" }),
      external({ id: "deleted", deletionStatus: "delete_requested" }),
      external({ id: "unknown-stage", stage: "invented" }),
    ], asOf })
    expect(result.yourActions).toHaveLength(2)
    expect(result.yourActions.map((item) => item.dueAt)).toEqual([null, "2026-10-04"])
    expect(result.waiting).toEqual([{ kind: "external_staff", title: "My external dossier",
      href: "/portal/pursuits?view=external", explicitText: "Ask for a public summary" }])
    expect(JSON.stringify(result)).not.toMatch(/priority|overdue|staff_internal_notes|shared_notes/)
  })
})
