type RuntimeEnvironment = Record<string, string | undefined>;

const SUPABASE_SSL = { rejectUnauthorized: false } as const;

export function postgresSslForConnection(
  connectionString: string,
  runtime: RuntimeEnvironment = process.env,
) {
  if (runtime.QA_FIXTURE_MODE !== "local") return SUPABASE_SSL;

  if (
    runtime.CI !== "true" ||
    runtime.GITHUB_ACTIONS !== "true" ||
    runtime.QA_CONTRACT_MODE !== "protected"
  ) {
    throw new Error(
      "Local database transport is restricted to the protected disposable fixture.",
    );
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("Protected fixture database URL is invalid.");
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) ||
    databaseUrl.port !== "54322" ||
    databaseUrl.pathname !== "/postgres"
  ) {
    throw new Error(
      "Protected fixture database must be the exact disposable loopback database.",
    );
  }

  return false;
}
