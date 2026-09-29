import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { readMaRelationshipLedger } from "@/lib/data/ma-relationship-ledger"
import { maRelationshipResultSummary } from "@/lib/ma-relationship-filters"

function activityRow(index: number, isDemo: boolean) {
  return {
    id: `interaction-${index}`,
    office_id: "office-1",
    affiliation_id: null,
    opportunity_id: isDemo ? `demo-${index}` : null,
    channel: "call",
    direction: "inbound",
    occurred_at: "2026-09-23T09:00:00.000Z",
    title: "Synthetic activity",
    summary: null,
    outcome: null,
    next_action: null,
    next_action_due_at: null,
    delivery_status: null,
    provider_idempotency_key: null,
    provider_message_id: null,
    delivery_finalized_at: null,
    sent_at: null,
    recipient_email_snapshot: null,
    delivery_error: null,
    owner_staff_user_id: "staff-1",
    owner_verification_state: "verified",
    owner_verified_at: null,
    created_at: "2026-09-23T09:00:00.000Z",
    office: { id: "office-1", name: "Paris", firm: { name: "Example firm" } },
    affiliation: null,
    opportunity: isDemo
      ? { id: `demo-${index}`, is_demo: true, reference: "DEMO", public_title: null, activity: null }
      : null,
  }
}

function query(data: unknown[]) {
  const result = { data, error: null }
  const chain = {
    select: () => chain,
    order: () => chain,
    in: () => chain,
    eq: () => chain,
    limit: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}

function mockLedgerRead(interactions: ReturnType<typeof activityRow>[]) {
  mocks.createAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table === "ma_interactions") return query(interactions)
      if (["ma_contact_office_affiliations", "opportunities", "opportunity_matches"].includes(table)) {
        return query([])
      }
      throw new Error(`Unexpected table ${table}`)
    },
  })
}

describe("staff Activity loaded window", () => {
  beforeEach(() => vi.resetAllMocks())

  it("keeps the cap notice when one of 250 fetched activities is DEMO-linked", async () => {
    mockLedgerRead(Array.from({ length: 250 }, (_, index) => activityRow(index, index === 0)))

    const ledger = await readMaRelationshipLedger({ purpose: "global", officeIds: ["office-1"] })

    expect(ledger.activities).toHaveLength(249)
    expect(ledger.activities.some((activity) => activity.id === "interaction-0")).toBe(false)
    expect(ledger.globalActivityWindowSaturated).toBe(true)
    expect(maRelationshipResultSummary(0, ledger.activities.length, ledger.globalActivityWindowSaturated)).toEqual({
      count: "0 of 249 loaded activities",
      windowNotice: "Filters apply only to the latest 250 queried activities. Older activity is not included.",
      emptyMessage: "No loaded activity matches these filters.",
    })
  })

  it("does not claim no history when all 250 fetched activities are DEMO-linked", async () => {
    mockLedgerRead(Array.from({ length: 250 }, (_, index) => activityRow(index, true)))

    const ledger = await readMaRelationshipLedger({ purpose: "global", officeIds: ["office-1"] })

    expect(ledger.activities).toHaveLength(0)
    expect(ledger.globalActivityWindowSaturated).toBe(true)
    expect(maRelationshipResultSummary(0, ledger.activities.length, ledger.globalActivityWindowSaturated)).toEqual({
      count: "0 of 0 loaded activities",
      windowNotice: "Filters apply only to the latest 250 queried activities. Older activity is not included.",
      emptyMessage: "No staff-visible activity in the loaded window.",
    })
  })
})
