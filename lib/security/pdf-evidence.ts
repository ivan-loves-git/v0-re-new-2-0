import "server-only";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

/** PDF.js parses untrusted syntax in a dedicated resource-limited worker. */
export const MAX_PDF_EVIDENCE_BYTES = 20 * 1024 * 1024;
const MIN_PDF_PARSE_TIMEOUT_MS = 5_000;
const MAX_PDF_PARSE_TIMEOUT_MS = 15_000;
const PDF_WORKER_RESOURCE_LIMITS = {
  // A 20 MiB input can transiently exist as transferred bytes, parsed PDF.js
  // structures and bounded decoded streams. This remains below the function
  // memory envelope while avoiding the former 4 MiB parser bottleneck.
  maxOldGenerationSizeMb: 160,
  maxYoungGenerationSizeMb: 32,
  stackSizeMb: 4,
} as const;

// This is deliberately an eval worker rather than a sibling .mjs asset. Turbopack
// emits URL-based workers as browser static media, where Node cannot resolve the
// PDF.js dependency tree. The source is fixed application code; only bytes and a
// server-resolved module path cross the worker boundary.
const PDF_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require("node:worker_threads")

const PDF_HEADER = "%PDF-"
const MAX_PDF_PAGES = 500
const ACTIVE_PDF_TOKENS = [
  "/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile",
  "/XFA", "/SubmitForm", "/ImportData", "/GoToR", "/GoToE", "/RichMedia",
  "/Sound", "/Movie", "/3D",
]

// PDF.js references DOMMatrix while loading its display module. Validation
// never renders, so a no-op class avoids shipping an optional native canvas
// package into the server function.
globalThis.DOMMatrix ||= class DOMMatrix {}

function reject(reason) { throw new Error(reason) }

function containsPdfNameToken(source, token) {
  const escaped = token.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")
  return new RegExp(escaped + "(?=[\\s<>{}\\[\\]()/]|$)").test(source)
}

function assertPdfEnvelope(bytes) {
  const text = new TextDecoder("latin1").decode(bytes)
  if (!text.startsWith(PDF_HEADER)) reject("invalid")
  const finalEof = text.lastIndexOf("%%EOF")
  if (finalEof < 0 || /[^\x00\x09\x0a\x0c\x0d\x20]/.test(text.slice(finalEof + 5))) reject("invalid")
  if (ACTIVE_PDF_TOKENS.some((token) => containsPdfNameToken(text, token))) reject("active")
}

async function validate(bytes) {
  assertPdfEnvelope(bytes)
  await import(workerData.pdfjsWorkerModulePath)
  const { getDocument } = await import(workerData.pdfjsModulePath)
  const loadingTask = getDocument({
    data: new Uint8Array(bytes), disableFontFace: true, isEvalSupported: false,
    stopAtErrors: true, useSystemFonts: false, verbosity: 0,
  })
  try {
    const document = await loadingTask.promise
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) reject("page_count")
    const [documentActions, attachments, openAction] = await Promise.all([
      document.getJSActions(), document.getAttachments(), document.getOpenAction(),
    ])
    if (documentActions || attachments || openAction) reject("active")
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (await (await document.getPage(pageNumber)).getJSActions()) reject("active")
    }
  } finally {
    await loadingTask.destroy().catch(() => undefined)
  }
}

parentPort.once("message", async (buffer) => {
  try {
    await validate(buffer)
    parentPort.postMessage({ ok: true })
  } catch (error) {
    const reason = error instanceof Error && ["invalid", "active", "page_count"].includes(error.message)
      ? error.message : "invalid"
    parentPort.postMessage({ ok: false, reason })
  }
})
`;

// Do not use require.resolve here. Turbopack rewrites require.resolve calls in
// a server chunk to numeric module IDs, but an eval Worker needs a real import
// URL. next.config.mjs traces both files into the deployed function at these
// stable package paths.
const PDFJS_MODULE_PATH = pathToFileURL(
  join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs"),
).href;
const PDFJS_WORKER_MODULE_PATH = pathToFileURL(
  join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

export class PdfEvidenceValidationError extends Error {}
export class PdfEvidenceRuntimeError extends Error {}

type PdfEvidenceWorkerResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "active" | "page_count" };

function errorForWorkerResult(
  result: Exclude<PdfEvidenceWorkerResult, { ok: true }>,
) {
  if (result.reason === "active") {
    return new PdfEvidenceValidationError(
      "Active or embedded PDF content is not accepted for NDA evidence",
    );
  }
  if (result.reason === "page_count") {
    return new PdfEvidenceValidationError(
      "NDA evidence has an unsupported page count",
    );
  }
  return new PdfEvidenceValidationError(
    "NDA evidence must be a structurally valid PDF file",
  );
}

function isSuccessfulWorkerResult(value: unknown): value is { ok: true } {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return result.ok === true && Object.keys(result).length === 1;
}

function failureWorkerResult(
  value: unknown,
): Exclude<PdfEvidenceWorkerResult, { ok: true }> {
  if (!value || typeof value !== "object")
    return { ok: false, reason: "invalid" };
  const result = value as Record<string, unknown>;
  if (
    result.ok !== false ||
    !["invalid", "active", "page_count"].includes(String(result.reason)) ||
    Object.keys(result).some((key) => key !== "ok" && key !== "reason")
  ) {
    return { ok: false, reason: "invalid" };
  }
  return result as Exclude<PdfEvidenceWorkerResult, { ok: true }>;
}

async function terminate(worker: Worker) {
  try {
    await worker.terminate();
  } catch {
    // The worker can already have exited after posting its result.
  }
}

/**
 * The worker is the only place PDF.js touches untrusted bytes. A blocked parse
 * cannot block the request event loop: the parent rejects at the deadline and
 * terminates the resource-limited worker.
 */
async function validateInIsolatedWorker(bytes: Uint8Array) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(PDF_WORKER_SOURCE, {
      eval: true,
      workerData: {
        pdfjsModulePath: PDFJS_MODULE_PATH,
        pdfjsWorkerModulePath: PDFJS_WORKER_MODULE_PATH,
      },
      resourceLimits: PDF_WORKER_RESOURCE_LIMITS,
    });

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      void terminate(worker);
      if (error) reject(error);
      else resolve();
    };

    const timeoutMs = Math.min(
      MAX_PDF_PARSE_TIMEOUT_MS,
      MIN_PDF_PARSE_TIMEOUT_MS +
        Math.ceil(bytes.byteLength / (1024 * 1024)) * 500,
    );
    const deadline = setTimeout(() => {
      finish(new PdfEvidenceRuntimeError("NDA PDF validation timed out"));
    }, timeoutMs);

    worker.once("message", (result: unknown) => {
      if (!isSuccessfulWorkerResult(result)) {
        finish(errorForWorkerResult(failureWorkerResult(result)));
        return;
      }
      finish();
    });
    worker.once("error", () => {
      finish(
        new PdfEvidenceRuntimeError(
          "NDA PDF validation is temporarily unavailable",
        ),
      );
    });
    worker.once("exit", () => {
      if (!settled) {
        finish(
          new PdfEvidenceRuntimeError(
            "NDA PDF validation is temporarily unavailable",
          ),
        );
      }
    });

    // Always make a plain transferable copy. Buffers may share a larger pool
    // and must never be handed to the worker by reference.
    const input = Uint8Array.from(bytes);
    worker.postMessage(input.buffer, [input.buffer]);
  });
}

export async function assertSafePdfEvidence(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PDF_EVIDENCE_BYTES) {
    throw new PdfEvidenceValidationError("PDF files must not exceed 20 MiB");
  }
  await validateInIsolatedWorker(bytes);
}
