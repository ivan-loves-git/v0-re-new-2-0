import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({ staff: vi.fn(), database: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.database }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateOpportunityDashboardTags: vi.fn() }))

import { listOpportunityCandidatesForRepreneur, listOpportunityMatchCandidates, saveOpportunityMatch } from "@/lib/actions/opportunity-matches"

const opportunityId = "81000000-0000-4000-8000-000000000001"
const repreneurId = (index: number) => `82000000-0000-4000-8000-${String(index).padStart(12, "0")}`

// A bounded PostgREST boundary double: fixtures are synthetic and the actual
// candidate projection/scoring code runs unchanged through its public action.
function database(repreneurs: Record<string, unknown>[], overrides: Record<string, Record<string, unknown>[]> = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    opportunities: [{ id: opportunityId, is_demo: false, status: "active" }],
    repreneurs,
    app_user_roles: [],
    geography_nodes: [],
    repreneur_geography_targets: [],
    ...overrides,
  }
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      let cap = 1000
      let pendingUpdate: Record<string, unknown> | null = null
      const query = {
        select() { return query },
        insert(values: Record<string, unknown>) { rows = [{ id: "83000000-0000-4000-8000-000000000001", ...values }]; return query },
        update(values: Record<string, unknown>) { pendingUpdate = values; return query },
        eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query },
        gt(key: string, value: string) { rows = rows.filter(row => String(row[key]) > value); return query },
        not(key: string, _operator: string, value: unknown) { rows = rows.filter(row => row[key] !== value); return query },
        in(key: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[key])); return query },
        order(key: string, options: { ascending: boolean }) { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (options.ascending ? 1 : -1)); return query },
        limit(value: number) { cap = value; return query },
        maybeSingle() {
          const row = rows[0] ?? null
          return Promise.resolve({ data: row && pendingUpdate ? { ...row, ...pendingUpdate } : row, error: null })
        },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          return Promise.resolve({ data: rows.slice(0, cap), error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  boundary.staff.mockResolvedValue({ user: { id: "better-auth-staff" } })
})

describe("staff manual recommendation candidates", () => {
  it("finds every same-namespace client with email beyond the old 250 limit without an invited account", async () => {
    const profiles = Array.from({ length: 261 }, (_, index) => ({
      id: repreneurId(index), first_name: `Synthetic ${index}`, email: `person${index}@example.test`,
      is_demo: false, lifecycle_status: "client", updated_at: "2026-09-01T00:00:00Z",
    })).concat([
      { id: repreneurId(900), first_name: "Synthetic lead", email: "lead@example.test", is_demo: false, lifecycle_status: "lead", updated_at: "2026-09-01T00:00:00Z" },
      { id: repreneurId(901), first_name: "Synthetic qualified", email: "qualified@example.test", is_demo: false, lifecycle_status: "qualified", updated_at: "2026-09-01T00:00:00Z" },
    ])
    boundary.database.mockReturnValue(database(profiles))

    const candidates = await listOpportunityMatchCandidates(opportunityId)

    expect(candidates).toHaveLength(261)
    expect(candidates.map(candidate => candidate.id)).toContain(repreneurId(260))
    expect(candidates.every(candidate => candidate.platform_recommendation === "not_evaluated")).toBe(true)
  })

  it("allows staff to save a new recommendation for an uninvited profile with a usable email", async () => {
    boundary.database.mockReturnValue(database([{ id: repreneurId(1), email: "person1@example.test", is_demo: false, lifecycle_status: "client" }]))
    const form = new FormData()
    form.set("opportunity_id", opportunityId)
    form.set("repreneur_id", repreneurId(1))
    form.set("status", "proposed")
    expect((await saveOpportunityMatch(form)).ok).toBe(true)
  })

  it("rejects a new recommendation when the profile is no longer a client at submission", async () => {
    boundary.database.mockReturnValue(database([{
      id: repreneurId(1),
      email: "person1@example.test",
      is_demo: false,
      lifecycle_status: "qualified",
    }]))
    const form = new FormData()
    form.set("opportunity_id", opportunityId)
    form.set("repreneur_id", repreneurId(1))
    form.set("status", "proposed")

    await expect(saveOpportunityMatch(form)).resolves.toEqual({
      ok: false,
      message: "Only client repreneurs can receive a new staff recommendation.",
      field: "repreneur_id",
    })
  })

  it("keeps an existing non-client recommendation editable", async () => {
    const updatedAt = "2026-09-18T09:00:00.000Z"
    boundary.database.mockReturnValue(database([{
      id: repreneurId(1),
      email: "lead@example.test",
      is_demo: false,
      lifecycle_status: "lead",
    }], {
      opportunity_matches: [{
        id: "83000000-0000-4000-8000-000000000001",
        opportunity_id: opportunityId,
        repreneur_id: repreneurId(1),
        status: "draft",
        updated_at: updatedAt,
      }],
    }))
    const form = new FormData()
    form.set("opportunity_id", opportunityId)
    form.set("repreneur_id", repreneurId(1))
    form.set("status", "draft")
    form.set("expected_updated_at", updatedAt)
    form.set("human_notes", "Retain this existing relationship history.")

    await expect(saveOpportunityMatch(form)).resolves.toEqual({ ok: true })
  })

  it("lets authenticated staff select a deal in the staff-only CRM dossier without inviting the profile", async () => {
    boundary.database.mockReturnValue(database([{ id: repreneurId(1), email: "person1@example.test", is_demo: false, lifecycle_status: "client" }]))
    expect((await listOpportunityCandidatesForRepreneur(repreneurId(1))).map(item => item.id)).toEqual([opportunityId])
  })

  it.each(["lead", "qualified"])("does not offer deals for a %s profile", async (lifecycleStatus) => {
    boundary.database.mockReturnValue(database([{
      id: repreneurId(1),
      email: "person1@example.test",
      is_demo: false,
      lifecycle_status: lifecycleStatus,
    }]))

    await expect(listOpportunityCandidatesForRepreneur(repreneurId(1))).resolves.toEqual([])
  })

  it("denies the CRM candidate actions to every nonstaff caller before any database access", async () => {
    boundary.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(listOpportunityCandidatesForRepreneur(repreneurId(1))).rejects.toThrow("Staff access required")
    await expect(listOpportunityMatchCandidates(opportunityId)).rejects.toThrow("Staff access required")
    await expect(saveOpportunityMatch(new FormData())).rejects.toThrow("Staff access required")
    expect(boundary.database).not.toHaveBeenCalled()
  })

  it("excludes other namespaces and unusable emails without hiding zero-score profiles", async () => {
    boundary.database.mockReturnValue(database([
      { id: repreneurId(1), email: "zero@example.test", is_demo: false, lifecycle_status: "client" },
      { id: repreneurId(2), email: "demo@example.test", is_demo: true, lifecycle_status: "client" },
      { id: repreneurId(3), email: "not an email", is_demo: false, lifecycle_status: "client" },
      { id: repreneurId(4), email: "missing..local@example.test", is_demo: false, lifecycle_status: "client" },
      { id: repreneurId(5), email: null, is_demo: false, lifecycle_status: "client" },
    ]))
    const candidates = await listOpportunityMatchCandidates(opportunityId)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ id: repreneurId(1), platform_score: 0 })
  })

  it("rejects direct cross-namespace assignment without an invitation workaround", async () => {
    boundary.database.mockReturnValue(database([{ id: repreneurId(1), email: "demo@example.test", is_demo: true, lifecycle_status: "client" }]))
    const form = new FormData()
    form.set("opportunity_id", opportunityId)
    form.set("repreneur_id", repreneurId(1))
    form.set("status", "proposed")
    expect(await saveOpportunityMatch(form)).toMatchObject({ ok: false, field: "repreneur_id" })
  })

  it("offers every unsaved same-namespace active deal from the staff CRM dossier beyond 250", async () => {
    const opportunities = Array.from({ length: 262 }, (_, index) => ({
      id: `84000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      reference: `SYNTHETIC-${index}`, status: "active", is_demo: false,
    }))
    boundary.database.mockReturnValue(database([{ id: repreneurId(1), email: "all@example.test", is_demo: false, lifecycle_status: "client" }], {
      opportunities: [...opportunities,
        { id: "85000000-0000-4000-8000-000000000001", status: "draft", is_demo: false },
        { id: "85000000-0000-4000-8000-000000000002", status: "active", is_demo: true }],
      opportunity_matches: [{ id: "86000000-0000-4000-8000-000000000001", opportunity_id: opportunities[0].id, repreneur_id: repreneurId(1) }],
    }))
    const candidates = await listOpportunityCandidatesForRepreneur(repreneurId(1))
    expect(candidates).toHaveLength(261)
    expect(candidates.map(candidate => candidate.id)).toContain(opportunities[261].id)
    expect(candidates.map(candidate => candidate.id)).not.toContain(opportunities[0].id)
  })
})
