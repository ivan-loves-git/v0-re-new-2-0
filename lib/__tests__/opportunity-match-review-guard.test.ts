import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
}))

import { markOpportunityMatchReviewed } from "@/lib/actions/opportunity-matches"

const matchId = "97000000-0000-4000-8000-000000000081"
const opportunityId = "97000000-0000-4000-8000-000000000071"
const interestA = "2026-09-27T09:00:00.100Z"
const versionA = "2026-09-27T09:00:00.200Z"
const interestB = "2026-09-27T10:00:00.100Z"
const versionB = "2026-09-27T10:00:00.200Z"

type ResponseEpisode = {
  id: string
  opportunity_id: string
  status: "interested" | "withdrawn" | "declined"
  interest_expressed_at: string | null
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

function bindStatefulReviewStore(row: ResponseEpisode) {
  let applied = 0
  const from = vi.fn(() => {
    const predicates: Array<() => boolean> = []
    let update: { reviewed_at: string; reviewed_by: string } | null = null
    const query = {
      update(value: { reviewed_at: string; reviewed_by: string }) { update = value; return query },
      eq(column: keyof ResponseEpisode, value: string) {
        predicates.push(() => row[column] === value)
        return query
      },
      is(column: keyof ResponseEpisode, value: null) {
        predicates.push(() => row[column] === value)
        return query
      },
      select() { return query },
      async maybeSingle() {
        if (!update || !predicates.every((predicate) => predicate())) return { data: null, error: null }
        row.reviewed_at = update.reviewed_at
        row.reviewed_by = update.reviewed_by
        applied += 1
        return { data: { id: row.id }, error: null }
      },
    }
    return query
  })
  mocks.createAdminClient.mockReturnValue({ from })
  return { applied: () => applied }
}

describe("staff review is bound to the displayed response episode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
  })

  it("does not let an A form review fresh interest B after A was withdrawn", async () => {
    const row: ResponseEpisode = {
      id: matchId, opportunity_id: opportunityId, status: "interested",
      interest_expressed_at: interestA, updated_at: versionA,
      reviewed_at: null, reviewed_by: null,
    }
    const store = bindStatefulReviewStore(row)
    const staleForm = [matchId, opportunityId, "interested", interestA, versionA] as const

    row.status = "withdrawn"
    row.updated_at = "2026-09-27T09:30:00.000Z"
    row.status = "interested"
    row.interest_expressed_at = interestB
    row.updated_at = versionB

    await markOpportunityMatchReviewed(...staleForm)
    expect(store.applied()).toBe(0)
    expect(row.reviewed_at).toBeNull()
    expect(row.reviewed_by).toBeNull()

    await markOpportunityMatchReviewed(matchId, "wrong-opportunity", "interested", interestB, versionB)
    await markOpportunityMatchReviewed(matchId, opportunityId, "declined", interestB, versionB)
    expect(store.applied()).toBe(0)

    await markOpportunityMatchReviewed(matchId, opportunityId, "interested", interestB, versionB)
    expect(store.applied()).toBe(1)
    expect(row.reviewed_by).toBe("staff-1")
  })

  it("uses a nullable token and version for a legacy decline, never an older decline form", async () => {
    const row: ResponseEpisode = {
      id: matchId, opportunity_id: opportunityId, status: "declined",
      interest_expressed_at: null, updated_at: versionB,
      reviewed_at: null, reviewed_by: null,
    }
    const store = bindStatefulReviewStore(row)

    await markOpportunityMatchReviewed(matchId, opportunityId, "declined", null, versionA)
    expect(store.applied()).toBe(0)
    expect(row.reviewed_at).toBeNull()

    await markOpportunityMatchReviewed(matchId, opportunityId, "declined", interestA, versionB)
    expect(store.applied()).toBe(0)

    await markOpportunityMatchReviewed(matchId, opportunityId, "declined", null, versionB)
    expect(store.applied()).toBe(1)
    expect(row.reviewed_by).toBe("staff-1")
  })
})
