import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  source: undefined as unknown,
  options: undefined as unknown,
  handlers: new Map<string, (value?: unknown) => void>(),
  constructed: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn().mockResolvedValue(1),
}));

vi.mock("node:worker_threads", () => ({
  Worker: class ControlledPdfWorker {
    constructor(source: string, options: unknown) {
      mocks.source = source;
      mocks.options = options;
      mocks.constructed();
    }

    once(event: string, handler: (value?: unknown) => void) {
      mocks.handlers.set(event, handler);
      return this;
    }

    postMessage(...args: unknown[]) {
      mocks.postMessage(...args);
    }

    terminate() {
      return mocks.terminate();
    }
  },
}));

import {
  assertSafePdfEvidence,
  PdfEvidenceRuntimeError,
} from "@/lib/security/pdf-evidence";

describe("W-152 PDF parser isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.source = undefined;
    mocks.options = undefined;
    mocks.terminate.mockResolvedValue(1);
  });

  it("hard-terminates an unresponsive parser within the parent deadline", async () => {
    vi.useFakeTimers();
    try {
      const validation = expect(
        assertSafePdfEvidence(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      ).rejects.toThrow("NDA PDF validation timed out");
      await vi.advanceTimersByTimeAsync(5_500);

      await validation;
      expect(mocks.terminate).toHaveBeenCalledOnce();
      expect(mocks.options).toMatchObject({
        eval: true,
        workerData: {
          pdfjsModulePath: expect.stringMatching(
            /^file:.*pdfjs-dist\/legacy\/build\/pdf\.mjs$/,
          ),
          pdfjsWorkerModulePath: expect.stringMatching(
            /^file:.*pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs$/,
          ),
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 160,
          maxYoungGenerationSizeMb: 32,
          stackSizeMb: 4,
        },
      });
      expect(mocks.source).toContain('require("node:worker_threads")');
      expect(mocks.source).toContain(
        "await import(workerData.pdfjsWorkerModulePath)",
      );
      expect(mocks.source).not.toContain('new URL("./pdf-evidence-worker.mjs"');
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts the exact 20 MiB boundary before handing it to the isolated worker", async () => {
    const validation = assertSafePdfEvidence(new Uint8Array(20 * 1024 * 1024));
    mocks.handlers.get("message")?.({ ok: true });

    await expect(validation).resolves.toBeUndefined();
    expect(mocks.constructed).toHaveBeenCalledOnce();
    expect(mocks.postMessage).toHaveBeenCalledOnce();
  });

  it("rejects 20 MiB plus one byte before creating a worker", async () => {
    await expect(
      assertSafePdfEvidence(new Uint8Array(20 * 1024 * 1024 + 1)),
    ).rejects.toThrow("must not exceed 20 MiB");
    expect(mocks.constructed).not.toHaveBeenCalled();
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    "fails closed when the worker exits with code %i before a verdict",
    async (code) => {
      const assertion = expect(
        assertSafePdfEvidence(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      ).rejects.toBeInstanceOf(PdfEvidenceRuntimeError);
      mocks.handlers.get("exit")?.(code);
      await assertion;
    },
  );

  it("fails closed when the worker emits an error", async () => {
    const assertion = expect(
      assertSafePdfEvidence(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    ).rejects.toBeInstanceOf(PdfEvidenceRuntimeError);
    mocks.handlers.get("error")?.(new Error("synthetic worker error"));
    await assertion;
  });

  it("fails closed on an unexpected worker message", async () => {
    const assertion = expect(
      assertSafePdfEvidence(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    ).rejects.toThrow("structurally valid PDF");
    mocks.handlers.get("message")?.({ ok: true, unexpected: true });
    await assertion;
  });
});
