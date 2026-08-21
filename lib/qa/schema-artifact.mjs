const PRODUCTION_PATTERNS = [
  /iiuqcdnmxhtyispnykgf/i,
  /(?:^|[^a-z0-9-])app\.re-new\.team(?:[^a-z0-9-]|$)/i,
  /(?:^|[^a-z0-9-])re-new\.team(?:[^a-z0-9-]|$)/i,
  /v0-re-new-2-0\.vercel\.app/i,
]
const CUSTOMER_IDENTITY_PATTERNS = [/bertrand/i, /galas/i]
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const SECRET_PATTERNS = [
  /postgres(?:ql)?:\/\/[^\s'";]+/i,
  /\bsbp_[a-f0-9]{40}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
]

function withoutDollarQuotedBodies(source) {
  return source.replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, (match) =>
    " ".repeat(match.length),
  )
}

export function schemaObjectCounts(source) {
  const count = (pattern) => source.match(pattern)?.length ?? 0
  return {
    tables: count(/^CREATE TABLE /gim),
    types: count(/^CREATE TYPE /gim),
    functions: count(/^CREATE FUNCTION /gim),
    views: count(/^CREATE VIEW /gim),
    indexes: count(/^CREATE (?:UNIQUE )?INDEX /gim),
    triggers: count(/^CREATE TRIGGER /gim),
    policies: count(/^CREATE POLICY /gim),
    rlsTables: count(/ENABLE ROW LEVEL SECURITY/gim),
    constraints: count(/ADD CONSTRAINT/gim),
  }
}

export function inspectSchemaArtifact(source, expectedCounts) {
  const findings = new Set()
  const topLevel = withoutDollarQuotedBodies(source)

  if (
    /^\s*(?:INSERT\s+INTO|COPY\s+|UPDATE\s+|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE\s+|CREATE\s+TABLE[^;]*\sAS\s+SELECT)/gim.test(
      topLevel,
    )
  ) {
    findings.add("row-bearing-statement")
  }
  if (PRODUCTION_PATTERNS.some((pattern) => pattern.test(source))) {
    findings.add("production-identity")
  }
  if (EMAIL_PATTERN.test(source)) findings.add("email-like-value")
  if (CUSTOMER_IDENTITY_PATTERNS.some((pattern) => pattern.test(source))) {
    findings.add("customer-identity")
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(source))) {
    findings.add("secret-like-value")
  }
  if (!/CREATE\s+TABLE/i.test(source)) findings.add("missing-tables")
  if (!/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(source)) findings.add("missing-rls")
  if (!/\bGRANT\b/i.test(source)) findings.add("missing-grants")
  if (/^\\(?:restrict|unrestrict)\b/gim.test(source)) findings.add("psql-meta-command")
  if (expectedCounts) {
    const observed = schemaObjectCounts(source)
    if (Object.entries(expectedCounts).some(([key, value]) => observed[key] !== value)) {
      findings.add("structure-counts")
    }
  }

  const result = [...findings].sort()
  return { ok: result.length === 0, findings: result }
}
