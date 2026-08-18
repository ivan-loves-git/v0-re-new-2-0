import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/actions/external-pursuits", () => ({
  createExternalPursuit: vi.fn(),
  fulfillExternalPursuitDeletion: vi.fn(),
  moveExternalPursuitStage: vi.fn(),
  requestExternalPursuitDeletion: vi.fn(),
  saveExternalPursuitContact: vi.fn(),
  updateExternalPursuit: vi.fn(),
  updateExternalPursuitFollowUp: vi.fn(),
}))

vi.mock("@/lib/actions/external-pursuit-attachments", () => ({
  deleteExternalPursuitAttachment: vi.fn(),
  uploadExternalPursuitAttachment: vi.fn(),
}))

import { ExternalPursuitBoard } from "@/components/pursuits/external-pursuit-board"
import type { ExternalPursuitBoardRecord } from "@/lib/types/external-pursuit"

function external(overrides: Partial<ExternalPursuitBoardRecord>): ExternalPursuitBoardRecord {
  return {
    id: "external-1",
    ownerRepreneurId: "owner-1",
    ownerName: "Owner One",
    title: "Independent target",
    stage: "identified",
    availability: "unknown",
    deletionStatus: "active",
    isOpenCapacity: true,
    externalUrl: null,
    targetCompany: null,
    sourceChannel: null,
    revenueMeur: null,
    ebitdaKeur: null,
    headcount: null,
    contacts: [],
    nextAction: null,
    responsibleParty: null,
    dueAt: null,
    sharedNotes: null,
    updatedAt: "2026-08-16T10:00:00Z",
    ...overrides,
  }
}

describe("ExternalPursuitBoard component", () => {
  it("renders provenance, omission, availability and labelled stage controls", () => {
    const html = renderToStaticMarkup(createElement(ExternalPursuitBoard, {
      external: [external({})],
      renew: [{
        id: "match-1",
        title: "Canonical target",
        stage: "identified",
        canonicalStage: null,
        canonicalJourney: "proposed",
        href: "/opportunities/opportunity-1",
        ownerName: "Owner One",
        updatedAt: "2026-08-16T09:00:00Z",
      }],
      isStaff: true,
      owners: [{ id: "owner-1", name: "Owner One" }],
    }))

    expect(html).toContain("who can see all external dossier detail by default")
    expect(html).toContain("External")
    expect(html).toContain("Re-New · read-only")
    expect(html).toContain("Availability: unknown")
    expect(html).toContain("Optional details not added")
    expect(html).toContain("Contacts not added")
    expect(html).toContain("aria-label=\"Move Independent target stage\"")
    expect(html).toContain("lg:overflow-x-auto")
    expect(html).toContain('href="/opportunities/opportunity-1"')
    expect(html).toContain("Open canonical journey")
    expect(html).not.toContain("See opportunity")
  })

  it("uses plain opportunity copy for repreneurs without changing the canonical destination", () => {
    const html = renderToStaticMarkup(createElement(ExternalPursuitBoard, {
      external: [],
      renew: [{
        id: "match-1",
        title: "Canonical target",
        stage: "identified",
        canonicalStage: null,
        canonicalJourney: "proposed",
        href: "/portal/deals/match-1",
        ownerName: "Owner One",
        updatedAt: "2026-08-18T09:00:00Z",
      }],
      isStaff: false,
    }))

    expect(html).toContain('href="/portal/deals/match-1"')
    expect(html).toContain("See opportunity")
    expect(html).not.toContain("Open canonical journey")
  })

  it("keeps a pending staff dossier and its contact context inspectable before purge", () => {
    const html = renderToStaticMarkup(createElement(ExternalPursuitBoard, {
      external: [external({
        title: "Pending target",
        deletionStatus: "delete_requested",
        targetCompany: "Target SA",
        sourceChannel: "Direct",
        contacts: [{ id: "contact-1", name: "Alex Buyer", email: "alex@example.invalid" }],
      })],
      renew: [],
      isStaff: true,
      owners: [],
    }))

    expect(html).toContain("Pending target")
    expect(html).toContain("Target: Target SA")
    expect(html).toContain("Source channel: Direct")
    expect(html).toContain("Alex Buyer")
    expect(html).toContain("alex@example.invalid")
    expect(html).toContain("Review follow-up &amp; files")
    expect(html).toContain("Permanently delete")
    expect(html).not.toContain("Move Pending target stage")
  })

  it("captures completed actions only after confirmed success, never before retry recovery", () => {
    const board = readFileSync("components/pursuits/external-pursuit-board.tsx", "utf8")
    const attachments = readFileSync("components/pursuits/external-pursuit-attachments-panel.tsx", "utf8")
    const followUp = readFileSync("components/pursuits/external-pursuit-follow-up-panel.tsx", "utf8")

    expect(board).toContain("captureExternalPursuitCompleted")
    expect(board.indexOf("if (!result.success || !result.pursuitId)")).toBeLessThan(board.indexOf("captureExternalPursuitCompleted(isStaff"))
    expect(board.indexOf("if (result.retryExact)")).toBeLessThan(board.indexOf("captureExternalPursuitCompleted(isStaff"))
    expect(attachments.indexOf("if (!result.success)")).toBeLessThan(attachments.indexOf("captureExternalPursuitCompleted(role, \"upload\")"))
    expect(followUp.indexOf("if (!result.success)")).toBeLessThan(followUp.indexOf("captureExternalPursuitCompleted(role, \"update\")"))
  })
})
