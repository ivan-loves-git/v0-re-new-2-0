export type RepreneurDocumentType = "cv" | "ldc"

const STORAGE_OBJECT_URL_PATTERN =
  /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/cvs\/(.+)$/

const DOCUMENT_DOWNLOAD_BASENAMES: Record<RepreneurDocumentType, string> = {
  cv: "CV",
  ldc: "Lettre-de-cadrage",
}

function normalizeObjectPath(value: string) {
  if (!value || value.length > 1024 || value.startsWith("/")) return null

  let decodedValue: string
  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    return null
  }

  if (decodedValue.includes("\\") || decodedValue.includes("\0")) return null

  const segments = decodedValue.split("/")
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null
  }

  return decodedValue
}

/**
 * Resolves both current object paths and historical Supabase public/signed URLs
 * to a path relative to the private `cvs` bucket.
 *
 * Historical uploads used `cvs/<file>` as the object key, so their public URLs
 * contain the bucket twice: `/public/cvs/cvs/<file>`. The first `cvs` is the
 * bucket and must be removed; the second is part of the stored object key.
 */
export function resolveRepreneurDocumentStoragePath(
  storedValue: string | null | undefined,
) {
  const value = storedValue?.trim()
  if (!value) return null

  if (!/^https?:\/\//i.test(value)) {
    return normalizeObjectPath(value)
  }

  try {
    const url = new URL(value)
    const match = url.pathname.match(STORAGE_OBJECT_URL_PATTERN)
    return match ? normalizeObjectPath(match[1]) : null
  } catch {
    return null
  }
}

export function getRepreneurDocumentDownloadName(
  documentType: RepreneurDocumentType,
  storagePath: string,
) {
  const fileName = storagePath.split("/").at(-1) ?? ""
  const extension = fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
  const safeExtension = extension && extension.length <= 8 ? extension : "pdf"

  return `${DOCUMENT_DOWNLOAD_BASENAMES[documentType]}.${safeExtension}`
}
