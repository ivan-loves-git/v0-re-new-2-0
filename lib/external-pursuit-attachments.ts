export const EXTERNAL_PURSUIT_ATTACHMENTS_BUCKET = "external-pursuit-attachments"
export const EXTERNAL_PURSUIT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024

const FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
