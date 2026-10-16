/**
 * What the staff Claude connection may read (#265).
 *
 * Staff already see every business record in WAVE, so the connection exposes
 * every public table except the login system and the retired PDR. Columns that
 * hold credentials or capability secrets are removed everywhere, including
 * from related rows, and cannot be filtered or sorted on.
 */

const LOGIN_TABLES = new Set([
  "user",
  "session",
  "account",
  "verification",
  "rateLimit",
  "oauthApplication",
  "oauthAccessToken",
  "oauthConsent",
])

// Historical PDR, including its governance snapshots, is recovered from the
// private archive, never through WAVE (#212).
const RETIRED_TABLE_PREFIXES = ["pdr_", "wave_pdr_", "wave_governance_"]

const SECRET_COLUMN = /password|secret|token$|api_?key|credential/i

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isExposedTableName(name: string) {
  if (!IDENTIFIER.test(name)) return false
  if (LOGIN_TABLES.has(name)) return false
  return !RETIRED_TABLE_PREFIXES.some((prefix) => name.startsWith(prefix))
}

export function isSecretColumnName(name: string) {
  return SECRET_COLUMN.test(name)
}

/** Removes secret-named keys from rows and from every nested related row. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value === null || typeof value !== "object") return value
  const clean: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretColumnName(key)) continue
    clean[key] = redactSecrets(entry)
  }
  return clean
}

export class QueryRejected extends Error {}

const SELECT_CHARACTERS = /^[A-Za-z0-9_,*()!:.\->\s]*$/
// A relation is a name directly followed by "(" or "!", e.g. `offices(name)`
// or `offices!inner(name)`. A name after "!" is a hint, not a relation.
// PostgREST also embeds through a foreign-key column or constraint name; those
// are not table names, so they are rejected rather than resolved.
const RELATION_NAME = /(?<![!A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\s*(?=[!(])/g
const ANY_NAME = /[A-Za-z_][A-Za-z0-9_]*/g

/**
 * Accepts a PostgREST select list only when every related table it embeds is
 * exposed and no name in it (column, alias or JSON key) is secret-like. An
 * alias could otherwise return a secret under an innocent key.
 */
export function validateSelect(select: string | undefined, exposedTables: ReadonlySet<string>) {
  const value = (select ?? "*").trim() || "*"
  if (value.length > 2000 || !SELECT_CHARACTERS.test(value)) {
    throw new QueryRejected(
      "select may only contain column names, related tables in parentheses, commas, *, aliases (alias:column) and JSON arrows.",
    )
  }
  let depth = 0
  for (const character of value) {
    if (character === "(") depth += 1
    if (character === ")") depth -= 1
    if (depth < 0) throw new QueryRejected("select has unbalanced parentheses.")
  }
  if (depth !== 0) throw new QueryRejected("select has unbalanced parentheses.")

  for (const match of value.matchAll(RELATION_NAME)) {
    const relation = match[1]
    if (!exposedTables.has(relation)) {
      throw new QueryRejected(`"${relation}" is not a readable related table.`)
    }
  }
  for (const [name] of value.matchAll(ANY_NAME)) {
    if (isSecretColumnName(name)) {
      throw new QueryRejected(`"${name}" is a protected column.`)
    }
  }
  return value.replace(/\s+/g, "")
}

const COLUMN_PATH =
  /^(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z_][A-Za-z0-9_]*)((?:->>?[A-Za-z0-9_]+)*)$/

/**
 * Accepts `column`, `related_table.column` and JSON paths such as
 * `metadata->>source`. Secret columns are never filterable or sortable, so
 * their values cannot be inferred one character at a time.
 */
export function validateColumnPath(path: string, exposedTables: ReadonlySet<string>) {
  const match = COLUMN_PATH.exec(path)
  if (!match) {
    throw new QueryRejected(
      `"${path}" is not a column. Use column, related_table.column or json_column->>key.`,
    )
  }
  const [, relation, column, jsonPath] = match
  if (relation && !exposedTables.has(relation)) {
    throw new QueryRejected(`"${relation}" is not a readable related table.`)
  }
  const jsonKeys = jsonPath.split(/->>?/).filter(Boolean)
  if ([column, ...jsonKeys].some(isSecretColumnName)) {
    throw new QueryRejected(`"${path}" is a protected column.`)
  }
  return path
}
