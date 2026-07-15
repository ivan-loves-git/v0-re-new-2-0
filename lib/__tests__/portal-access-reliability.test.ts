import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  clientQuery: vi.fn(),
  poolConnect: vi.fn(),
  clientRelease: vi.fn(),
  requireStaffAccess: vi.fn(),
  createAdminClient: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

vi.mock("pg", () => ({
  Pool: class {
    query = mocks.pgQuery
    connect = mocks.poolConnect
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
}))

vi.mock("@/lib/env", () => ({
  env: { DATABASE_URL: "postgres://test" },
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { requestPasswordReset: mocks.requestPasswordReset },
  },
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import {
  enableRepreneurPortalAccess,
  getRepreneurPortalAccessStatus,
  resendRepreneurPortalAccessLink,
} from "@/lib/actions/portal-access"
import { planPortalRoleReconciliation } from "@/lib/portal-access-reconciliation"

function mockRepreneur(repreneurEmail: string) {
  const from = vi.fn((table: string) => {
    if (table === "repreneurs") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "repreneur-1",
                first_name: "Test",
                last_name: "Repreneur",
                email: repreneurEmail,
              },
              error: null,
            }),
          })),
        })),
      }
    }
    throw new Error(`Unexpected Supabase table in test: ${table}`)
  })

  mocks.createAdminClient.mockReturnValue({ from })
}

describe("repreneur portal access reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ id: "staff-user" })
    mocks.poolConnect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.clientRelease,
    })
  })

  it("does not report access enabled when the linked auth identity uses a stale email", async () => {
    mockRepreneur("current@example.com")
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-user-1",
              email: "old@example.com",
              role: "repreneur",
              repreneur_id: "repreneur-1",
              access_enabled_at: "2026-07-14T10:00:00.000Z",
              last_access_email_sent_at: null,
            },
          ],
        }
      }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return { rows: [] }
      }
      if (sql.includes('FROM "user" WHERE id')) {
        return {
          rows: [
            {
              id: "auth-user-1",
              email: "old@example.com",
              name: "Old Identity",
            },
          ],
        }
      }
      if (sql.includes('FROM "account"')) {
        return { rows: [{ has_password: true }] }
      }
      if (sql.includes('FROM "session"')) {
        return { rows: [{ count: "0" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    const status = await getRepreneurPortalAccessStatus("repreneur-1")

    expect(status.enabled).toBe(false)
    expect(status.hasAuthUser).toBe(true)
    expect(status.hasCredentialAccount).toBe(true)
    expect(status.identityIssue).toBe("missing_auth_user")
  })

  it("refuses to record a resend when the role and mailbox identity disagree", async () => {
    mockRepreneur("current@example.com")
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-user-1",
              email: "old@example.com",
              role: "repreneur",
              repreneur_id: "repreneur-1",
              access_enabled_at: "2026-07-14T10:00:00.000Z",
              last_access_email_sent_at: null,
            },
          ],
        }
      }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return { rows: [] }
      }
      if (sql.includes('FROM "user" WHERE id')) {
        return {
          rows: [
            {
              id: "auth-user-1",
              email: "old@example.com",
              name: "Old Identity",
            },
          ],
        }
      }
      if (sql.includes('FROM "account"')) {
        return { rows: [{ has_password: true }] }
      }
      if (sql.includes('FROM "session"')) {
        return { rows: [{ count: "0" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    await expect(
      resendRepreneurPortalAccessLink("repreneur-1"),
    ).rejects.toThrow("Repair portal access before resending")
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
  })

  it("reuses the repreneur role and removes only safe orphan duplicates", () => {
    const plan = planPortalRoleReconciliation({
      repreneurId: "repreneur-1",
      email: "current@example.com",
      authUserId: "auth-current",
      roles: [
        {
          id: "role-for-repreneur",
          role: "repreneur",
          repreneur_id: "repreneur-1",
          user_id: "auth-old",
          email: "old@example.com",
        },
        {
          id: "orphan-for-email",
          role: "repreneur",
          repreneur_id: null,
          user_id: "auth-current",
          email: "current@example.com",
        },
      ],
    })

    expect(plan).toEqual({
      targetRoleId: "role-for-repreneur",
      redundantRoleIds: ["orphan-for-email"],
    })
  })

  it("does not rotate a staff credential while rejecting a staff email", async () => {
    mockRepreneur("staff@example.com")
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return {
          rows: [
            { id: "staff-auth", email: "staff@example.com", name: "Staff" },
          ],
        }
      }
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "staff-role",
              user_id: "staff-auth",
              email: "staff@example.com",
              role: "staff",
              repreneur_id: null,
            },
          ],
        }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    await expect(enableRepreneurPortalAccess("repreneur-1")).rejects.toThrow(
      "assigned to staff access",
    )
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith('UPDATE "account"'),
      ),
    ).toBe(false)
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
  })
})
