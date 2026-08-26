import { describe, expect, it } from "vitest"
import {
  projectClientPursuitPortfolio,
  type ClientPortfolioMatchRow,
  type ClientPortfolioRepreneurRow,
} from "@/lib/client-pursuit-portfolio"

const client = (overrides: Partial<ClientPortfolioRepreneurRow> = {}): ClientPortfolioRepreneurRow => ({
  id: "client-1",
  first_name: "Ariane",
  last_name: "Martin",
  email: "ariane@example.test",
  lifecycle_status: "client",
  updated_at: "2026-08-25T08:00:00Z",
  repreneur_offers: [
    { status: "accepted", offer: { name: "Search support" } },
    { status: "accepted", offer: [{ name: "Search support" }] },
    { status: "completed", offer: { name: "Completed onboarding" } },
  ],
  ...overrides,
})

const match = (overrides: Partial<ClientPortfolioMatchRow> = {}): ClientPortfolioMatchRow => ({
  id: "match-1",
  repreneur_id: "client-1",
  status: "proposed",
  pursuit_stage: null,
  created_at: "2026-07-01T09:00:00Z",
  updated_at: "2026-08-25T09:00:00Z",
  interest_expressed_at: null,
  reviewed_at: null,
  pursuit_stage_updated_at: null,
  opportunity: {
    id: "opportunity-1",
    reference: "OPP-101",
    public_title: "Industrial services business",
    status: "active",
    is_demo: false,
  },
  ...overrides,
})

describe("W-037 client pursuit portfolio projection", () => {
  it("derives one client row without storing owner, due date, or summary status", () => {
    const rows = projectClientPursuitPortfolio({
      repreneurs: [client()],
      matches: [
        match(),
        match({
          id: "match-2",
          status: "interested",
          created_at: "2026-07-02T09:00:00Z",
          interest_expressed_at: "2026-07-05T09:00:00Z",
          opportunity: {
            id: "opportunity-2",
            reference: "OPP-102",
            public_title: null,
            status: "active",
            is_demo: false,
          },
        }),
        match({
          id: "match-3",
          status: "active_pursuit",
          pursuit_stage: "seller_meeting",
          created_at: "2026-07-03T09:00:00Z",
          reviewed_at: "2026-07-06T09:00:00Z",
          pursuit_stage_updated_at: "2026-07-10T09:00:00Z",
          opportunity: {
            id: "opportunity-3",
            reference: "OPP-103",
            public_title: "Regional distributor",
            status: "active",
            is_demo: false,
          },
        }),
      ],
      activities: [{ repreneur_id: "client-1", created_at: "2026-07-20T09:00:00Z" }],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      repreneurName: "Ariane Martin",
      serviceScope: ["Search support"],
      proposedCount: 1,
      interestedCount: 1,
      activeCount: 1,
      openPursuitCount: 3,
      lastVerifiedAt: "2026-07-20T09:00:00Z",
      exceptions: [],
    })
    expect(rows[0].oldestAction).toMatchObject({
      reference: "OPP-101",
      waitingSince: "2026-07-01T09:00:00Z",
      nextActor: "Repreneur",
    })
    expect(rows[0].pursuits.find((item) => item.id === "match-3")).toMatchObject({
      stageLabel: "Seller meeting",
      waitingSince: "2026-07-10T09:00:00Z",
      nextActor: "Staff",
    })
    expect(rows[0]).not.toHaveProperty("owner")
    expect(rows[0]).not.toHaveProperty("dueDate")
    expect(rows[0]).not.toHaveProperty("summaryStatus")
  })

  it("ignores demo opportunities and keeps incomplete client facts visible as exceptions", () => {
    const rows = projectClientPursuitPortfolio({
      repreneurs: [
        client({
          id: "client-2",
          first_name: null,
          last_name: null,
          email: null,
          repreneur_offers: [],
        }),
        client({ id: "lead-1", lifecycle_status: "lead" }),
      ],
      matches: [match({
        repreneur_id: "client-2",
        opportunity: {
          id: "demo-1",
          reference: "DEMO-1",
          public_title: "Demo",
          status: "active",
          is_demo: true,
        },
      })],
      activities: [],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      repreneurId: "client-2",
      repreneurName: "Unnamed client",
      openPursuitCount: 0,
      exceptions: [
        "Service scope missing",
        "No open pursuit",
        "No verified activity",
        "Client name missing",
      ],
    })
  })

  it("does not create a production portfolio row for a demo repreneur", () => {
    const rows = projectClientPursuitPortfolio({
      repreneurs: [client({ id: "demo-client", is_demo: true })],
      matches: [match({ repreneur_id: "demo-client" })],
      activities: [{ repreneur_id: "demo-client", created_at: "2026-08-01T09:00:00Z" }],
    })
    expect(rows).toEqual([])
  })
})
