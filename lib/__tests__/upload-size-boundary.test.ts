import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  createAdminClient: vi.fn(),
  verifyAndConsumeIntakeUploadToken: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
  recalculateRepreneurScoresAndMatches: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/security/intake-upload", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/security/intake-upload")
  >()
  return {
    ...original,
    verifyAndConsumeIntakeUploadToken:
      mocks.verifyAndConsumeIntakeUploadToken,
  }
})
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateRepreneurDashboardTags:
    mocks.revalidateRepreneurDashboardTags,
}))
vi.mock("@/lib/repreneur-profile-refresh", () => ({
  recalculateRepreneurScoresAndMatches:
    mocks.recalculateRepreneurScoresAndMatches,
}))

import { POST } from "@/app/api/upload-cv/route"
import {
  LEGACY_MULTIPART_MAX_FILE_BYTES,
  LEGACY_MULTIPART_MAX_FILE_LABEL,
  VERCEL_FUNCTION_MAX_REQUEST_BYTES,
} from "@/lib/upload-limits"

function pdfFile(size: number) {
  const bytes = new Uint8Array(size)
  bytes.set([0x25, 0x50, 0x44, 0x46])
  return new File([bytes], "synthetic-cv.pdf", { type: "application/pdf" })
}

function multipartRequest(
  file: File,
  options: { contentLength?: string; anonymous?: boolean } = {},
) {
  const form = new FormData()
  form.set("file", file)
  form.set("documentType", "cv")
  if (!options.anonymous) form.set("repreneurId", "repreneur-synthetic-1")
  const encoded = new Request("https://app.re-new.team/api/upload-cv", {
    method: "POST",
    body: form,
  })
  const headers = new Headers(encoded.headers)
  if (options.contentLength !== undefined) {
    headers.set("content-length", options.contentLength)
  }
  if (options.anonymous) {
    headers.set("x-intake-upload-token", "synthetic-one-use-token")
  }
  return new Request(encoded.url, {
    method: "POST",
    headers,
    body: encoded.body,
    duplex: "half",
  } as RequestInit) as Parameters<typeof POST>[0]
}

function successfulAdminClient() {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  return {
    client: {
      storage: { from: vi.fn(() => ({ upload })) },
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: updateEq })),
      })),
    },
    upload,
    updateEq,
  }
}

describe("W-153 legacy multipart CV and LDC upload ceiling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue({
      role: "staff",
      user: { id: "staff-synthetic-1" },
    })
    mocks.verifyAndConsumeIntakeUploadToken.mockResolvedValue({
      id: "grant-synthetic-1",
    })
  })

  it("accepts a normal file at the exact 4 MB application ceiling", async () => {
    const admin = successfulAdminClient()
    mocks.createAdminClient.mockReturnValue(admin.client)

    const response = await POST(multipartRequest(pdfFile(LEGACY_MULTIPART_MAX_FILE_BYTES)))

    expect(response.status).toBe(200)
    expect(admin.upload).toHaveBeenCalledOnce()
    expect(admin.updateEq).toHaveBeenCalledWith("id", "repreneur-synthetic-1")
  })

  it("rejects a file one byte over 4 MB before Storage or record persistence", async () => {
    const response = await POST(
      multipartRequest(pdfFile(LEGACY_MULTIPART_MAX_FILE_BYTES + 1)),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: `File size must not exceed ${LEGACY_MULTIPART_MAX_FILE_LABEL}`,
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("does not trust a false small Content-Length to bypass the file limit", async () => {
    const response = await POST(
      multipartRequest(pdfFile(LEGACY_MULTIPART_MAX_FILE_BYTES + 1), {
        contentLength: "1",
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("keeps anonymous capability consumption ahead of multipart parsing", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(null)

    const response = await POST(
      multipartRequest(pdfFile(LEGACY_MULTIPART_MAX_FILE_BYTES + 1), {
        anonymous: true,
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.verifyAndConsumeIntakeUploadToken).toHaveBeenCalledOnce()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("keeps the 4.5 MB outer envelope as an early rejection only", async () => {
    const response = await POST(
      multipartRequest(pdfFile(4), {
        contentLength: String(VERCEL_FUNCTION_MAX_REQUEST_BYTES + 1),
      }),
    )

    expect(response.status).toBe(413)
    expect(mocks.getCurrentUserAccess).not.toHaveBeenCalled()
    expect(mocks.verifyAndConsumeIntakeUploadToken).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("uses the 20 MiB direct-upload constant on every current CV and LDC surface", () => {
    const directUploadSurfaces = [
      "components/intake-v2/steps/step-contact.tsx",
      "components/intake-v2/steps/step-needs.tsx",
      "components/repreneurs/cv-section.tsx",
      "components/repreneurs/documents-card.tsx",
      "components/portal/repreneur-target-thesis-editor.tsx",
      "lib/types/intake-v2.ts",
    ]
    for (const relativePath of directUploadSurfaces) {
      const source = readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
      expect(source, relativePath).toContain("CV_LDC_MAX_FILE_BYTES")
    }

    const legacyRoute = readFileSync(`${process.cwd()}/app/api/upload-cv/route.ts`, "utf8")
    expect(legacyRoute).toContain("LEGACY_MULTIPART_MAX_FILE_BYTES")
    expect(legacyRoute).not.toContain("CV_LDC_MAX_FILE_BYTES")
  })
})
