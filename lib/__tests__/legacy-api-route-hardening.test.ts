import { NextRequest } from "next/server"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  getCurrentUserAccess: vi.fn(),
  calculateTier1Score: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mocks.createServerClient,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))
vi.mock("@/lib/utils/tier1-scoring", () => ({
  calculateTier1Score: mocks.calculateTier1Score,
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(),
}))

import { POST as seed } from "@/app/api/seed/route"
import { POST as updateJourneyStages } from "@/app/api/update-journey-stages/route"
import { POST as resetAvatar } from "@/app/api/reset-avatar/route"
import { POST as uploadAvatar } from "@/app/api/upload-avatar/route"
import { POST as saveScrapbookReview } from "@/app/api/scrapbook/review/route"
import { GET as getWavySuggestions } from "@/app/api/wavy/suggestions/route"

const STAFF = { role: "staff", user: { id: "qa-staff" } }
const routeSources = [
  "app/api/update-journey-stages/route.ts",
  "app/api/seed/route.ts",
  "app/api/reset-avatar/route.ts",
  "app/api/upload-avatar/route.ts",
  "app/api/scrapbook/review/route.ts",
  "app/api/wavy/suggestions/route.ts",
].map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))

function failingServerClient(message: string) {
  return {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message } }) })),
      select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message } }) })),
    })),
  }
}

describe("legacy operational API hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF)
  })

  afterEach(() => vi.unstubAllEnvs())

  it("does not interpolate backend errors into operational API responses", () => {
    for (const source of routeSources) {
      expect(source).not.toMatch(/error:\s*[^,}\n]*(?:\.message|String\(error\))/)
    }
  })

  it.each([
    ["seed", seed],
    ["journey-stage distribution", updateJourneyStages],
    ["Wavy suggestions", getWavySuggestions],
  ])("does not expose the %s legacy endpoint in production before dependencies run", async (_name, handler) => {
    vi.stubEnv("NODE_ENV", "production")

    const response = await handler()

    expect(response.status).toBe(404)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.getCurrentUserAccess).not.toHaveBeenCalled()
  })

  it("keeps a reset-avatar database failure generic", async () => {
    const privateFailure = "avatars table unavailable for qa.person@example.test"
    mocks.createServerClient.mockResolvedValue(failingServerClient(privateFailure))

    const response = await resetAvatar(new NextRequest("http://localhost/api/reset-avatar", {
      method: "POST",
      body: JSON.stringify({ repreneurId: "qa-repreneur" }),
    }))

    const body = await response.text()
    expect(response.status).toBe(500)
    expect(JSON.parse(body)).toEqual({ error: "Unable to reset avatar" })
    expect(body).not.toContain(privateFailure)
  })

  it("keeps an avatar storage failure generic", async () => {
    const privateFailure = "storage token secret-for-qa.person@example.test"
    mocks.createServerClient.mockResolvedValue({
      storage: {
        from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ data: null, error: { message: privateFailure } }) })),
      },
    })
    const formData = new FormData()
    formData.set("repreneurId", "qa-repreneur")
    formData.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", { type: "image/jpeg" }))

    const response = await uploadAvatar(new NextRequest("http://localhost/api/upload-avatar", {
      method: "POST",
      body: formData,
    }))

    const body = await response.text()
    expect(response.status).toBe(500)
    expect(JSON.parse(body)).toEqual({ error: "Unable to upload avatar" })
    expect(body).not.toContain(privateFailure)
  })

  it("keeps a scrapbook persistence failure generic", async () => {
    const privateFailure = "clipboard constraint on qa.person@example.test"
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({ error: { message: privateFailure } }) })),
    })

    const response = await saveScrapbookReview(new NextRequest("http://localhost/api/scrapbook/review", {
      method: "POST",
      body: JSON.stringify({ title: "QA", content: "A private review" }),
    }))

    const body = await response.text()
    expect(response.status).toBe(500)
    expect(JSON.parse(body)).toEqual({ error: "Unable to save review" })
    expect(body).not.toContain(privateFailure)
  })

  it("keeps a Wavy suggestions persistence failure generic", async () => {
    const privateFailure = "repreneurs error for qa.person@example.test"
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            not: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: privateFailure } }),
            })),
          })),
        })),
      })),
    })

    const response = await getWavySuggestions()

    const body = await response.text()
    expect(response.status).toBe(500)
    expect(JSON.parse(body)).toEqual({ error: "Unable to load suggestions" })
    expect(body).not.toContain(privateFailure)
  })
})
