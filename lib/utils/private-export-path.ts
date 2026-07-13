import * as os from "os"
import * as path from "path"

/**
 * Resolve a private export directory that cannot be inside the repository.
 * CRM exports contain personal and commercially sensitive data and must not
 * be written to a path that can be committed accidentally.
 */
export function resolvePrivateExportDirectory(
  repositoryRoot: string,
  requestedDirectory?: string,
  temporaryDirectory = os.tmpdir(),
) {
  const outputDirectory = path.resolve(
    requestedDirectory?.trim() || path.join(temporaryDirectory, "re-new-exports"),
  )
  const relativePath = path.relative(path.resolve(repositoryRoot), outputDirectory)

  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    throw new Error(
      "RENEW_EXPORT_DIR must point outside the repository so CRM exports cannot be committed accidentally",
    )
  }

  return outputDirectory
}
