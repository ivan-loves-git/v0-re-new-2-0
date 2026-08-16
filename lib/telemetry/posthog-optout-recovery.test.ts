import { describe, expect, it } from "vitest"
import { __test__, recoverLegacyPostHogOptOut } from "@/lib/telemetry/posthog-optout-recovery"

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

function controlledIngestion(storage: ReturnType<typeof memoryStorage>, optedOut: boolean) {
  const requests: Array<{ path: string; event: string; properties: Record<string, string> }> = []
  const client = {
    clear_opt_in_out_capturing: () => { optedOut = false },
    capture: (event: string, properties: Record<string, string>) => {
      if (!optedOut) requests.push({ path: "/capture/", event, properties })
    },
  }
  recoverLegacyPostHogOptOut(client, storage)
  client.capture("wave_page_viewed", {
    route_template: "/portal/pursuits", workflow: "external_pursuit", role: "repreneur",
  })
  client.capture("wave_action_succeeded", {
    action: "submit", outcome: "success", workflow: "external_pursuit", role: "repreneur",
  })
  return requests
}

describe("legacy PostHog opt-out recovery", () => {
  it("recovers the one app-owned stale opt-out before the migration marker exists", () => {
    const storage = memoryStorage()
    let staleOptOut = true
    const client = { clear_opt_in_out_capturing: () => { staleOptOut = false } }

    expect(recoverLegacyPostHogOptOut(client, storage)).toBe(true)
    expect(staleOptOut).toBe(false)
    expect(storage.getItem(__test__.LEGACY_OPTOUT_RECOVERY_MARKER)).toBe("complete")
  })

  it("preserves a later opt-out once the migration marker exists", () => {
    const storage = memoryStorage({ [__test__.LEGACY_OPTOUT_RECOVERY_MARKER]: "complete" })
    let clearCalls = 0
    const client = { clear_opt_in_out_capturing: () => { clearCalls += 1 } }

    expect(recoverLegacyPostHogOptOut(client, storage)).toBe(false)
    expect(clearCalls).toBe(0)
  })

  it("does not write the marker when clearing the stale state fails", () => {
    const storage = memoryStorage()
    const client = { clear_opt_in_out_capturing: () => { throw new Error("unavailable") } }

    expect(recoverLegacyPostHogOptOut(client, storage)).toBe(false)
    expect(storage.getItem(__test__.LEGACY_OPTOUT_RECOVERY_MARKER)).toBeNull()
  })

  it("models exactly one recovered page and confirmed completion at the capture boundary", () => {
    const requests = controlledIngestion(memoryStorage(), true)

    expect(requests).toHaveLength(2)
    expect(requests.map((request) => [request.path, request.event])).toEqual([
      ["/capture/", "wave_page_viewed"],
      ["/capture/", "wave_action_succeeded"],
    ])
    expect(JSON.stringify(requests)).not.toMatch(/title|dossier|attachment|filename|note|company|contact|idempotency|[0-9a-f]{8}-[0-9a-f-]{27}/i)
  })

  it("models no capture after a marker-protected later opt-out", () => {
    const requests = controlledIngestion(
      memoryStorage({ [__test__.LEGACY_OPTOUT_RECOVERY_MARKER]: "complete" }),
      true,
    )

    expect(requests).toEqual([])
  })
})
