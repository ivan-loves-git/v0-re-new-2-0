import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: mocks.requirePortalAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import {
  readPortalCurrentPursuit,
  readStaffCurrentPursuit,
  resolvePortalPursuitResource,
} from "@/lib/data/current-pursuit"

const evidence = [
  {
    id: "cycle-1",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "mutual_interest_validated",
    actor: "staff",
    idempotency_key: "event-1",
    recorded_at: "2026-08-01T09:00:00.000Z",
  },
  {
    id: "qualification-requested",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "qualification_requested",
    actor: "staff",
    idempotency_key: "event-qualification-requested",
    recorded_at: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "intermediary-qualified",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "intermediary_qualified",
    actor: "staff",
    idempotency_key: "event-intermediary-qualified",
    recorded_at: "2026-08-01T11:00:00.000Z",
  },
  {
    id: "template-validated",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "template_validated",
    actor: "staff",
    idempotency_key: "event-template-validated",
    recorded_at: "2026-08-01T12:00:00.000Z",
  },
  {
    id: "gate-1",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "gate_1_passed",
    actor: "staff",
    idempotency_key: "event-2",
    recorded_at: "2026-08-02T09:00:00.000Z",
  },
  {
    id: "renew-validated",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "renew_signed_copy_validated",
    actor: "staff",
    nda_artifact_id: "renew-current",
    idempotency_key: "event-3",
    recorded_at: "2026-08-03T09:00:00.000Z",
  },
  {
    id: "repreneur-validated",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "repreneur_signed_copy_validated",
    actor: "staff",
    nda_artifact_id: "repreneur-current",
    idempotency_key: "event-4",
    recorded_at: "2026-08-04T09:00:00.000Z",
  },
  {
    id: "gate-2",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "gate_2_passed",
    actor: "staff",
    idempotency_key: "event-5",
    recorded_at: "2026-08-05T09:00:00.000Z",
  },
  {
    id: "dispatch-1",
    match_id: "match-1",
    opportunity_id: "opportunity-1",
    repreneur_id: "repreneur-1",
    event_type: "manual_package_dispatched",
    actor: "staff",
    idempotency_key: "event-6",
    recorded_at: "2026-08-06T09:00:00.000Z",
  },
] as const

const artifacts = [
  {
    id: "renew-current",
    artifact_role: "renew_signed_copy",
    version_number: 2,
    document_id: "renew-document",
    recorded_at: "2026-08-03T08:00:00.000Z",
  },
  {
    id: "repreneur-current",
    artifact_role: "repreneur_signed_copy",
    version_number: 2,
    document_id: "repreneur-document",
    recorded_at: "2026-08-04T08:00:00.000Z",
  },
]

const grant = {
  information_memo_document_id: "memo-1",
  source_disclosed_at: "2026-08-07T09:00:00.000Z",
  source_firm_id: "firm-secret",
  source_firm_name: "Source firm",
  source_office_id: "office-secret",
  source_office_name: "Milan",
  disclosed_contacts: [
    {
      opportunity_contact_id: "opportunity-contact-secret",
      contact_id: "contact-secret",
      name: "  Alice Source  ",
      email: "alice@example.test",
    },
    {
      opportunity_contact_id: "blank-contact",
      contact_id: "blank-canonical-contact",
      name: "  ",
      email: "blank@example.test",
    },
  ],
  nda_expires_at: "2099-08-07T09:00:00.000Z",
  revoked_at: null,
  revoked_reason: null,
}

type Result = { data: unknown; error: { message: string } | null }

function query(result: Result) {
  const builder: Record<string, unknown> & PromiseLike<Result> = {
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  for (const method of ["select", "eq", "is", "order"] as const) {
    builder[method] = vi.fn(() => builder)
  }
  builder.limit = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  return builder
}

function setupCurrentPursuit(options: {
  canonicalAccess?: Result
  currentDispatchId?: string | null
  currentGate1Id?: string | null
  currentGate2Id?: string | null
  evidence?: unknown
  match?: Result
  settings?: Result
  grant?: unknown
} = {}) {
  let artifactRead = 0
  const from = vi.fn((table: string) => {
    if (table === "opportunity_matches") return query(options.match ?? {
      data: {
        id: "match-1",
        opportunity_id: "opportunity-1",
        repreneur_id: "repreneur-1",
        status: "active_pursuit",
        opportunity: { status: "active", is_demo: false },
        repreneur: { is_demo: false },
      },
      error: null,
    })
    if (table === "wave_journey_settings") return query(options.settings ?? {
      data: { enabled: true },
      error: null,
    })
    if (table === "opportunity_pursuit_evidence") {
      return query({ data: options.evidence ?? evidence, error: null })
    }
    if (table === "opportunity_nda_artifacts") {
      const result = artifactRead++ === 0
        ? { data: artifacts, error: null }
        : {
            data: [{
              id: "template-current",
              artifact_role: "blank_template",
              version_number: 3,
              document_id: "template-document",
              recorded_at: "2026-08-02T08:00:00.000Z",
            }],
            error: null,
          }
      return query(result)
    }
    if (table === "opportunity_pursuit_confidential_grants") {
      return query({ data: options.grant === undefined ? grant : options.grant, error: null })
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  const rpc = vi.fn((name: string) => {
    if (name === "journey_current_gate_1_event") {
      return Promise.resolve({
        data: "currentGate1Id" in options ? options.currentGate1Id : "gate-1",
        error: null,
      })
    }
    if (name === "journey_current_gate_2_event") {
      return Promise.resolve({
        data: "currentGate2Id" in options ? options.currentGate2Id : "gate-2",
        error: null,
      })
    }
    if (name === "journey_current_dispatch_event") {
      return Promise.resolve({
        data: "currentDispatchId" in options ? options.currentDispatchId : "dispatch-1",
        error: null,
      })
    }
    if (name === "journey_repreneur_can_access_confidential") {
      return Promise.resolve(options.canonicalAccess ?? { data: true, error: null })
    }
    throw new Error(`Unexpected RPC: ${name}`)
  })
  mocks.createAdminClient.mockReturnValue({ from, rpc })
  return { from, rpc }
}

describe("current pursuit reads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: "repreneur-1" })
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
  })

  it("returns the complete current staff workspace after staff access", async () => {
    setupCurrentPursuit()

    const result = await readStaffCurrentPursuit("match-1")

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      matchId: "match-1",
      opportunityId: "opportunity-1",
      repreneurId: "repreneur-1",
      currentCycleId: "cycle-1",
      currentTemplate: { id: "template-current", version_number: 3 },
      currentRenewSignedCopy: { id: "renew-current", version_number: 2 },
      currentRepreneurSignedCopy: { id: "repreneur-current", version_number: 2 },
      gate1Passed: true,
      gate2Passed: true,
      dispatched: true,
      hasLiveConfidentialGrant: true,
      nextAction: null,
      allowedActions: ["drop", "revoke_access", "continue"],
    })
    expect(result?.entries).toHaveLength(evidence.length)
  })

  it("returns the same minimal portal-safe projection for portal and staff preview", async () => {
    const portal = setupCurrentPursuit()
    const portalResult = await readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })
    expect(portal.rpc.mock.calls.filter(([name]) => name === "journey_repreneur_can_access_confidential")).toHaveLength(1)

    setupCurrentPursuit()
    const previewResult = await readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "staff-preview", repreneurId: "repreneur-1" },
    })

    expect(previewResult).toEqual(portalResult)
    expect(portalResult).toEqual({
      matchId: "match-1",
      enabled: true,
      gate1Passed: true,
      gate2Passed: true,
      dispatched: true,
      confidentialGrant: {
        informationMemoDocumentId: "memo-1",
        grantedAt: "2026-08-07T09:00:00.000Z",
        source: {
          firmName: "Source firm",
          officeName: "Milan",
          contactNames: ["Alice Source"],
        },
      },
      revoked: false,
      evidenceRequired: false,
    })
    const serialized = JSON.stringify(portalResult)
    expect(serialized).not.toContain("alice@example.test")
    expect(serialized).not.toContain("firm-secret")
    expect(serialized).not.toContain("contact-secret")
    expect(serialized).not.toContain("entries")
  })

  it("denies DEMO pursuits to portal and staff preview while retaining the staff workspace", async () => {
    const demoMatch = {
      data: {
        id: "match-1",
        opportunity_id: "opportunity-1",
        repreneur_id: "repreneur-1",
        status: "active_pursuit",
        opportunity: { status: "active", is_demo: true },
      },
      error: null,
    }
    const portal = setupCurrentPursuit({ match: demoMatch })

    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })).resolves.toBeNull()
    expect(portal.from.mock.calls.map(([table]) => table)).toEqual([
      "opportunity_matches",
      "wave_journey_settings",
    ])
    expect(portal.rpc).not.toHaveBeenCalled()

    setupCurrentPursuit({ match: demoMatch })
    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "staff-preview", repreneurId: "repreneur-1" },
    })).resolves.toBeNull()

    setupCurrentPursuit({ match: demoMatch })
    await expect(readStaffCurrentPursuit("match-1")).resolves.toMatchObject({
      matchId: "match-1",
      opportunityId: "opportunity-1",
      entries: evidence,
    })
  })

  it("denies a demo repreneur only to the real portal while retaining staff preview and staff history", async () => {
    const demoRepreneurMatch = {
      data: {
        id: "match-1",
        opportunity_id: "opportunity-1",
        repreneur_id: "repreneur-1",
        status: "active_pursuit",
        opportunity: { status: "active", is_demo: false },
        repreneur: { is_demo: true },
      },
      error: null,
    }

    setupCurrentPursuit({ match: demoRepreneurMatch })
    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })).resolves.toBeNull()

    setupCurrentPursuit({ match: demoRepreneurMatch })
    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "staff-preview", repreneurId: "repreneur-1" },
    })).resolves.toMatchObject({ matchId: "match-1" })

    setupCurrentPursuit({ match: demoRepreneurMatch })
    await expect(readStaffCurrentPursuit("match-1")).resolves.toMatchObject({
      matchId: "match-1",
      entries: evidence,
    })
  })

  it("denies source disclosure when the canonical confidential predicate errors", async () => {
    setupCurrentPursuit({
      canonicalAccess: { data: null, error: { message: "unavailable" } },
    })

    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })).resolves.toMatchObject({ confidentialGrant: null, revoked: true })
  })

  it.each([
    {
      label: "the journey is disabled",
      options: { settings: { data: { enabled: false }, error: null } },
    },
    {
      label: "the match is no longer an active pursuit",
      options: {
        match: {
          data: {
            id: "match-1",
            opportunity_id: "opportunity-1",
            repreneur_id: "repreneur-1",
            status: "dropped",
            opportunity: { status: "active", is_demo: false },
          },
          error: null,
        },
      },
    },
    {
      label: "the opportunity is inactive",
      options: {
        match: {
          data: {
            id: "match-1",
            opportunity_id: "opportunity-1",
            repreneur_id: "repreneur-1",
            status: "active_pursuit",
            opportunity: { status: "paused", is_demo: false },
          },
          error: null,
        },
      },
    },
    {
      label: "Gate 2 is not current",
      options: { currentGate2Id: null },
    },
    {
      label: "dispatch is not current",
      options: { currentDispatchId: null },
    },
  ])("withholds portal source data when $label", async ({ options }) => {
    setupCurrentPursuit(options)

    const result = await readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })

    expect(result?.confidentialGrant).toBeNull()
  })

  it("allows a new grant action when an earlier grant is no longer canonically live", async () => {
    setupCurrentPursuit({ canonicalAccess: { data: false, error: null } })

    const result = await readStaffCurrentPursuit("match-1")

    expect(result).toMatchObject({
      hasLiveConfidentialGrant: false,
      revoked: true,
      nextAction: "grant_confidential_access",
    })
    expect(result?.allowedActions).toContain("grant_confidential_access")
    expect(result?.allowedActions).not.toContain("revoke_access")
    expect(result?.allowedActions).not.toContain("continue")
  })

  it("offers completion only after Continue exists in the current cycle", async () => {
    setupCurrentPursuit({
      evidence: [
        ...evidence,
        {
          id: "continued-1",
          match_id: "match-1",
          opportunity_id: "opportunity-1",
          repreneur_id: "repreneur-1",
          event_type: "continued",
          actor: "staff",
          idempotency_key: "event-continued",
          recorded_at: "2026-08-08T09:00:00.000Z",
        },
      ],
    })

    const result = await readStaffCurrentPursuit("match-1")

    expect(result?.allowedActions).toContain("complete")
    expect(result?.allowedActions).not.toContain("continue")
  })

  it("returns null before pursuit details when the viewer does not own the match", async () => {
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: "another-repreneur" })
    const { from, rpc } = setupCurrentPursuit()

    await expect(readPortalCurrentPursuit({
      matchId: "match-1",
      viewer: { kind: "portal" },
    })).resolves.toBeNull()
    expect(from).toHaveBeenCalledTimes(2)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("preserves database failures on the match read", async () => {
    setupCurrentPursuit({
      match: { data: null, error: { message: "match read failed" } },
    })

    await expect(readStaffCurrentPursuit("match-1")).rejects.toThrow("match read failed")
  })
})

describe("resolvePortalPursuitResource", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: "repreneur-1" })
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
  })

  function resourceClient(rpc: ReturnType<typeof vi.fn>, isDemo = false) {
    const match = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: isDemo ? null : { id: "match-1" },
              error: null,
            }),
          })),
        })),
      })),
    }
    return {
      rpc,
      from: vi.fn((table: string) => {
        if (table === "opportunity_matches") return match
        throw new Error(`Unexpected table: ${table}`)
      }),
    }
  }

  it("authorizes only the exact requested information memorandum for the current portal user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc))

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })).resolves.toEqual({ kind: "information-memorandum", documentId: "memo-1" })

    expect(mocks.requirePortalAccess).toHaveBeenCalledOnce()
    expect(mocks.requireStaffAccess).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith("journey_repreneur_can_access_confidential", {
      p_match_id: "match-1",
      p_repreneur_id: "repreneur-1",
      p_document_id: "memo-1",
    })
  })

  it("fails closed when exact information-memorandum authorization errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } })
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc))

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })).resolves.toBeNull()
  })

  it("does not touch the database without a linked portal repreneur", async () => {
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: null })

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })).resolves.toBeNull()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("uses the selected repreneur only after staff access is proven", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc))

    await resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "staff-preview", repreneurId: "preview-repreneur" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.requirePortalAccess).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith("journey_repreneur_can_access_confidential", {
      p_match_id: "match-1",
      p_repreneur_id: "preview-repreneur",
      p_document_id: "memo-1",
    })
  })

  it("returns only the exact template selected by the canonical Gate 1 resolver", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        document_id: "template-v2",
        storage_bucket: "opportunity-documents",
        storage_path: "opportunity-1/nda/template-v2.docx",
      }],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc))

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "nda-template" },
    })).resolves.toEqual({
      kind: "nda-template",
      documentId: "template-v2",
      storageBucket: "opportunity-documents",
      storagePath: "opportunity-1/nda/template-v2.docx",
    })

    expect(rpc).toHaveBeenCalledWith("journey_repreneur_authorized_template", {
      p_match_id: "match-1",
      p_repreneur_id: "repreneur-1",
    })
  })

  it("rejects a malformed template resolver response", async () => {
    const rpc = vi.fn().mockResolvedValue({
        data: [{ document_id: "template-v2", storage_bucket: null }],
        error: null,
      })
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc))

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "nda-template" },
    })).resolves.toBeNull()
  })

  it("denies a demo repreneur's actual portal resource request before an NDA or memo resolver runs", async () => {
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue(resourceClient(rpc, true))

    await expect(resolvePortalPursuitResource({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
