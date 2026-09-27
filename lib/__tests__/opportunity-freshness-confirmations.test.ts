import { describe, expect, it, vi } from "vitest"
import { readOpportunityFreshnessConfirmations } from "@/lib/data/opportunity-freshness-confirmations"

describe("exact source-confirmation projection", () => {
  it("reads each opportunity once in bounded chunks and retains only returned exact confirmations", async () => {
    const ids = Array.from({ length: 101 }, (_, index) => `opportunity-${index}`)
    const rpc = vi.fn().mockImplementation(async (_name: string, args: { p_opportunity_ids: string[] }) => ({
      data: args.p_opportunity_ids.includes("opportunity-100")
        ? [{ opportunity_id: "opportunity-100", confirmation_id: "reply-100", confirmed_at: "2026-09-26T10:00:00Z" }]
        : [],
      error: null,
    }))

    const confirmations = await readOpportunityFreshnessConfirmations(
      { rpc } as never,
      [...ids, "opportunity-100"],
    )

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][1].p_opportunity_ids).toHaveLength(100)
    expect(rpc.mock.calls[1][1].p_opportunity_ids).toEqual(["opportunity-100"])
    expect(confirmations).toEqual(new Map([
      ["opportunity-100", { id: "reply-100", at: "2026-09-26T10:00:00Z" }],
    ]))
  })

  it("fails closed when the exact confirmation projection is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } })
    await expect(readOpportunityFreshnessConfirmations({ rpc } as never, ["opportunity-1"]))
      .rejects.toThrow("The source confirmation clock is unavailable.")
  })
})
