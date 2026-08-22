import { describe, expect, it, vi } from "vitest"
import {
  findQaValidationDeployment,
  findVercelSuccess,
  probeStableQaAlias,
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
    })
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

  it("keeps exact deployed identity and protection verification immediately after the wait", async () => {
    const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(".github/workflows/golden-journeys.yml", "utf8"))
    expect(workflow).toMatch(
      /- name: Wait for exact qa deployment Ready event[\s\S]*?run: node scripts\/qa\/wait-for-qa-deployment\.mjs\n\n      - name: Verify deployed application identities before database mutation\n        run: pnpm qa:deployed-contract:verify/,
    )
  })
})
