import { describe, expect, it, vi } from "vitest"
import {
  findQaValidationDeployment,
  findVercelSuccess,
  probeStableQaAlias,
  QA_STABLE_ALIAS_REQUEST_TIMEOUT_MS,
  waitForStableQaAliasSha,
  waitForQaDeployment,
} from "@/lib/qa/deployment-status.mjs"

const SHA = "a".repeat(40)
const ENVIRONMENT = "Preview – renew-overnight-validation-20260820"
const LANE_MOVED_AT = Date.parse("2026-08-22T14:00:00Z")

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: 6037705275,
    sha: SHA,
    environment: ENVIRONMENT,
    creator: { login: "vercel[bot]" },
    production_environment: false,
    created_at: "2026-08-22T13:50:00Z",
    ...overrides,
  }
}

function status(overrides: Record<string, unknown> = {}) {
  return {
    state: "success",
    creator: { login: "vercel[bot]" },
    created_at: "2026-08-22T14:00:01Z",
    environment_url: "https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app",
    ...overrides,
  }
}

describe("QA deployment status selection", () => {
  it("probes the stable alias with the Vercel bypass and reads its deployed SHA", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 200,
      headers: { "x-renew-deployment-sha": SHA },
    }))

    await expect(probeStableQaAlias({
      origin: "https://qa.example.test",
      bypass: "test-bypass",
      fetchImpl,
    })).resolves.toBe(SHA)
    expect(fetchImpl).toHaveBeenCalledWith("https://qa.example.test/auth/login", {
      headers: {
        "x-vercel-protection-bypass": "test-bypass",
        "x-vercel-set-bypass-cookie": "true",
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    })
  })

  it("fails closed when a stable-alias HTTP request hangs until its abort deadline", async () => {
    const fetchImpl = vi.fn(async (_url, options: RequestInit) => {
      expect(options.signal).toBeInstanceOf(AbortSignal)
      return await new Promise((_, reject) => {
        options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
        if (options.signal?.aborted) reject(new Error("aborted"))
      })
    })
    const setTimer = vi.fn((callback: () => void) => {
      callback()
      return 7 as unknown as ReturnType<typeof setTimeout>
    })
    const clearTimer = vi.fn()

    await expect(probeStableQaAlias({
      origin: "https://qa.example.test",
      bypass: "test-bypass",
      fetchImpl: fetchImpl as typeof fetch,
      requestTimeout: QA_STABLE_ALIAS_REQUEST_TIMEOUT_MS,
      setTimer: setTimer as unknown as typeof setTimeout,
      clearTimer: clearTimer as unknown as typeof clearTimeout,
    })).resolves.toBe("")
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), QA_STABLE_ALIAS_REQUEST_TIMEOUT_MS)
    expect(clearTimer).toHaveBeenCalledWith(7)
  })

  it("fails closed when a stable-alias HTTP request rejects", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("network unavailable") })

    await expect(probeStableQaAlias({
      origin: "https://qa.example.test",
      bypass: "test-bypass",
      fetchImpl,
    })).resolves.toBe("")
  })

  it("follows only same-origin alias redirects and carries the bypass cookie", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: {
          location: "/auth/login?redirected=true",
          "set-cookie": "_vercel_jwt=test-cookie; Path=/; Secure",
        },
      }))
      .mockResolvedValueOnce(new Response(null, {
        status: 200,
        headers: { "x-renew-deployment-sha": SHA },
      }))

    await expect(probeStableQaAlias({
      origin: "https://qa.example.test",
      bypass: "test-bypass",
      fetchImpl,
    })).resolves.toBe(SHA)
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://qa.example.test/auth/login?redirected=true", {
      headers: {
        "x-vercel-protection-bypass": "test-bypass",
        "x-vercel-set-bypass-cookie": "true",
        Cookie: "_vercel_jwt=test-cookie",
      },
      redirect: "manual",
      signal: expect.any(AbortSignal),
    })
  })

  it("refuses a cross-origin alias redirect without forwarding the bypass", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example/collect" },
    }))

    await expect(probeStableQaAlias({
      origin: "https://qa.example.test",
      bypass: "test-bypass",
      fetchImpl,
    })).resolves.toBe("")
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("waits for a stale stable alias to converge to the admitted SHA", async () => {
    const sleep = vi.fn(async () => undefined)
    const probeAliasSha = vi.fn()
      .mockResolvedValueOnce("b".repeat(40))
      .mockResolvedValueOnce(SHA)
    const times = [0, 5_000, 5_000]

    await expect(waitForStableQaAliasSha({
      expectedSha: SHA,
      probeAliasSha,
      deadline: 10_000,
      now: () => times.shift() ?? 10_000,
      sleep,
      pollInterval: 5_000,
    })).resolves.toBe(SHA)

    expect(probeAliasSha).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(sleep).toHaveBeenCalledWith(5_000)
  })

  it("fails closed when the stable alias never serves the admitted SHA", async () => {
    const sleep = vi.fn(async () => undefined)
    const probeAliasSha = vi.fn(async () => "b".repeat(40))
    const times = [0, 5_000, 5_000, 10_000]

    await expect(waitForStableQaAliasSha({
      expectedSha: SHA,
      probeAliasSha,
      deadline: 10_000,
      now: () => times.shift() ?? 10_000,
      sleep,
      pollInterval: 5_000,
    })).rejects.toThrow("QA stable alias wait failed: timeout")

    expect(probeAliasSha).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it("never sleeps beyond the remaining stable-alias convergence budget", async () => {
    const sleep = vi.fn(async () => undefined)
    const times = [0, 9_500, 10_000]

    await expect(waitForStableQaAliasSha({
      expectedSha: SHA,
      probeAliasSha: async () => "b".repeat(40),
      deadline: 10_000,
      now: () => times.shift() ?? 10_000,
      sleep,
      pollInterval: 5_000,
    })).rejects.toThrow("QA stable alias wait failed: timeout")

    expect(sleep).toHaveBeenCalledExactlyOnceWith(500)
  })

  it("accepts an old success only when the stable alias serves the exact SHA", async () => {
    const oldSuccess = status({ created_at: "2026-08-22T13:59:59Z" })

    await expect(waitForQaDeployment({
      expectedSha: SHA,
      expectedEnvironment: ENVIRONMENT,
      laneMovedAt: LANE_MOVED_AT,
      deadline: LANE_MOVED_AT + 1,
      now: () => LANE_MOVED_AT,
      sleep: async () => undefined,
      listDeployments: async () => [deployment()],
      listStatuses: async () => [oldSuccess],
      probeAliasSha: async () => SHA,
    })).resolves.toEqual({
      deploymentId: deployment().id,
      readyAt: "2026-08-22T14:00:00.000Z",
      providerUrl: oldSuccess.environment_url,
    })
  })

  it("accepts a reused deployment created before the pointer when success arrives after it", () => {
    expect(findQaValidationDeployment([deployment()], SHA, ENVIRONMENT)).toEqual(deployment())
    expect(findVercelSuccess([status()])).toEqual(status())
  })

  it("keeps waiting and times out while the stable alias serves another SHA", async () => {
    const sleep = vi.fn(async () => undefined)
    const times = [LANE_MOVED_AT, LANE_MOVED_AT + 2]

    await expect(waitForQaDeployment({
      expectedSha: SHA,
      expectedEnvironment: ENVIRONMENT,
      laneMovedAt: LANE_MOVED_AT,
      deadline: LANE_MOVED_AT + 1,
      now: () => times.shift() ?? LANE_MOVED_AT + 2,
      sleep,
      listDeployments: async () => [deployment()],
      listStatuses: async () => [status({ created_at: "2026-08-22T13:59:59Z" })],
      probeAliasSha: async () => "b".repeat(40),
    })).rejects.toThrow("QA deployment wait failed: timeout")
    expect(sleep).toHaveBeenCalledOnce()
  })

  it("uses a new success time when it is later than the pointer", async () => {
    await expect(waitForQaDeployment({
      expectedSha: SHA,
      expectedEnvironment: ENVIRONMENT,
      laneMovedAt: LANE_MOVED_AT,
      deadline: LANE_MOVED_AT + 2,
      now: () => LANE_MOVED_AT,
      sleep: async () => undefined,
      listDeployments: async () => [deployment()],
      listStatuses: async () => [status()],
      probeAliasSha: async () => SHA,
    })).resolves.toMatchObject({ readyAt: "2026-08-22T14:00:01.000Z" })
  })

  it.each([
    ["SHA", { sha: "b".repeat(40) }],
    ["validation project", { environment: "Preview – another-project" }],
    ["creator", { creator: { login: "github-actions[bot]" } }],
    ["production target", { production_environment: true }],
  ])("rejects a deployment with the wrong %s", (_label, mutation) => {
    expect(findQaValidationDeployment([deployment(mutation)], SHA, ENVIRONMENT)).toBeUndefined()
  })

  it("rejects a post-pointer failure without a success", () => {
    expect(findVercelSuccess([
      status({ state: "failure", created_at: "2026-08-22T14:00:02Z" }),
    ])).toBeUndefined()
  })

  it("keeps exact deployed identity and protection verification immediately after the explicit deploy", async () => {
    const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(".github/workflows/golden-journeys.yml", "utf8"))
    expect(workflow).toMatch(
      /- name: Explicitly deploy admitted candidate branch and SHA[\s\S]*?run: node scripts\/qa\/deploy-admitted-candidate\.mjs/,
    )
    expect(workflow).toContain("Upload sanitized provider deploy evidence")
    expect(workflow).toContain("load-provider-evidence.mjs")
    expect(workflow).toContain("Verify deployed application identities before database mutation")
    expect(workflow).toContain("secrets.QA_VERCEL_TOKEN")
    expect(workflow).not.toContain("Wait for exact qa deployment Ready event")
    expect(workflow).not.toContain("createDeployments")
    expect(workflow).not.toContain("git.deploymentEnabled")
    expect(workflow).not.toContain("workflow_run:")
  })

  it("uses the bounded stable-alias convergence waiter after assignment", async () => {
    const controller = await import("node:fs/promises").then(({ readFile }) => readFile("scripts/qa/deploy-admitted-candidate.mjs", "utf8"))
    const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(".github/workflows/golden-journeys.yml", "utf8"))
    expect(controller).toContain("waitForStableQaAliasSha")
    expect(controller).toMatch(/deadline: Date\.now\(\) \+ 2 \* 60 \* 1000/)
    expect(controller).toContain("pollInterval: 5_000")
    expect(controller).toContain('fail("alias-sha")')
    expect(workflow).toMatch(/deploy-qa:[\s\S]*?timeout-minutes: 15/)
    const providerReadinessMs = 8 * 60 * 1000
    const aliasConvergenceMs = 2 * 60 * 1000
    const workflowBudgetMs = 15 * 60 * 1000
    expect(workflowBudgetMs - providerReadinessMs - aliasConvergenceMs).toBeGreaterThanOrEqual(5 * 60 * 1000)
  })
})
