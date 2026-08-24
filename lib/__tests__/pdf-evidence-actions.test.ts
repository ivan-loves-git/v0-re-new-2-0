import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  requirePortalAccess: vi.fn(),
  createAdminClient: vi.fn(),
  queueM2RepreneurEvent: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
  requirePortalAccess: mocks.requirePortalAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({
  queueM2RepreneurEvent: mocks.queueM2RepreneurEvent,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { registerOpportunityNdaArtifact } from "@/lib/actions/opportunity-nda-artifacts"
import { submitPortalPursuitSignedNda } from "@/lib/actions/portal-pursuit-nda"
import { syntheticPdfBytes } from "@/lib/__tests__/fixtures/synthetic-pdf"

const activePdfBytes = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n%%EOF\n",
)

function evidenceFile(
  bytes: Uint8Array,
  name = "signed-nda.pdf",
  type = "application/pdf",
) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new File([copy.buffer], name, { type })
}

function staffForm(bytes: Uint8Array) {
  const form = new FormData()
  form.set("opportunity_id", "opportunity-synthetic-1")
  form.set("match_id", "match-synthetic-1")
  form.set("artifact_role", "renew_signed_copy")
  form.set("title", "Synthetic signed NDA")
  form.set("file", evidenceFile(bytes))
  return form
}

function portalForm(bytes: Uint8Array) {
  const form = new FormData()
  form.set("match_id", "match-synthetic-1")
  form.set("title", "Synthetic signed NDA")
  form.set("file", evidenceFile(bytes))
  return form
}

function portalClient(options: { existing?: boolean } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const matchMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: "match-synthetic-1",
      opportunity_id: "opportunity-synthetic-1",
      repreneur_id: "repreneur-synthetic-1",
      status: "active_pursuit",
    },
    error: null,
  })
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: options.existing
      ? { id: "artifact-synthetic-1", version_number: 1 }
      : null,
    error: null,
  })
  const from = vi.fn((table: string) => {
    if (table === "opportunity_matches") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: matchMaybeSingle })),
        })),
      }
    }
    if (table === "opportunity_nda_artifacts") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: artifactMaybeSingle })),
            })),
          })),
        })),
      }
    }
    throw new Error(`Unexpected portal table: ${table}`)
  })
  const rpc = vi.fn(async (name: string) => {
    if (name === "journey_current_gate_1_event") {
      return { data: "gate-synthetic-1", error: null }
    }
    if (name === "journey_submit_repreneur_signed_copy_v2") {
      return {
        data: {
          artifact_id: "artifact-synthetic-1",
          version_number: 1,
          reused_existing: false,
        },
        error: null,
      }
    }
    throw new Error(`Unexpected portal RPC: ${name}`)
  })
  return {
    client: {
      from,
      rpc,
      storage: { from: vi.fn(() => ({ upload, remove })) },
    },
    upload,
    remove,
    rpc,
  }
}

describe("W-152 PDF evidence action boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.requireStaffAccess.mockResolvedValue({
      user: { id: "staff-synthetic-1", email: "staff@example.test" },
    })
    mocks.requirePortalAccess.mockResolvedValue({
      user: { id: "user-synthetic-1", email: "owner@example.test" },
      repreneurId: "repreneur-synthetic-1",
    })
  })

  it("persists a structurally valid staff PDF through Storage and registration", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({
      data: { artifact_id: "artifact-synthetic-1", version_number: 1 },
      error: null,
      status: 200,
    })
    mocks.createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
      rpc,
    })

    await expect(
      registerOpportunityNdaArtifact(staffForm(syntheticPdfBytes())),
    ).resolves.toEqual({
      success: true,
      artifactId: "artifact-synthetic-1",
      versionNumber: 1,
    })
    expect(upload).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith(
      "register_opportunity_nda_artifact",
      expect.objectContaining({
        p_opportunity_id: "opportunity-synthetic-1",
        p_match_id: "match-synthetic-1",
      }),
    )
  })

  it("leaves no staff Storage object or record when PDF validation rejects", async () => {
    const upload = vi.fn()
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
      rpc,
    })

    await expect(
      registerOpportunityNdaArtifact(staffForm(activePdfBytes)),
    ).rejects.toThrow(/Active or embedded PDF content/)
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects misleading staff PDF metadata without residue", async () => {
    const upload = vi.fn()
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
      rpc,
    })
    const form = staffForm(syntheticPdfBytes())
    form.set(
      "file",
      evidenceFile(syntheticPdfBytes(), "signed-nda.pdf", "text/plain"),
    )

    await expect(registerOpportunityNdaArtifact(form)).rejects.toThrow(
      "Signed NDA copies must be PDF files",
    )
    expect(upload).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("persists a structurally valid portal PDF through Storage and registration", async () => {
    const portal = portalClient()
    mocks.createAdminClient.mockReturnValue(portal.client)

    await expect(
      submitPortalPursuitSignedNda(portalForm(syntheticPdfBytes())),
    ).resolves.toEqual({
      success: true,
      message: "Your signed NDA has been received for staff validation.",
      artifactId: "artifact-synthetic-1",
      versionNumber: 1,
    })
    expect(portal.upload).toHaveBeenCalledOnce()
    expect(portal.rpc.mock.calls.map(([name]) => name)).toEqual([
      "journey_current_gate_1_event",
      "journey_submit_repreneur_signed_copy_v2",
    ])
  })

  it("leaves no portal Storage object or evidence record when validation rejects", async () => {
    const portal = portalClient()
    mocks.createAdminClient.mockReturnValue(portal.client)

    await expect(
      submitPortalPursuitSignedNda(portalForm(activePdfBytes)),
    ).resolves.toEqual({
      success: false,
      message: "The signed NDA must be a complete, non-active PDF.",
    })
    expect(portal.upload).not.toHaveBeenCalled()
    expect(portal.remove).not.toHaveBeenCalled()
    expect(portal.rpc.mock.calls.map(([name]) => name)).toEqual([
      "journey_current_gate_1_event",
    ])
  })

  it("rejects misleading portal PDF metadata before creating a persistence client", async () => {
    const form = portalForm(syntheticPdfBytes())
    form.set(
      "file",
      evidenceFile(syntheticPdfBytes(), "signed-nda.pdf", "text/plain"),
    )

    await expect(submitPortalPursuitSignedNda(form)).resolves.toEqual({
      success: false,
      message: "The signed NDA must be a PDF smaller than 4 MB.",
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
