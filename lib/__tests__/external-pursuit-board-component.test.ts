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
    externalUrl: null,
    targetCompany: null,
    sourceChannel: null,
    revenueMeur: null,
    ebitdaKeur: null,
    headcount: null,
    contacts: [],
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
    expect(html).toContain("Review and permanently delete")
    expect(html).not.toContain("Move Pending target stage")
  })
})
