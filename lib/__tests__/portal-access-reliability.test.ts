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
  disableRepreneurPortalAccess,
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

function mockHealthyPortalAccess(email = "current@example.com") {
  mockRepreneur(email)
  mocks.pgQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM public.app_user_roles")) {
      return {
        rows: [
          {
            id: "role-1",
            user_id: "auth-current",
            email,
            role: "repreneur",
            repreneur_id: "repreneur-1",
            access_enabled_at: "2026-07-14T10:00:00.000Z",
            last_access_email_sent_at: "2026-07-14T11:00:00.000Z",
          },
        ],
      }
    }
    if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
      return {
        rows: [
          { id: "auth-current", email, name: "Current Identity" },
        ],
      }
    }
    if (sql.includes('FROM "account"')) {
      return { rows: [{ has_password: true }] }
    }
    if (sql.includes('FROM "session"')) {
      return { rows: [{ count: "0" }] }
    }
    if (sql.includes("UPDATE public.app_user_roles")) {
      return { rows: [{ id: "role-1" }] }
    }
    throw new Error(`Unexpected SQL in test: ${sql}`)
  })
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

  it("reconciles a stale role to the current mailbox before resending", async () => {
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
      if (sql.includes("UPDATE public.app_user_roles")) {
        return { rows: [{ id: "role-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] }
      }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO "user"')) {
        return {
          rows: [
            {
              id: "auth-current",
              email: "current@example.com",
              name: "Test Repreneur",
            },
          ],
        }
      }
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-user-1",
              email: "old@example.com",
              role: "repreneur",
              repreneur_id: "repreneur-1",
            },
          ],
        }
      }
      if (sql.includes('FROM "account"')) return { rows: [] }
      if (sql.includes('INSERT INTO "account"')) return { rows: [] }
      if (sql.includes("UPDATE public.app_user_roles")) {
        return { rows: [{ id: "role-1" }] }
      }
      throw new Error(`Unexpected transaction SQL in test: ${sql}`)
    })

    const result = await resendRepreneurPortalAccessLink("repreneur-1")

    expect(result).toMatchObject({
      success: true,
      accessReady: true,
      emailSent: true,
      repaired: true,
    })
    expect(result.lastAccessEmailSentAt).toEqual(expect.any(String))
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: "current@example.com",
        redirectTo: "/auth/reset-password?intent=portal",
      },
    })
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith('UPDATE "account"'),
      ),
    ).toBe(false)
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith('DELETE FROM "session"'),
      ),
    ).toBe(false)
    expect(
      mocks.pgQuery.mock.calls.some(([sql]) =>
        String(sql).trim().startsWith("UPDATE public.app_user_roles"),
      ),
    ).toBe(true)
  })

  it("uses the credential-invalidating repair flow for a recoverable resend", async () => {
    mockRepreneur("current@example.com")
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-old",
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
        return {
          rows: [
            {
              id: "auth-current",
              email: "current@example.com",
              name: "Current Identity",
            },
          ],
        }
      }
      if (sql.includes('FROM "user" WHERE id')) {
        return {
          rows: [
            { id: "auth-old", email: "old@example.com", name: "Old Identity" },
          ],
        }
      }
      if (sql.includes('FROM "account"')) {
        return { rows: [{ has_password: true }] }
      }
      if (sql.includes('FROM "session"')) {
        return { rows: [{ count: "1" }] }
      }
      if (sql.includes("UPDATE public.app_user_roles")) {
        return { rows: [{ id: "role-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] }
      }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return {
          rows: [
            {
              id: "auth-current",
              email: "current@example.com",
              name: "Current Identity",
            },
          ],
        }
      }
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-old",
              email: "old@example.com",
              role: "repreneur",
              repreneur_id: "repreneur-1",
            },
          ],
        }
      }
      if (sql.includes('SELECT id FROM "account"')) {
        return { rows: [{ id: "account-current" }] }
      }
      if (sql.startsWith('UPDATE "account"')) return { rows: [] }
      if (sql.startsWith('DELETE FROM "session"')) return { rows: [] }
      if (sql.includes("UPDATE public.app_user_roles")) {
        return { rows: [{ id: "role-1" }] }
      }
      throw new Error(`Unexpected transaction SQL in test: ${sql}`)
    })

    const result = await resendRepreneurPortalAccessLink("repreneur-1")

    expect(result).toMatchObject({
      accessReady: true,
      emailSent: true,
      repaired: true,
    })
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith('UPDATE "account"'),
      ),
    ).toBe(true)
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith('DELETE FROM "session"'),
      ),
    ).toBe(true)
    expect(
      mocks.clientQuery.mock.calls.findIndex(([sql]) =>
        String(sql).startsWith('UPDATE "account"'),
      ),
    ).toBeLessThan(
      mocks.clientQuery.mock.calls.findIndex(([sql]) =>
        String(sql).includes("UPDATE public.app_user_roles"),
      ),
    )
  })

  it("keeps a healthy resend idempotent and leaves credentials untouched", async () => {
    mockHealthyPortalAccess()

    const first = await resendRepreneurPortalAccessLink("repreneur-1")
    const second = await resendRepreneurPortalAccessLink("repreneur-1")

    expect(first).toMatchObject({ emailSent: true, repaired: false })
    expect(second).toMatchObject({ emailSent: true, repaired: false })
    expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(2)
    expect(mocks.poolConnect).not.toHaveBeenCalled()
    expect(
      mocks.pgQuery.mock.calls.filter(([sql]) =>
        String(sql).trim().startsWith("UPDATE public.app_user_roles"),
      ),
    ).toHaveLength(2)
  })

  it("does not turn a first-time resend into portal enablement", async () => {
    mockRepreneur("current@example.com")
    mocks.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM public.app_user_roles")) return { rows: [] }
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return { rows: [] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    await expect(
      resendRepreneurPortalAccessLink("repreneur-1"),
    ).rejects.toThrow("Enable portal access before resending")
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
    expect(mocks.poolConnect).not.toHaveBeenCalled()
  })

  it.each([
    [
      "enable",
      (repreneurId: string) => enableRepreneurPortalAccess(repreneurId),
    ],
    [
      "resend",
      (repreneurId: string) => resendRepreneurPortalAccessLink(repreneurId),
    ],
  ])(
    "rejects a malformed canonical email before %s can touch portal identity data",
    async (_actionName, action) => {
      mockRepreneur(" Name.@Example.com ")

      await expect(action("repreneur-1")).rejects.toThrow(
        "the part before @ cannot start or end with a dot",
      )

      expect(mocks.pgQuery).not.toHaveBeenCalled()
      expect(mocks.poolConnect).not.toHaveBeenCalled()
      expect(mocks.clientQuery).not.toHaveBeenCalled()
      expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
    },
  )

  it.each([".name@example.com", "name.@example.com", "name..part@example.com"])(
    "rejects a canonical email with an invalid local-part dot pattern: %s",
    async (email) => {
      mockRepreneur(email)

      await expect(enableRepreneurPortalAccess("repreneur-1")).rejects.toThrow(
        "the part before @ cannot start or end with a dot",
      )

      expect(mocks.pgQuery).not.toHaveBeenCalled()
      expect(mocks.poolConnect).not.toHaveBeenCalled()
      expect(mocks.clientQuery).not.toHaveBeenCalled()
      expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
    },
  )

  it("reports an invalid canonical recipient without querying portal identities", async () => {
    mockRepreneur(" Name.@Example.com ")

    const status = await getRepreneurPortalAccessStatus("repreneur-1")

    expect(status).toMatchObject({
      repreneurEmail: "name.@example.com",
      portalEmailValidationError: expect.stringContaining(
        "the part before @ cannot start or end with a dot",
      ),
      enabled: false,
      repairable: false,
    })
    expect(mocks.pgQuery).not.toHaveBeenCalled()
    expect(mocks.poolConnect).not.toHaveBeenCalled()
  })

  it("still revokes existing portal access for a malformed canonical email", async () => {
    mockRepreneur(" Name.@Example.com ")
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] }
      }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes("FROM public.app_user_roles")) {
        return {
          rows: [
            {
              id: "role-1",
              user_id: "auth-current",
              email: "name.@example.com",
              role: "repreneur",
              repreneur_id: "repreneur-1",
            },
          ],
        }
      }
      if (sql.includes("DELETE FROM public.app_user_roles")) return { rows: [] }
      if (sql.includes('DELETE FROM "session"')) return { rows: [] }
      throw new Error(`Unexpected transaction SQL in test: ${sql}`)
    })

    await expect(disableRepreneurPortalAccess("repreneur-1")).resolves.toEqual({
      success: true,
    })

    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes("DELETE FROM public.app_user_roles"),
      ),
    ).toBe(true)
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM "session"'),
      ),
    ).toBe(true)
  })

  it("refuses a resend that would cross the staff role boundary", async () => {
    mockRepreneur("staff@example.com")
    mocks.pgQuery.mockImplementation(async (sql: string) => {
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
      if (sql.includes('FROM "user"') && sql.includes("LOWER(email)")) {
        return {
          rows: [
            { id: "staff-auth", email: "staff@example.com", name: "Staff" },
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
    ).rejects.toThrow("cannot be reconciled safely")
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
    expect(mocks.poolConnect).not.toHaveBeenCalled()
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
