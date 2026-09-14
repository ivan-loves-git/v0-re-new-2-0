import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const boundary = vi.hoisted(() => {
  const originalAlertEmail = process.env.WAVE_CRITICAL_ALERT_EMAIL
  process.env.WAVE_CRITICAL_ALERT_EMAIL = "alerts@example.invalid"
  return {
    getSession: vi.fn(),
    rpc: vi.fn(),
    roles: vi.fn(),
    after: vi.fn(),
    originalAlertEmail,
  }
})
vi.mock("better-auth", () => ({
  betterAuth: () => ({ api: { getSession: boundary.getSession } }),
}))
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({}) }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock("next/server", () => ({ after: boundary.after }))
vi.mock("pg", () => ({ Pool: class {} }))
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: boundary.rpc,
    from: (table: string) => {
      if (table !== "app_user_roles")
        throw new Error(`Unexpected table: ${table}`)
      return { select: () => ({ or: () => ({ limit: boundary.roles }) }) }
    },
  }),
}))

import { updateOpportunityIntake } from "@/lib/actions/opportunity-intake"

afterAll(() => {
  if (boundary.originalAlertEmail === undefined)
    delete process.env.WAVE_CRITICAL_ALERT_EMAIL
  else process.env.WAVE_CRITICAL_ALERT_EMAIL = boundary.originalAlertEmail
})

const opportunityId = "11111111-1111-4111-8111-111111111111"
const officeId = "22222222-2222-4222-8222-222222222222"
const affiliationId = "33333333-3333-4333-8333-333333333333"

function ordinaryEdit() {
  const form = new FormData()
  Object.entries({
    reference: "SYNTHETIC-140",
    status: "active",
    source_office_id: officeId,
    affiliation_ids: affiliationId,
    primary_affiliation_id: affiliationId,
    description: "Synthetic edited description",
    revenue_meur: "4.2",
    date_added: "2026-09-14",
  }).forEach(([key, value]) => form.set(key, value))
  return form
}

describe("staff opportunity save source protection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NODE_ENV", "production")
    boundary.getSession.mockResolvedValue({
      user: { id: "staff-user", email: "staff@example.invalid" },
    })
    boundary.roles.mockResolvedValue({
      data: [
        {
          role: "staff",
          user_id: "staff-user",
          email: "staff@example.invalid",
        },
      ],
      error: null,
    })
    boundary.rpc.mockResolvedValue({ data: null, error: null })
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it.each([
    [
      "ma_interaction_history_blocks_source_office_change",
      /interaction history/i,
    ],
    [
      "ma_source_office_change_blocked_during_email_send",
      /email is being sent/i,
    ],
  ])(
    "explains a database rejection from %s without an operational alert",
    async (code, explanation) => {
      boundary.rpc.mockResolvedValue({
        data: null,
        error: { message: code, code: "P0001" },
      })
      const form = ordinaryEdit()
      const result = await updateOpportunityIntake(opportunityId, form)
      expect(result.success).toBe(false)
      expect(result.fieldErrors?.source_office_id).toMatch(explanation)
      expect(result.message).not.toContain(code)
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('"error_category":"validation_failed"'),
      )
      expect(boundary.after).not.toHaveBeenCalled()
      expect(boundary.rpc).toHaveBeenCalledTimes(1)
      expect(form.get("description")).toBe("Synthetic edited description")
    },
  )

  it("retains real persistence-failure alerts and does not expose database details", async () => {
    boundary.rpc.mockResolvedValue({
      error: { message: "database connection lost: private details" },
    })
    const result = await updateOpportunityIntake(opportunityId, ordinaryEdit())
    expect(result.success).toBe(false)
    expect(result.message).not.toContain("private details")
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"error_category":"persistence_failed"'),
    )
    expect(boundary.after).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private details",
    )
  })

  it("saves ordinary edits with the original office and contact selection", async () => {
    expect(
      await updateOpportunityIntake(opportunityId, ordinaryEdit()),
    ).toEqual({ success: true, message: "Opportunity saved." })
    expect(boundary.rpc).toHaveBeenCalledWith(
      "save_opportunity_office_context",
      expect.objectContaining({
        p_opportunity_id: opportunityId,
        p_source_office_id: officeId,
        p_affiliation_ids: [affiliationId],
        p_primary_affiliation_id: affiliationId,
        p_description: "Synthetic edited description",
        p_opportunity_fields: expect.objectContaining({
          revenue_meur: 4.2,
          date_added: "2026-09-14",
        }),
      }),
    )
    expect(boundary.after).not.toHaveBeenCalled()
  })

  it("does not let a revoked staff role reach the save boundary", async () => {
    boundary.roles.mockResolvedValue({ data: [], error: null })
    await expect(
      updateOpportunityIntake(opportunityId, ordinaryEdit()),
    ).rejects.toThrow()
    expect(boundary.rpc).not.toHaveBeenCalled()
  })
})
