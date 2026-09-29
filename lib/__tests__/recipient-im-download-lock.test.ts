import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ connect: vi.fn(), query: vi.fn(), release: vi.fn(), poolConfig: vi.fn() }))
vi.mock("pg", () => ({ Pool: class {
  constructor(config: unknown) { mocks.poolConfig(config) }
  connect() { return mocks.connect() }
} }))
vi.mock("@/lib/env", () => ({ env: { DATABASE_URL: "postgres://synthetic@127.0.0.1:1/synthetic" } }))

import { withRecipientImPursuitLock } from "@/lib/recipient-im-download-lock"

describe("recipient IM download serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release })
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith("SELECT")
      ? { rows: [{ id: "match-a" }] } : { rows: [] })
  })

  it("holds the match share lock through the final buffered-response work", async () => {
    const work = vi.fn(async () => {
      expect(mocks.query.mock.calls.map(([sql]) => sql)).toEqual([
        "BEGIN", "SET LOCAL lock_timeout = '15s'",
        "SELECT id FROM public.opportunity_matches WHERE id=$1 FOR SHARE",
      ])
      return "prepared-private-response"
    })
    expect(await withRecipientImPursuitLock("match-a", work)).toBe("prepared-private-response")
    expect(mocks.poolConfig).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: false },
    }))
    expect(mocks.query.mock.calls.at(-1)).toEqual(["COMMIT"])
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it("rolls back and never delivers when reauthorization fails", async () => {
    await expect(withRecipientImPursuitLock("match-a", async () => {
      throw new Error("access revoked")
    })).rejects.toThrow("access revoked")
    expect(mocks.query.mock.calls.at(-1)).toEqual(["ROLLBACK"])
    expect(mocks.release).toHaveBeenCalledOnce()
  })
})
