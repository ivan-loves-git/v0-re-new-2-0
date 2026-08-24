import "server-only"
import { Worker } from "node:worker_threads"

/** PDF.js parses untrusted syntax in a dedicated resource-limited worker. */
const PDF_PARSE_TIMEOUT_MS = 3_000
const PDF_WORKER_RESOURCE_LIMITS = {
  maxOldGenerationSizeMb: 64,
  maxYoungGenerationSizeMb: 16,
  stackSizeMb: 4,
} as const

class PdfEvidenceError extends Error {}

type PdfEvidenceWorkerResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "active" | "page_count" }

function errorForWorkerResult(result: Exclude<PdfEvidenceWorkerResult, { ok: true }>) {
  if (result.reason === "active") {
    return new PdfEvidenceError("Active or embedded PDF content is not accepted for NDA evidence")
  }
  if (result.reason === "page_count") {
    return new PdfEvidenceError("NDA evidence has an unsupported page count")
  }
  return new PdfEvidenceError("NDA evidence must be a structurally valid PDF file")
}

async function terminate(worker: Worker) {
  try {
    await worker.terminate()
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
    let settled = false
    const worker = new Worker(
      new URL("./pdf-evidence-worker.mjs", import.meta.url),
      {
        resourceLimits: PDF_WORKER_RESOURCE_LIMITS,
      },
    )

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      void terminate(worker)
      if (error) reject(error)
      else resolve()
    }

    const deadline = setTimeout(() => {
      finish(new PdfEvidenceError("NDA PDF validation timed out"))
    }, PDF_PARSE_TIMEOUT_MS)

    worker.once("message", (result: PdfEvidenceWorkerResult) => {
      if (!result || result.ok !== true) {
        finish(errorForWorkerResult(result ?? { ok: false, reason: "invalid" }))
        return
      }
      finish()
    })
    worker.once("error", () => {
      finish(new PdfEvidenceError("NDA evidence must be a structurally valid PDF file"))
    })
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(new PdfEvidenceError("NDA evidence must be a structurally valid PDF file"))
      }
    })

    // Always make a plain transferable copy. Buffers may share a larger pool
    // and must never be handed to the worker by reference.
    const input = Uint8Array.from(bytes)
    worker.postMessage(input.buffer, [input.buffer])
  })
}

export async function assertSafePdfEvidence(bytes: Uint8Array) {
  await validateInIsolatedWorker(bytes)
}
