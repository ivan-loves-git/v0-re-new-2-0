export const EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET = "external-pursuit-attachments"
export const EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

const FILE_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const

export type ExternalPursuitAttachmentMime = (typeof FILE_TYPES)[keyof typeof FILE_TYPES]
export type ExternalPursuitAttachment = {
  id: string
  original_filename: string
  content_type: ExternalPursuitAttachmentMime
  byte_size: number
  uploader_label: "You" | "Re-New staff" | "Dossier owner"
  created_at: string
}

function extensionOf(filename: string) {
  const match = filename.trim().toLowerCase().match(/\.([a-z0-9]{2,5})$/)
  return match?.[1] ?? null
}

function bytesStartWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[index + offset] === value)
}

function uint16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function uint32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function zipEntryNames(bytes: Uint8Array) {
  const searchStart = Math.max(0, bytes.length - 65_557)
  let eocd = -1
  for (let index = bytes.length - 22; index >= searchStart; index -= 1) {
    if (bytesStartWith(bytes, [0x50, 0x4b, 0x05, 0x06], index)) { eocd = index; break }
  }
  if (eocd < 0 || eocd + 22 + uint16(bytes, eocd + 20) !== bytes.length) return null
  const entryCount = uint16(bytes, eocd + 10)
  const centralSize = uint32(bytes, eocd + 12)
  const centralOffset = uint32(bytes, eocd + 16)
  if (!entryCount || centralOffset + centralSize !== eocd) return null
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const names: string[] = []
  let cursor = centralOffset
  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (!bytesStartWith(bytes, [0x50, 0x4b, 0x01, 0x02], cursor)) return null
      const nameLength = uint16(bytes, cursor + 28)
      const extraLength = uint16(bytes, cursor + 30)
      const commentLength = uint16(bytes, cursor + 32)
      const next = cursor + 46 + nameLength + extraLength + commentLength
      if (!nameLength || next > eocd) return null
      const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)).replaceAll("\\", "/")
      if (name.startsWith("/") || name.split("/").some((part) => part === "..")) return null
      names.push(name)
      cursor = next
    }
  } catch { return null }
  return cursor === eocd ? names : null
}

function validOoxml(bytes: Uint8Array, kind: "docx" | "xlsx") {
  if (!bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false
  const names = zipEntryNames(bytes)
  if (!names) return false
  const normalized = new Set(names.map((name) => name.toLowerCase()))
  const dangerous = /(^|\/)([^/]+\.)?(exe|dll|com|bat|cmd|js|jse|vbs|vbe|ps1|sh|html?|svg|jar|bin)$/i
  if (names.some((name) => dangerous.test(name) || /vbaproject/i.test(name))) return false
  return normalized.has("[content_types].xml")
    && normalized.has("_rels/.rels")
    && normalized.has(kind === "docx" ? "word/document.xml" : "xl/workbook.xml")
}

function containsUtf16Le(bytes: Uint8Array, value: string) {
  const needle = new Uint8Array([...value].flatMap((character) => [character.charCodeAt(0), 0]))
  return bytes.some((_, index) => index + needle.length <= bytes.length && bytesStartWith(bytes, [...needle], index))
}

function validPdf(bytes: Uint8Array) {
  if (bytes.length < 32 || !/^%PDF-1\.[0-9]/.test(new TextDecoder().decode(bytes.slice(0, 8)))) return false
  const text = new TextDecoder("latin1").decode(bytes)
  if (!/%%EOF\s*$/.test(text) || !/\d+\s+\d+\s+obj\b/.test(text)) return false
  return !/\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/i.test(text)
}

function validImage(extension: string, bytes: Uint8Array) {
  if (extension === "png") return bytes.length >= 33 && bytesStartWith(bytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) && bytesStartWith(bytes,[0x49,0x48,0x44,0x52],12) && bytesStartWith(bytes,[0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82],bytes.length-8)
  if (extension === "gif") return bytes.length >= 14 && (new TextDecoder().decode(bytes.slice(0,6)) === "GIF87a" || new TextDecoder().decode(bytes.slice(0,6)) === "GIF89a") && bytes.at(-1) === 0x3b
  if (extension === "jpg" || extension === "jpeg") return bytes.length >= 20 && bytesStartWith(bytes,[0xff,0xd8,0xff]) && bytesStartWith(bytes,[0xff,0xd9],bytes.length-2)
  if (extension === "webp") return bytes.length >= 20 && bytesStartWith(bytes,[0x52,0x49,0x46,0x46]) && uint32(bytes,4)+8 === bytes.length && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP" && ["VP8 ","VP8L","VP8X"].includes(new TextDecoder().decode(bytes.slice(12,16)))
  return false
}

function validCsv(bytes: Uint8Array) {
  if (!bytes.length || bytes.includes(0) || bytesStartWith(bytes,[0x4d,0x5a]) || bytesStartWith(bytes,[0x7f,0x45,0x4c,0x46]) || bytesStartWith(bytes,[0x50,0x4b,0x03,0x04])) return false
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "")
    if (!text.trim()) return false
    return !/<\s*(?:!doctype\s+html|html|script|svg)\b/i.test(text) && !/<\?xml[\s\S]*?<\s*svg\b/i.test(text)
  } catch { return false }
}

/** Inspect the complete bounded file, not only a prefix supplied by the browser. */
export function matchesExpectedFileStructure(filename: string, bytes: Uint8Array) {
  const extension = extensionOf(filename)
  if (!extension) return false
  if (extension === "pdf") return validPdf(bytes)
  if (["png","gif","jpg","jpeg","webp"].includes(extension)) return validImage(extension,bytes)
  if (extension === "docx" || extension === "xlsx") return validOoxml(bytes,extension)
  if (extension === "doc" || extension === "xls") return bytesStartWith(bytes,[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]) && containsUtf16Le(bytes,extension === "doc" ? "WordDocument" : "Workbook")
  if (extension === "csv") return validCsv(bytes)
  return false
}

export function validateExternalPursuitAttachment(file: File) {
  const filename = file.name.trim()
  const extension = extensionOf(filename)
  if (!filename || !extension || !(extension in FILE_TYPES)) return "Choose a permitted document or image file."
  const expectedMime = FILE_TYPES[extension as keyof typeof FILE_TYPES]
  if (file.type !== expectedMime) return "The file type does not match its permitted extension."
  if (file.size < 1 || file.size > EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES) return "Attachments must be between 1 byte and 20 MiB."
  if (filename.includes("/") || filename.includes("\\") || filename.includes("\0")) return "The file name is invalid."
  return null
}

export function safeAttachmentFilename(filename: string) {
  return filename.replace(/[\r\n\\/"]+/g, "_").trim().slice(0, 255) || "attachment"
}
