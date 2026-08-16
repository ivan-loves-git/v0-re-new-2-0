import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}))

import {
  createExternalPursuit,
  fulfillExternalPursuitDeletion,
  moveExternalPursuitStage,
  requestExternalPursuitDeletion,
  saveExternalPursuitContact,
  updateExternalPursuit,
  updateExternalPursuitFollowUp,
} from "@/lib/actions/external-pursuits"

describe("External Pursuit patch actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue({
      role: "staff",
      repreneurId: null,
      user: { id: "staff-1" },
    })
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.rpc.mockResolvedValue({ data: null, error: null })
  })

  it("creates a title-only dossier for an explicit staff-selected owner with safe defaults", async () => {
    mocks.rpc.mockResolvedValue({ data: "dossier-1", error: null })

    await expect(createExternalPursuit({
      ownerRepreneurId: "owner-1",
      title: "Title only",
    }, "00000000-0000-4000-8000-000000000000")).resolves.toMatchObject({
      success: true,
      pursuitId: "dossier-1",
    })

    expect(mocks.rpc).toHaveBeenCalledWith("create_external_pursuit_v2", expect.objectContaining({
      p_owner_repreneur_id: "owner-1",
      p_title: "Title only",
      p_stage: "identified",
      p_availability: "unknown",
      p_external_url: null,
      p_target_company: null,
      p_source_channel: null,
      p_revenue_meur: null,
      p_ebitda_keur: null,
      p_headcount: null,
    }))
  })

  it("requires staff to choose an owner and rejects unassigned actors before an RPC", async () => {
    await expect(createExternalPursuit({ title: "No owner" }, "owner-required-key"))
      .resolves.toMatchObject({ success: false, message: "Choose the dossier owner." })
    expect(mocks.rpc).not.toHaveBeenCalled()

    mocks.getCurrentUserAccess.mockResolvedValue(null)
    await expect(createExternalPursuit({ ownerRepreneurId: "owner-1", title: "Denied" }, "denied-key"))
      .resolves.toMatchObject({ success: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("treats explicit undefined optional values as omitted", async () => {
    await expect(updateExternalPursuit("dossier-1", {
      title: "Preserve existing values",
      stage: undefined,
      availability: undefined,
      dueAt: undefined,
      sharedNotes: undefined,
      staffInternalNotes: undefined,
    }, "00000000-0000-4000-8000-000000000001")).resolves.toMatchObject({ success: true })

    expect(mocks.rpc).toHaveBeenCalledWith("update_external_pursuit_v2", expect.objectContaining({
      p_stage_provided: false,
      p_availability_provided: false,
      p_due_at_provided: false,
      p_shared_notes_provided: false,
      p_staff_notes_provided: false,
    }))
  })

  it("keeps null as an explicit clear for nullable values", async () => {
    await updateExternalPursuit("dossier-1", {
      title: "Clear nullable values",
      dueAt: null,
      sharedNotes: null,
      staffInternalNotes: null,
    }, "00000000-0000-4000-8000-000000000002")

    expect(mocks.rpc).toHaveBeenCalledWith("update_external_pursuit_v2", expect.objectContaining({
      p_due_at: null,
      p_due_at_provided: true,
      p_shared_notes: null,
      p_shared_notes_provided: true,
      p_staff_internal_notes: null,
      p_staff_notes_provided: true,
    }))
  })

  it("moves a stage through the narrow patch-only RPC", async () => {
    await expect(moveExternalPursuitStage(
      "dossier-1",
      "meetings",
      "00000000-0000-4000-8000-000000000003",
    )).resolves.toMatchObject({ success: true })

    expect(mocks.rpc).toHaveBeenCalledWith("move_external_pursuit_stage", {
      p_actor_user_id: "staff-1",
      p_dossier_id: "dossier-1",
      p_idempotency_key: "00000000-0000-4000-8000-000000000003",
      p_stage: "meetings",
    })
  })

  it("passes durable contact and deletion operation keys through unchanged", async () => {
    mocks.rpc.mockResolvedValue({ data: "contact-1", error: null })
    await saveExternalPursuitContact("dossier-1", {
      organisation: "Buyer Co",
      email: "buyer@example.test",
    }, "dossier-save:contact:stable-client-id")
    expect(mocks.rpc).toHaveBeenLastCalledWith("save_external_pursuit_contact", expect.objectContaining({
      p_dossier_id: "dossier-1",
      p_idempotency_key: "dossier-save:contact:stable-client-id",
      p_organisation: "Buyer Co",
      p_email: "buyer@example.test",
    }))

    mocks.getCurrentUserAccess.mockResolvedValue({
      role: "repreneur",
      repreneurId: "owner-1",
      user: { id: "owner-user" },
    })
    await requestExternalPursuitDeletion("dossier-1", "stable-delete-request")
    expect(mocks.rpc).toHaveBeenLastCalledWith("request_external_pursuit_deletion", {
      p_actor_user_id: "owner-user",
      p_dossier_id: "dossier-1",
      p_idempotency_key: "stable-delete-request",
    })

    mocks.rpc.mockImplementation(async (name: string) => (
      name === "external_pursuit_attachment_cleanup_for_fulfillment"
        ? { data: [], error: null }
        : { data: null, error: null }
    ))
    await fulfillExternalPursuitDeletion("dossier-1", "stable-delete-fulfill")
    expect(mocks.rpc).toHaveBeenLastCalledWith("fulfill_external_pursuit_deletion", {
      p_actor_user_id: "staff-1",
      p_dossier_id: "dossier-1",
      p_idempotency_key: "stable-delete-fulfill",
    })
  })

  it("marks a lost parent RPC response for exact-key recovery", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "TypeError: fetch failed" },
      status: 0,
    })

    await expect(createExternalPursuit({
      ownerRepreneurId: "owner-1",
      title: "Possibly committed create",
    }, "exact-create-retry-key")).resolves.toMatchObject({
      success: false,
      retryExact: true,
    })

    await expect(updateExternalPursuit("dossier-1", {
      title: "Possibly committed update",
    }, "exact-update-retry-key")).resolves.toMatchObject({
      success: false,
      retryExact: true,
    })

    await expect(updateExternalPursuitFollowUp("dossier-1", {
      sharedNotes: "Possibly committed follow-up",
    }, "exact-follow-up-retry-key")).resolves.toMatchObject({
      success: false,
      retryExact: true,
    })
  })

  it("validates external URLs and integer headcount before persistence", async () => {
    await expect(createExternalPursuit({
      ownerRepreneurId: "owner-1",
      title: "Unsafe URL",
      externalUrl: "javascript:alert(1)",
    }, "unsafe-url-key")).resolves.toMatchObject({ success: false, message: "External URL must start with http:// or https://." })

    await expect(createExternalPursuit({
      ownerRepreneurId: "owner-1",
      title: "Fractional headcount",
      headcount: 2.5,
    }, "fractional-headcount-key")).resolves.toMatchObject({ success: false, message: "Headcount must be a whole number." })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("sends a narrow follow-up patch without title or stage", async () => {
    await expect(updateExternalPursuitFollowUp("dossier-1", {
      nextAction: "Request updated information",
      responsibleParty: "staff",
      availability: "limited",
      dueAt: "2026-08-18",
      sharedNotes: "Awaiting confirmation",
      staffInternalNotes: "Use the approved internal route",
    }, "00000000-0000-4000-8000-000000000003")).resolves.toMatchObject({ success: true })

    expect(mocks.rpc).toHaveBeenCalledWith("update_external_pursuit_follow_up", expect.objectContaining({
      p_next_action: "Request updated information",
      p_responsible_party: "staff",
      p_next_action_provided: true,
      p_responsible_party_provided: true,
      p_staff_notes_provided: true,
    }))
    expect(mocks.rpc.mock.calls.at(-1)?.[1]).not.toHaveProperty("p_title")
    expect(mocks.rpc.mock.calls.at(-1)?.[1]).not.toHaveProperty("p_stage")
  })

  it("rejects a partial responsibility pair before calling the database", async () => {
    await expect(updateExternalPursuitFollowUp("dossier-1", { nextAction: "Call owner" })).resolves.toMatchObject({
      success: false,
      message: "Set or clear the next action and responsible party together.",
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
