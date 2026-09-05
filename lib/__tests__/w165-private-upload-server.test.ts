import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  createAdminClient: vi.fn(),
  assertSafePdfEvidence: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
  recalculateRepreneurScoresAndMatches: vi.fn(),
  PdfEvidenceValidationError: class MockPdfEvidenceValidationError extends Error {},
  PdfEvidenceRuntimeError: class MockPdfEvidenceRuntimeError extends Error {},
}))

vi.mock("@/lib/env", () => ({
  env: {
    BETTER_AUTH_URL: "https://app.re-new.team",
    BETTER_AUTH_SECRET: "test-secret",
  },
}))
vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/security/pdf-evidence", () => ({
  assertSafePdfEvidence: mocks.assertSafePdfEvidence,
  PdfEvidenceValidationError: mocks.PdfEvidenceValidationError,
  PdfEvidenceRuntimeError: mocks.PdfEvidenceRuntimeError,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
  revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags,
}))
vi.mock("@/lib/repreneur-profile-refresh", () => ({
  recalculateRepreneurScoresAndMatches: mocks.recalculateRepreneurScoresAndMatches,
}))

import {
  createPrivateUploadIntent,
  finalizePrivateUpload,
  PrivateUploadError,
  readPrivateUploadJson,
  W165_MAX_BYTES,
} from "@/lib/private-upload-server"

const opportunityId = "00000000-0000-4000-8000-000000000010"
const intentId = "00000000-0000-4000-8000-000000000011"
const secret = "s".repeat(43)

function request(body: unknown, origin = "https://app.re-new.team") {
  return new Request("https://app.re-new.team/api/private-uploads/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Host: "app.re-new.team",
    },
    body: JSON.stringify(body),
  })
}

function staffAccess() {
  return {
    role: "staff",
    repreneurId: null,
    user: { id: "staff-user", email: "staff@example.test" },
  }
}

function pendingPdfIntent(bytes: Uint8Array) {
  return {
    id: intentId,
    actor_kind: "staff",
    actor_key: "staff:staff-user:",
    actor_user_id: "staff-user",
    actor_repreneur_id: null,
    actor_email: "staff@example.test",
    actor_fingerprint: null,
    upload_kind: "opportunity_document",
    resource_id: opportunityId,
    related_id: null,
    bucket_id: "opportunity-documents",
    storage_path: `${opportunityId}/documents/${intentId}-memo.pdf`,
    original_filename: "memo.pdf",
    content_type: "application/pdf",
    declared_size: bytes.byteLength,
    metadata: { document_type: "deal_book", visibility: "staff_only", title: "Memo" },
    finalize_secret_hash: createHash("sha256").update(secret).digest("hex"),
    status: "pending",
    content_sha256: null,
    result: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  }
}

function validationFailureClient(bytes: Uint8Array, closeRpc: ReturnType<typeof vi.fn>) {
  const intent = pendingPdfIntent(bytes)
  return {
    from: vi.fn((table: string) => {
      if (table !== "private_upload_intents") throw new Error(`Unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: intent, error: null }) }),
        }),
      }
    }),
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
          error: null,
        }),
      }),
    },
    rpc: closeRpc,
  }
}

describe("W-165 server upload authority", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue(staffAccess())
    mocks.assertSafePdfEvidence.mockResolvedValue(undefined)
  })

  it("authorizes an exact 20 MiB private path without receiving file bytes", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { token: "signed-token" },
      error: null,
    })
    const client = {
      from: vi.fn((table: string) => {
        if (table === "opportunities") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: opportunityId }, error: null }) }),
            }),
          }
        }
        if (table === "private_upload_intents") return { insert }
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: { from: () => ({ createSignedUploadUrl }) },
    }
    mocks.createAdminClient.mockReturnValue(client)

    const result = await createPrivateUploadIntent(request({}), {
      kind: "opportunity_document",
      resourceId: opportunityId,
      relatedId: null,
      fileName: "memo.pdf",
      contentType: "application/pdf",
      sizeBytes: W165_MAX_BYTES,
      metadata: {
        document_type: "deal_book",
        visibility: "staff_only",
        title: "Information memorandum",
      },
      idempotencyKey: "00000000-0000-4000-8000-000000000012",
    })

    expect(result).toMatchObject({
      bucket: "opportunity-documents",
      token: "signed-token",
    })
    expect(result.path).toMatch(new RegExp(`^${opportunityId}/documents/`))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      declared_size: W165_MAX_BYTES,
      bucket_id: "opportunity-documents",
      content_type: "application/pdf",
    }))
    expect(createSignedUploadUrl).toHaveBeenCalledWith(result.path, { upsert: false })
  })

  it("rejects one byte over 20 MiB and a cross-origin request before authorization", async () => {
    await expect(createPrivateUploadIntent(request({}), {
      kind: "opportunity_document",
      resourceId: opportunityId,
      fileName: "memo.pdf",
      contentType: "application/pdf",
      sizeBytes: W165_MAX_BYTES + 1,
      metadata: {},
      idempotencyKey: "00000000-0000-4000-8000-000000000013",
    })).rejects.toThrow("between 1 byte and 20 MiB")

    await expect(createPrivateUploadIntent(request({}, "https://attacker.invalid"), {
      kind: "opportunity_document",
      resourceId: opportunityId,
      fileName: "memo.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      metadata: {
        document_type: "deal_book",
        visibility: "staff_only",
        title: "Information memorandum",
      },
      idempotencyKey: "00000000-0000-4000-8000-000000000014",
    })).rejects.toMatchObject({ status: 403 })
    expect(mocks.getCurrentUserAccess).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects a staff NDA intent for historical cross-namespace pursuit data", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "opportunities") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { id: opportunityId }, error: null }) }),
            }),
          }
        }
        if (table === "opportunity_matches") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "00000000-0000-4000-8000-000000000020",
                      opportunity_id: opportunityId,
                      status: "active_pursuit",
                      opportunity: { status: "active", is_demo: false },
                      repreneur: { is_demo: true },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table ${table}`)
      }),
    }
    mocks.createAdminClient.mockReturnValue(client)

    await expect(createPrivateUploadIntent(request({}), {
      kind: "staff_nda_artifact",
      resourceId: opportunityId,
      relatedId: "00000000-0000-4000-8000-000000000020",
      fileName: "signed-nda.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      metadata: { artifact_role: "renew_signed_copy", title: "Signed NDA" },
      idempotencyKey: "00000000-0000-4000-8000-000000000021",
    })).rejects.toMatchObject({
      status: 404,
      message: "An active same-namespace pursuit is required for this signed copy.",
    })
  })

  it.each(["stale_notice", "no_notice", "rpc_error"])("denies portal upload intent before Storage when current NDA authorization is %s", async (state) => {
    const buyerId = "00000000-0000-4000-8000-000000000022"
    const matchId = "00000000-0000-4000-8000-000000000023"
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "repreneur", repreneurId: buyerId, user: { id: "portal-user", email: "buyer@example.test" } })
    const createSignedUploadUrl = vi.fn()
    const insert = vi.fn()
    const rpc = vi.fn().mockResolvedValue({ data: [], error: state === "rpc_error" ? { message: "unavailable" } : null })
    const row = { id: matchId, opportunity_id: opportunityId, status: "active_pursuit", opportunity: { status: "active", is_demo: false }, repreneur: { is_demo: false } }
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) }
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => table === "opportunity_matches" ? q : { insert }, rpc,
      storage: { from: () => ({ createSignedUploadUrl }) },
    })
    await expect(createPrivateUploadIntent(request({}), {
      kind: "portal_signed_nda", resourceId: matchId, relatedId: null, fileName: "signed.pdf", contentType: "application/pdf", sizeBytes: 1024,
      metadata: { title: "Signed NDA" }, idempotencyKey: "00000000-0000-4000-8000-000000000024",
    })).rejects.toMatchObject({ status: 409, message: "The NDA is not ready for signature yet." })
    expect(rpc).toHaveBeenCalledWith("journey_repreneur_authorized_template", { p_match_id: matchId, p_repreneur_id: buyerId })
    expect(insert).not.toHaveBeenCalled()
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it("verifies the private object and atomically finalizes the same intent", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    const digest = createHash("sha256").update(bytes).digest("hex")
    const intent = {
      id: intentId,
      actor_kind: "staff",
      actor_key: "staff:staff-user:",
      actor_user_id: "staff-user",
      actor_repreneur_id: null,
      actor_email: "staff@example.test",
      actor_fingerprint: null,
      upload_kind: "opportunity_document",
      resource_id: opportunityId,
      related_id: null,
      bucket_id: "opportunity-documents",
      storage_path: `${opportunityId}/documents/${intentId}-memo.pdf`,
      original_filename: "memo.pdf",
      content_type: "application/pdf",
      declared_size: bytes.byteLength,
      metadata: { document_type: "deal_book", visibility: "staff_only", title: "Memo" },
      finalize_secret_hash: createHash("sha256").update(secret).digest("hex"),
      status: "pending",
      content_sha256: null,
      result: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }
    const finalizeRpc = vi.fn().mockResolvedValue({
      data: { documentId: "document-1", message: "Document added." },
      error: null,
      status: 200,
    })
    const cleanupQuery = {
      select: () => ({
        eq: () => ({
          is: async () => ({ data: [], error: null }),
        }),
      }),
    }
    const client = {
      from: vi.fn((table: string) => {
        if (table === "private_upload_intents") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: intent, error: null }) }),
            }),
          }
        }
        if (table === "private_upload_cleanup_queue") return cleanupQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: {
        from: () => ({
          download: async () => ({
            data: new Blob([bytes], { type: "application/pdf" }),
            error: null,
          }),
        }),
      },
      rpc: finalizeRpc,
    }
    mocks.createAdminClient.mockReturnValue(client)

    await expect(finalizePrivateUpload(request({ intentId, finalizeSecret: secret }), {
      intentId,
      finalizeSecret: secret,
    })).resolves.toEqual({ documentId: "document-1", message: "Document added." })

    expect(mocks.assertSafePdfEvidence).toHaveBeenCalledWith(bytes)
    expect(finalizeRpc).toHaveBeenCalledWith("finalize_w165_private_upload", {
      p_intent_id: intentId,
      p_actor_key: "staff:staff-user:",
      p_finalize_secret_hash: intent.finalize_secret_hash,
      p_content_sha256: digest,
    })
  })

  it("returns a clear client rejection for an invalid PDF and records the content failure", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    const closeRpc = vi.fn().mockResolvedValue({ data: null, error: null, status: 200 })
    mocks.createAdminClient.mockReturnValue(validationFailureClient(bytes,closeRpc))
    mocks.assertSafePdfEvidence.mockRejectedValue(
      new mocks.PdfEvidenceValidationError("NDA evidence must be a structurally valid PDF file"),
    )

    await expect(finalizePrivateUpload(request({ intentId, finalizeSecret: secret }), {
      intentId,
      finalizeSecret: secret,
    })).rejects.toMatchObject({
      status: 400,
      message: "NDA evidence must be a structurally valid PDF file",
    })
    expect(closeRpc).toHaveBeenCalledWith("close_w165_private_upload_intent", expect.objectContaining({
      p_failure_code: "content_validation_failed",
    }))
  })

  it("keeps parser infrastructure failures as server errors with a distinct audit code", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    const closeRpc = vi.fn().mockResolvedValue({ data: null, error: null, status: 200 })
    mocks.createAdminClient.mockReturnValue(validationFailureClient(bytes,closeRpc))
    const runtimeError = new mocks.PdfEvidenceRuntimeError("NDA PDF validation is temporarily unavailable")
    mocks.assertSafePdfEvidence.mockRejectedValue(runtimeError)

    await expect(finalizePrivateUpload(request({ intentId, finalizeSecret: secret }), {
      intentId,
      finalizeSecret: secret,
    })).rejects.toBe(runtimeError)
    expect(closeRpc).toHaveBeenCalledWith("close_w165_private_upload_intent", expect.objectContaining({
      p_failure_code: "content_validation_runtime_failed",
    }))
  })

  it("caps metadata JSON before parsing", async () => {
    const oversized = new Request("https://app.re-new.team/api/private-uploads/intents", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(17 * 1024) }),
    })

    await expect(readPrivateUploadJson(oversized)).rejects.toEqual(
      expect.objectContaining<Partial<PrivateUploadError>>({ status: 413 }),
    )
  })
})
