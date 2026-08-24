export function databaseTls(connectionString, environment = process.env) {
  const host = new URL(connectionString).hostname
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return false
  const ca = environment.DATABASE_CA_CERT?.replace(/\\n/g, "\n")
  if (!ca || !ca.includes("BEGIN CERTIFICATE")) throw new Error("DATABASE_CA_CERT is required for remote PostgreSQL TLS")
  return { ca, rejectUnauthorized: true }
}
