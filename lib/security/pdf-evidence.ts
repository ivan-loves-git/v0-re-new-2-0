/** Bounded, non-executing PDF evidence validation. No document content is logged. */
const PDF_HEADER = "%PDF-"
const MAX_PDF_PAGES = 500
const PDF_PARSE_TIMEOUT_MS = 3_000
const ACTIVE_PDF_TOKENS = [
  "/JavaScript",
  "/JS",
  "/OpenAction",
  "/AA",
  "/Launch",
  "/EmbeddedFile",
  "/XFA",
  "/SubmitForm",
  "/ImportData",
  "/GoToR",
  "/GoToE",
  "/RichMedia",
  "/Sound",
  "/Movie",
  "/3D",
]

class PdfEvidenceError extends Error {}

function reject(message: string): never {
  throw new PdfEvidenceError(message)
}

function containsPdfNameToken(source: string, token: string) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${escaped}(?=[\\s<>{}\\[\\]()/]|$)`).test(source)
}

function assertPdfEnvelope(bytes: Uint8Array) {
  const text = new TextDecoder("latin1").decode(bytes)
  if (!text.startsWith(PDF_HEADER)) {
    reject("NDA evidence must be a valid PDF file")
  }

  const finalEof = text.lastIndexOf("%%EOF")
  if (finalEof < 0 || /[^\x00\x09\x0a\x0c\x0d\x20]/.test(text.slice(finalEof + 5))) {
    reject("NDA evidence must end at its PDF EOF marker")
  }
  if (ACTIVE_PDF_TOKENS.some((token) => containsPdfNameToken(text, token))) {
    reject("Active or embedded PDF content is not accepted for NDA evidence")
  }
}

async function withinParseDeadline<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, rejectPromise) => {
        timer = setTimeout(
          () => rejectPromise(new PdfEvidenceError("NDA PDF validation timed out")),
          PDF_PARSE_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function destroyLoadingTask(
  loadingTask: { destroy(): Promise<void> },
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      loadingTask.destroy(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 250)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function assertSafePdfEvidence(bytes: Uint8Array) {
  assertPdfEnvelope(bytes)

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = getDocument({
    // Node Buffers extend Uint8Array but PDF.js deliberately rejects Buffer.
    data: Uint8Array.from(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: false,
  })

  try {
    await withinParseDeadline((async () => {
      const document = await loadingTask.promise
      if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) {
        reject("NDA evidence has an unsupported page count")
      }

      const [documentActions, attachments, openAction] = await Promise.all([
        document.getJSActions(),
        document.getAttachments(),
        document.getOpenAction(),
      ])
      if (documentActions || attachments || openAction) {
        reject("Active or embedded PDF content is not accepted for NDA evidence")
      }

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        if (await page.getJSActions()) {
          reject("Active PDF page actions are not accepted for NDA evidence")
        }
      }
    })())
  } catch (error) {
    if (error instanceof PdfEvidenceError) throw error
    throw new PdfEvidenceError("NDA evidence must be a structurally valid PDF file")
  } finally {
    await destroyLoadingTask(loadingTask)
  }
}
