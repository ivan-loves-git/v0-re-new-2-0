import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  uploadToSignedUrl: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl: mocks.uploadToSignedUrl }),
    },
  }),
}))

import {
  PRIVATE_DOCUMENT_MAX_BYTES,
  uploadPrivateDocument,
} from "@/lib/private-upload"

const intent = {
  intentId: "00000000-0000-4000-8000-000000000001",
  finalizeSecret: "s".repeat(43),
  bucket: "opportunity-documents",
  path: "opportunity/documents/random-document.pdf",
  token: "signed-upload-token",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("W-165 browser direct upload", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.uploadToSignedUrl.mockReset().mockResolvedValue({ error: null })
  })

  it("accepts exactly 20 MiB and sends the bytes only to the signed Storage path", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(intent))
      .mockResolvedValueOnce(jsonResponse({ documentId: "document-1" }))
    vi.stubGlobal("fetch", fetchMock)
    const file = new File(
      [new Uint8Array(PRIVATE_DOCUMENT_MAX_BYTES)],
      "information-memorandum.pdf",
      { type: "application/pdf" },
    )

    await expect(uploadPrivateDocument(file, {
      kind: "opportunity_document",
      resourceId: "00000000-0000-4000-8000-000000000002",
      metadata: {
        document_type: "deal_book",
        visibility: "staff_only",
        title: "Information memorandum",
      },
    })).resolves.toEqual({ documentId: "document-1" })

    const intentPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(intentPayload.sizeBytes).toBe(PRIVATE_DOCUMENT_MAX_BYTES)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/private-uploads/intents",
      "/api/private-uploads/finalize",
    ])
    expect(mocks.uploadToSignedUrl).toHaveBeenCalledWith(
      intent.path,
      intent.token,
      file,
      { contentType: "application/pdf" },
    )
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain("%PDF")
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).not.toContain(file.name)
  })

  it("rejects 20 MiB plus one byte before creating an intent", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const file = new File(
      [new Uint8Array(PRIVATE_DOCUMENT_MAX_BYTES + 1)],
      "too-large.pdf",
      { type: "application/pdf" },
    )

    await expect(uploadPrivateDocument(file, {
      kind: "opportunity_document",
    })).rejects.toThrow("File size must not exceed 20 MiB")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.uploadToSignedUrl).not.toHaveBeenCalled()
  })

  it("closes the exact intent when direct Storage upload fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(intent))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
    vi.stubGlobal("fetch", fetchMock)
    mocks.uploadToSignedUrl.mockResolvedValue({ error: { message: "storage unavailable" } })
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "nda.pdf", {
      type: "application/pdf",
    })

    await expect(uploadPrivateDocument(file, {
      kind: "portal_signed_nda",
      resourceId: "00000000-0000-4000-8000-000000000003",
    })).rejects.toThrow("private file upload failed")

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/private-uploads/intents",
      "/api/private-uploads/abort",
    ])
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      intentId: intent.intentId,
      finalizeSecret: intent.finalizeSecret,
    })
  })

  it("rejects a MIME and extension mismatch before requesting authority", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const file = new File(["not really a PDF"], "memo.pdf", { type: "text/plain" })

    await expect(uploadPrivateDocument(file, {
      kind: "opportunity_document",
    })).rejects.toThrow("file type does not match")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
