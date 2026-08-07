import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  generate: vi.fn(),
  capture: vi.fn(),
  after: vi.fn((callback: () => unknown) => callback()),
  opaqueId: vi.fn(() => "00000000-0000-4000-8000-000000000099"),
  token: vi.fn(() => "outcome-token"),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mocks.after };
});
vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccessFromHeaders: mocks.access,
}));
vi.mock("@/lib/ai/ledger", () => ({
  startWaveAiRun: mocks.start,
  completeWaveAiRun: mocks.complete,
  failWaveAiRun: mocks.fail,
}));
vi.mock("@/lib/ai/next-action", () => ({
  generateWaveAiNextActions: mocks.generate,
}));
vi.mock("@/lib/telemetry/server", () => ({
  captureWaveAiGeneration: mocks.capture,
}));
vi.mock("@/lib/telemetry/identity", () => ({
  getOpaqueTelemetryUserId: mocks.opaqueId,
}));
vi.mock("@/lib/ai/next-action-outcome", () => ({
  createWaveAiOutcomeToken: mocks.token,
}));

import { POST } from "@/app/api/wave-ai/next-actions/route";

const opportunityId = "00000000-0000-4000-8000-000000000001";
const staff = { role: "staff", user: { id: "staff-1" } };

function request(body: unknown) {
  return new Request("http://localhost/api/wave-ai/next-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("WAVE AI next-action route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({
      generationId: "00000000-0000-4000-8000-000000000002",
      traceId: "00000000-0000-4000-8000-000000000003",
      startedAt: "2026-08-07T12:00:00.000Z",
    });
    mocks.generate.mockResolvedValue({ recommendations: [], usage: undefined });
    mocks.complete.mockResolvedValue(undefined);
    mocks.fail.mockResolvedValue(undefined);
  });

  it("authorizes before it reads an untrusted request body", async () => {
    mocks.access.mockResolvedValue(null);
    const body = vi.fn();
    const response = await POST({
      headers: new Headers(),
      json: body,
    } as unknown as Request);
    expect(response.status).toBe(401);
    expect(body).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("rejects malformed or non-staff requests before ledger or provider access", async () => {
    mocks.access.mockResolvedValue({ role: "repreneur", user: { id: "r-1" } });
    expect((await POST(request({ opportunityId }))).status).toBe(403);
    mocks.access.mockResolvedValue(staff);
    expect((await POST(request({ opportunityId, extra: true }))).status).toBe(
      400,
    );
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("records a metadata-only failed generation after a started run", async () => {
    mocks.access.mockResolvedValue(staff);
    mocks.generate.mockRejectedValue(
      new SyntaxError("invalid provider output"),
    );
    const response = await POST(request({ opportunityId }));
    expect(response.status).toBe(500);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "00000000-0000-4000-8000-000000000002",
      }),
    );
    expect(mocks.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "00000000-0000-4000-8000-000000000002",
        traceId: "00000000-0000-4000-8000-000000000003",
        feature: "next_action",
        promptVersion: "next-action-v1",
        status: "failed",
        errorCode: "invalid_output",
      }),
    );
  });
});
