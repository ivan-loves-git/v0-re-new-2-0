import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  clientQuery: vi.fn(),
  release: vi.fn(),
}))

vi.mock("pg", () => ({
  Pool: class {
    query = mocks.query
    connect = mocks.connect
  },
}))

vi.mock("@/lib/env", () => ({
  env: { DATABASE_URL: "postgres://test" },
}))

import {
  authorizePasswordResetDelivery,
  isPasswordResetToken,
  passwordResetUserLockKey,
  validatePasswordResetLink,
  withPasswordResetAuthority,
} from "@/lib/password-reset-link"

describe("password reset link validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connect.mockResolvedValue({
      query: mocks.clientQuery,
      release: mocks.release,
    })
  })

  it.each([
    null,
    undefined,
    "",
    "short",
    "abcdefghijklmnopqrstuvwx?",
    "abcdefghijklmnopqrstuvw-",
    "abcdefghijklmnopqrstuvw_",
    "abcdefghijklmnopqrstuvwé",
    "abcdefghijklmnopqrstuvwxy",
  ])("rejects malformed token %s without querying the database", async (token) => {
    expect(isPasswordResetToken(token)).toBe(false)
    await expect(validatePasswordResetLink(token)).resolves.toBe(false)
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it("accepts the exact Better Auth token shape", () => {
    expect(isPasswordResetToken("aB3dE5gH7jK9mN2pQ4sT6vX8")).toBe(true)
  })

  it("returns true for one current reset verification without selecting account data", async () => {
    mocks.query.mockResolvedValue({ rows: [{ valid: 1 }] })

    await expect(
      validatePasswordResetLink("aB3dE5gH7jK9mN2pQ4sT6vX8"),
    ).resolves.toBe(true)

    expect(mocks.query).toHaveBeenCalledTimes(1)
    const [sql, parameters] = mocks.query.mock.calls[0]
    expect(sql).toContain('FROM public."verification"')
    expect(sql).toContain('"identifier" = $1')
    expect(sql).toContain('"expiresAt" >')
    expect(sql).toContain("FROM public.app_user_roles")
    expect(sql).toContain("role.user_id::text = verification.\"value\"")
    expect(sql).toContain("role.role::text IN ('staff', 'repreneur')")
    expect(sql).toMatch(/^SELECT 1 AS valid/)
    expect(sql).not.toMatch(/\b(?:insert|update|delete)\b/i)
    expect(parameters).toEqual([
      "reset-password:aB3dE5gH7jK9mN2pQ4sT6vX8",
    ])
  })

  it.each([
    ["unknown or consumed", { rows: [] }],
    ["expired", { rows: [] }],
  ])("returns false for a %s token", async (_case, result) => {
    mocks.query.mockResolvedValue(result)

    await expect(
      validatePasswordResetLink("aB3dE5gH7jK9mN2pQ4sT6vX8"),
    ).resolves.toBe(false)
  })

  it("fails closed without leaking a database error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.query.mockRejectedValue(new Error("database detail"))

    await expect(
      validatePasswordResetLink("aB3dE5gH7jK9mN2pQ4sT6vX8"),
    ).resolves.toBe(false)

    expect(errorSpy).toHaveBeenCalledWith(
      "Password reset link validation was unavailable.",
    )
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(
      "database detail",
    )
    errorSpy.mockRestore()
  })

  it("uses one stable per-user lock key", () => {
    expect(passwordResetUserLockKey("user-1")).toBe(
      "password-reset-user:user-1",
    )
  })

  it("serializes a current-role reset before invoking Better Auth", async () => {
    const calls: string[] = []
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      calls.push(sql)
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes("FROM public.app_user_roles")) {
        return { rows: [{ user_id: "user-1" }] }
      }
      if (sql.includes('FROM public."verification"')) {
        return { rows: [{ user_id: "user-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })
    const action = vi.fn(async () => {
      calls.push("BETTER_AUTH_RESET")
      return "native-response"
    })

    await expect(
      withPasswordResetAuthority(
        "aB3dE5gH7jK9mN2pQ4sT6vX8",
        action,
      ),
    ).resolves.toEqual({ authorized: true, result: "native-response" })

    expect(action).toHaveBeenCalledTimes(1)
    expect(calls.findIndex((call) => call.includes("pg_advisory"))).toBeLessThan(
      calls.findIndex((call) => call.includes("app_user_roles")),
    )
    expect(calls.findIndex((call) => call.includes("app_user_roles"))).toBeLessThan(
      calls.indexOf("BETTER_AUTH_RESET"),
    )
    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["password-reset-user:user-1"],
    )
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it("denies a token whose application role was revoked under the lock", async () => {
    let verificationReads = 0
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes("FROM public.app_user_roles")) return { rows: [] }
      if (sql.includes('FROM public."verification"')) {
        verificationReads += 1
        return { rows: [{ user_id: "user-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })
    const action = vi.fn()

    await expect(
      withPasswordResetAuthority(
        "aB3dE5gH7jK9mN2pQ4sT6vX8",
        action,
      ),
    ).resolves.toEqual({ authorized: false })

    expect(verificationReads).toBe(1)
    expect(action).not.toHaveBeenCalled()
    expect(mocks.clientQuery).toHaveBeenLastCalledWith("COMMIT")
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it("rolls back and releases the lock connection when the native reset fails", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes('FROM public."verification"')) {
        return { rows: [{ user_id: "user-1" }] }
      }
      if (sql.includes("FROM public.app_user_roles")) {
        return { rows: [{ user_id: "user-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    await expect(
      withPasswordResetAuthority(
        "aB3dE5gH7jK9mN2pQ4sT6vX8",
        async () => {
          throw new Error("native reset failed")
        },
      ),
    ).rejects.toThrow("native reset failed")

    expect(mocks.clientQuery).toHaveBeenCalledWith("ROLLBACK")
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })

  it("authorizes delivery only after checking the current role under the user lock", async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
      if (sql.includes("FROM public.app_user_roles")) {
        return { rows: [{ user_id: "user-1" }] }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`)
    })

    await expect(
      authorizePasswordResetDelivery(
        "user-1",
        "aB3dE5gH7jK9mN2pQ4sT6vX8",
      ),
    ).resolves.toBe(true)

    expect(mocks.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["password-reset-user:user-1"],
    )
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).startsWith("DELETE"),
      ),
    ).toBe(false)
  })

  it("silently deletes an undelivered token for a revoked identity", async () => {
    mocks.clientQuery.mockImplementation(
      async (sql: string, parameters?: unknown[]) => {
        if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] }
        if (sql.includes("pg_advisory_xact_lock")) return { rows: [] }
        if (sql.includes("FROM public.app_user_roles")) return { rows: [] }
        if (sql.includes('DELETE FROM public."verification"')) {
          expect(parameters).toEqual([
            "reset-password:aB3dE5gH7jK9mN2pQ4sT6vX8",
            "user-1",
          ])
          return { rows: [] }
        }
        throw new Error(`Unexpected SQL in test: ${sql}`)
      },
    )

    await expect(
      authorizePasswordResetDelivery(
        "user-1",
        "aB3dE5gH7jK9mN2pQ4sT6vX8",
      ),
    ).resolves.toBe(false)

    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes('DELETE FROM public."verification"'),
      ),
    ).toBe(true)
  })
})
