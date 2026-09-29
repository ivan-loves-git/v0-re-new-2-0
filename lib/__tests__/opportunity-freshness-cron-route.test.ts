import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ env: { CRON_SECRET: "synthetic-cron-secret" as string | undefined }, drafts: vi.fn() }))
vi.mock("@/lib/env", () => ({ env: m.env }))
vi.mock("@/lib/opportunity-freshness-drafts", () => ({ runOpportunityFreshnessDrafts: m.drafts }))

import { GET } from "@/app/api/cron/opportunity-freshness/route"

describe("45-day draft-only cron boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.env.CRON_SECRET = "synthetic-cron-secret"
    m.drafts.mockResolvedValue({ prepared: 2, disabled: false })
  })

  it("denies missing and wrong credentials before preparing a draft", async () => {
    m.env.CRON_SECRET = undefined
    expect((await GET(new Request("https://example.test/api/cron/opportunity-freshness"))).status).toBe(401)
    m.env.CRON_SECRET = "synthetic-cron-secret"
    expect((await GET(new Request("https://example.test/api/cron/opportunity-freshness", {
      headers: { authorization: "Bearer wrong" },
    }))).status).toBe(401)
    expect(m.drafts).not.toHaveBeenCalled()
  })

  it("runs only bounded draft preparation after exact authorization", async () => {
    const response = await GET(new Request("https://example.test/api/cron/opportunity-freshness", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ prepared: 2, disabled: false })
    expect(m.drafts).toHaveBeenCalledExactlyOnceWith(30)
  })
})
