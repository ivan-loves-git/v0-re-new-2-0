import { describe, expect, it } from "vitest"
import {
  findPostLaneVercelSuccess,
  findQaValidationDeployment,
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
    environment_url: "https://renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app",
    ...overrides,
  }
}

describe("QA deployment status selection", () => {
  it("accepts a reused deployment created before the pointer when success arrives after it", () => {
    expect(findQaValidationDeployment([deployment()], SHA, ENVIRONMENT)).toEqual(deployment())
    expect(findPostLaneVercelSuccess([status()], LANE_MOVED_AT)).toEqual(status())
  })

  it("rejects a success status created before the pointer", () => {
    expect(findPostLaneVercelSuccess([
      status({ created_at: "2026-08-22T13:59:59Z" }),
    ], LANE_MOVED_AT)).toBeUndefined()
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
    expect(findPostLaneVercelSuccess([
      status({ state: "failure", created_at: "2026-08-22T14:00:02Z" }),
    ], LANE_MOVED_AT)).toBeUndefined()
  })

  it("keeps exact deployed identity and protection verification immediately after the wait", async () => {
    const workflow = await import("node:fs/promises").then(({ readFile }) => readFile(".github/workflows/golden-journeys.yml", "utf8"))
    expect(workflow).toMatch(
      /- name: Wait for exact qa deployment Ready event[\s\S]*?run: node scripts\/qa\/wait-for-qa-deployment\.mjs\n\n      - name: Verify deployed application identities before database mutation\n        run: pnpm qa:deployed-contract:verify/,
    )
  })
})
