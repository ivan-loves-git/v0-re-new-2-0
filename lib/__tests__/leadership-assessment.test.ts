import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags,
}))

import { createAssessment } from "@/lib/actions/leadership-assessment"

const REPRENEUR_ID = "00000000-0000-4000-8000-000000000001"
const migrationPath =
  `${process.cwd()}/scripts/101_leadership_assessment_actor_identity.sql`

describe("leadership assessment actor identity migration", () => {
  it("preserves legacy sender values while adopting Better Auth text identities", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain(
      "ALTER COLUMN sent_by TYPE TEXT USING sent_by::text",
    )
    expect(migration).not.toContain("DROP CONSTRAINT")
    expect(migration).toContain(
      "COMMENT ON COLUMN public.leadership_assessments.sent_by",
    )
    expect(migration).toContain("Better Auth user ID")
  })
})

describe("createAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({
      user: { id: "better-auth-user-id-not-a-uuid" },
    })
  })

  it("records the authenticated Better Auth staff id as the assessment sender", async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        not: vi.fn(() => ({ limit: vi.fn(() => ({ maybeSingle })) })),
        is: vi.fn(() => ({ maybeSingle })),
      })),
    }))
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select, insert })),
    })

    await expect(createAssessment(REPRENEUR_ID)).resolves.toMatchObject({
      success: true,
      token: expect.any(String),
    })

    expect(insert).toHaveBeenCalledOnce()
    expect(insert).toHaveBeenCalledWith({
      repreneur_id: REPRENEUR_ID,
      token: expect.any(String),
      sent_by: "better-auth-user-id-not-a-uuid",
    })
  })
})
