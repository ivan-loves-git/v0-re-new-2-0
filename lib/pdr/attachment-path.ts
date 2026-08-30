const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]*$/i
const LEGACY_PREFIX = /^legacy\/[0-9a-f]{64}-[a-z0-9][a-z0-9._-]*$/

/** Only the two server-generated namespaces may be signed or proxied. */
export function isSafePdrAttachmentPath(path: unknown) {
  return typeof path === "string" && (UUID_PREFIX.test(path) || LEGACY_PREFIX.test(path))
}

export function safePdrFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment"
}
