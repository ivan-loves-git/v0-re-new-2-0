import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({
  getSession: vi.fn(),
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}))
vi.mock("better-auth", () => ({
  betterAuth: () => ({ api: { getSession: boundary.getSession } }),
}))
vi.mock("better-auth/next-js", () => ({
  nextCookies: () => ({ id: "test-cookies" }),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("pg", () => ({
  Pool: class {
    connect = boundary.connect
  },
}))

import { exportFullOpportunityCsv } from "@/lib/actions/opportunity-full-export"

describe("full export server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boundary.connect.mockResolvedValue({
      query: boundary.query,
      release: boundary.release,
    })
    boundary.query.mockResolvedValue({ rows: [] })
    boundary.getSession.mockResolvedValue(null)
  })

  it("returns no file for missing confirmation or an unauthenticated caller", async () => {
    expect(await exportFullOpportunityCsv(false)).toEqual({
      ok: false,
      error: "Confirm the confidential full export before downloading.",
    })
    expect(boundary.getSession).not.toHaveBeenCalled()
    expect(await exportFullOpportunityCsv(true)).toEqual({
      ok: false,
      error:
        "Staff access is required for the full export. Please sign in again.",
    })
    expect(boundary.connect).not.toHaveBeenCalled()
  })

  it("denies a repreneur or revoked staff role before reading any opportunity data", async () => {
    boundary.getSession.mockResolvedValue({
      user: { id: "buyer-user", email: "buyer@example.invalid" },
    })
    const result = await exportFullOpportunityCsv(true)
    expect(result).toEqual({
      ok: false,
      error:
        "Staff access is required for the full export. Please sign in again.",
    })
    expect(
      boundary.query.mock.calls.some(([sql]) =>
        String(sql).includes("public.opportunities"),
      ),
    ).toBe(false)
    expect(boundary.release).toHaveBeenCalled()
  })

  it("downloads all rows from one read-only snapshot after a fresh staff session check", async () => {
    boundary.getSession.mockResolvedValue({
      user: { id: "staff-user", email: " Staff@Example.invalid " },
    })
    boundary.query.mockImplementation(async (sql: string) => {
      if (sql.includes("public.app_user_roles"))
        return { rows: [{ allowed: 1 }] }
      if (sql.includes("FROM public.opportunities AS record"))
        return {
          rows: Array.from({ length: 1005 }, (_, index) => ({
            record: {
              id: `opportunity-${index}`,
              reference: `FR-${index}`,
              status: "closed",
              is_demo: false,
            },
          })),
        }
      return { rows: [] }
    })
    const result = await exportFullOpportunityCsv(true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.csv.split("\n")).toHaveLength(1006)
    expect(result.csv).toContain("opportunity-1004")
    expect(result.filename).toMatch(
      /^wave-full-opportunities-pursuits-.*\.csv$/,
    )
    expect(boundary.getSession.mock.calls[0][0].query).toEqual({
      disableCookieCache: true,
    })
    const sql = boundary.query.mock.calls.map(([query]) => String(query))
    expect(sql[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    expect(sql).toContain("COMMIT")
    expect(
      sql
        .filter((query) =>
          query.includes("FROM public.opportunities AS record"),
        )
        .join(),
    ).not.toMatch(/LIMIT|OFFSET|SELECT \*/i)
    expect(sql.join()).not.toMatch(
      /INSERT|UPDATE|DELETE|storage_path|external_url|idempotency_key|request_fingerprint|prior_attempts/,
    )
  })

  it("returns a clear failure instead of a partial file when a later dataset fails", async () => {
    boundary.getSession.mockResolvedValue({
      user: { id: "staff-user", email: "staff@example.invalid" },
    })
    boundary.query.mockImplementation(async (sql: string) => {
      if (sql.includes("public.app_user_roles"))
        return { rows: [{ allowed: 1 }] }
      if (sql.includes("public.opportunity_pursuit_evidence"))
        throw new Error("PRIVATE_DATABASE_DIAGNOSTIC")
      return { rows: [] }
    })
    expect(await exportFullOpportunityCsv(true)).toEqual({
      ok: false,
      error:
        "The full export is unavailable. No file was downloaded. Please try again.",
    })
    expect(boundary.release).toHaveBeenCalled()
    expect(boundary.query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK")
  })
})
