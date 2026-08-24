import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  source: undefined as unknown,
  options: undefined as unknown,
  terminate: vi.fn().mockResolvedValue(1),
}));

vi.mock("node:worker_threads", () => ({
  Worker: class UnresponsivePdfWorker {
    constructor(source: string, options: unknown) {
      mocks.source = source;
      mocks.options = options;
    }

    once() {
      return this;
    }

    postMessage() {
      // Simulates a parser that never yields to its worker event loop.
    }

    terminate() {
      return mocks.terminate();
    }
  },
}));

import { assertSafePdfEvidence } from "@/lib/security/pdf-evidence";

describe("W-152 PDF parser isolation", () => {
  it("hard-terminates an unresponsive parser within the parent deadline", async () => {
    vi.useFakeTimers();
    try {
      const validation = expect(
        assertSafePdfEvidence(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      ).rejects.toThrow("NDA PDF validation timed out");
      await vi.advanceTimersByTimeAsync(3_000);

      await validation;
      expect(mocks.terminate).toHaveBeenCalledOnce();
      expect(mocks.options).toMatchObject({
        eval: true,
        workerData: {
          pdfjsModulePath: expect.stringMatching(
            /pdfjs-dist\/legacy\/build\/pdf\.mjs$/,
          ),
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 4,
        },
      });
      expect(mocks.source).toContain('require("node:worker_threads")');
      expect(mocks.source).not.toContain('new URL("./pdf-evidence-worker.mjs"');
    } finally {
      vi.useRealTimers();
    }
  });
});
