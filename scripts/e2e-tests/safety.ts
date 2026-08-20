const LEGACY_ACKNOWLEDGEMENT = "I_UNDERSTAND_THIS_IS_LEGACY"
const DATA_MUTATION_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_THIS_WILL_CREATE_AND_DELETE_TEST_DATA"

type Environment = Record<string, string | undefined>

function isLocalDevelopmentUrl(value: string | undefined): boolean {
  if (!value) return false

  try {
    const url = new URL(value)
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]")
    )
  } catch {
    return false
  }
}

/**
 * The old custom browser harness creates and broad-cleans test records. It is
 * retained only for local archaeology and must never target shared or
 * production data.
 */
export function assertLegacyE2ESafeToRun(environment: Environment = process.env) {
  if (environment.E2E_LEGACY_UNSAFE_ENABLED !== LEGACY_ACKNOWLEDGEMENT) {
    throw new Error(
      "Legacy E2E harness is disabled. Use scripts/browser-test-routine.md for supported QA.",
    )
  }

  if (
    environment.E2E_ALLOW_DATA_MUTATION !== DATA_MUTATION_ACKNOWLEDGEMENT
  ) {
    throw new Error(
      "Legacy E2E harness requires explicit acknowledgement of test-data mutation.",
    )
  }

  if (!isLocalDevelopmentUrl(environment.E2E_BASE_URL)) {
    throw new Error(
      "Legacy E2E harness only supports an explicit local development URL (http://localhost or http://127.0.0.1).",
    )
  }
}
