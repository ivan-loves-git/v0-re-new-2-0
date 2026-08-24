import { parentPort } from "node:worker_threads"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const PDF_HEADER = "%PDF-"
const MAX_PDF_PAGES = 500
const ACTIVE_PDF_TOKENS = [
  "/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile",
  "/XFA", "/SubmitForm", "/ImportData", "/GoToR", "/GoToE", "/RichMedia",
  "/Sound", "/Movie", "/3D",
]

function reject(reason) {
  throw new Error(reason)
}

function containsPdfNameToken(source, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`${escaped}(?=[\\s<>{}\\[\\]()/]|$)`).test(source)
}

function assertPdfEnvelope(bytes) {
  const text = new TextDecoder("latin1").decode(bytes)
  if (!text.startsWith(PDF_HEADER)) reject("invalid")
  const finalEof = text.lastIndexOf("%%EOF")
  if (finalEof < 0 || /[^\x00\x09\x0a\x0c\x0d\x20]/.test(text.slice(finalEof + 5))) {
    reject("invalid")
  }
  if (ACTIVE_PDF_TOKENS.some((token) => containsPdfNameToken(text, token))) {
    reject("active")
  }
}

async function validate(bytes) {
  assertPdfEnvelope(bytes)
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: false,
    verbosity: 0,
  })
  try {
    const document = await loadingTask.promise
    if (document.numPages < 1 || document.numPages > MAX_PDF_PAGES) reject("page_count")
    const [documentActions, attachments, openAction] = await Promise.all([
      document.getJSActions(), document.getAttachments(), document.getOpenAction(),
    ])
    if (documentActions || attachments || openAction) reject("active")
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      if (await page.getJSActions()) reject("active")
    }
  } finally {
    await loadingTask.destroy().catch(() => undefined)
  }
}

parentPort?.once("message", async (buffer) => {
  try {
    await validate(buffer)
    parentPort?.postMessage({ ok: true })
  } catch (error) {
    const reason = error instanceof Error && ["invalid", "active", "page_count"].includes(error.message)
      ? error.message
      : "invalid"
    parentPort?.postMessage({ ok: false, reason })
  }
})
