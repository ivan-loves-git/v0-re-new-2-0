import { isExposedTableName, isSecretColumnName } from "@/lib/mcp/data-exposure"

/** Anything that runs a parameterized read, such as a `pg` Pool. */
export interface Queryable {
  query<Row>(text: string, values?: unknown[]): Promise<{ rows: Row[] }>
}

export interface TableSummary {
  name: string
  kind: "table" | "view"
  approximateRows: number | null
  description: string | null
}

export interface ColumnDescription {
  name: string
  type: string
  nullable: boolean
  primaryKey: boolean
  references: string | null
  description: string | null
}

export interface TableDescription extends TableSummary {
  columns: ColumnDescription[]
  /** Exposed tables that point at this one and can be embedded from it. */
  referencedBy: string[]
}

const TABLES_SQL = `
  SELECT c.relname AS name,
         CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
         CASE WHEN c.relkind IN ('r', 'p') AND c.reltuples >= 0
              THEN c.reltuples::bigint END AS approximate_rows,
         obj_description(c.oid, 'pg_class') AS description
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'p', 'v', 'm')
     AND NOT c.relispartition
     -- Only what the read path can actually reach.
     AND has_table_privilege('service_role', c.oid, 'SELECT')
   ORDER BY c.relname`

const COLUMNS_SQL = `
  SELECT a.attname AS name,
         format_type(a.atttypid, a.atttypmod) AS type,
         NOT a.attnotnull AS nullable,
         col_description(c.oid, a.attnum) AS description
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = $1
     AND a.attnum > 0
     AND NOT a.attisdropped
   ORDER BY a.attnum`

// Column lists are text[]: node-postgres leaves name[] unparsed, as "{id}".
const CONSTRAINTS_SQL = `
  SELECT con.contype AS kind,
         source.relname AS source_table,
         target.relname AS target_table,
         ARRAY(SELECT att.attname::text
                 FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, position)
                 JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
                ORDER BY k.position) AS source_columns,
         ARRAY(SELECT att.attname::text
                 FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, position)
                 JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = k.attnum
                ORDER BY k.position) AS target_columns
    FROM pg_constraint con
    JOIN pg_class source ON source.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = source.relnamespace
    LEFT JOIN pg_class target ON target.oid = con.confrelid AND target.relnamespace = n.oid
   WHERE n.nspname = 'public'
     AND con.contype IN ('p', 'f')
     AND (source.relname = $1 OR target.relname = $1)`

interface TableRow {
  name: string
  kind: "table" | "view"
  approximate_rows: string | number | null
  description: string | null
}

interface ColumnRow {
  name: string
  type: string
  nullable: boolean
  description: string | null
}

interface ConstraintRow {
  kind: "p" | "f"
  source_table: string
  target_table: string | null
  source_columns: string[] | string
  target_columns: string[] | string
}

/** An array, or Postgres array text such as `{id}` from a driver that left it unparsed. */
function columnList(value: string[] | string): string[] {
  if (Array.isArray(value)) return value
  return [...value.replace(/^\{|\}$/g, "").matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)].map(
    ([, quoted, plain]) => quoted?.replace(/\\(.)/g, "$1") ?? plain,
  )
}

const CATALOG_TTL_MS = 5 * 60 * 1000

export function createCatalog(database: Queryable, now: () => number = Date.now) {
  let cached: { at: number; tables: TableSummary[] } | null = null

  async function listTables(): Promise<TableSummary[]> {
    if (cached && now() - cached.at < CATALOG_TTL_MS) return cached.tables
    const { rows } = await database.query<TableRow>(TABLES_SQL)
    const tables = rows
      .filter((row) => isExposedTableName(row.name))
      .map((row) => ({
        name: row.name,
        kind: row.kind,
        approximateRows:
          row.approximate_rows === null ? null : Number(row.approximate_rows),
        description: row.description,
      }))
    cached = { at: now(), tables }
    return tables
  }

  async function exposedTableNames() {
    return new Set((await listTables()).map((table) => table.name))
  }

  async function describeTable(name: string): Promise<TableDescription | null> {
    const exposed = await exposedTableNames()
    if (!exposed.has(name)) return null
    const summary = (await listTables()).find((table) => table.name === name)!
    const [{ rows: columns }, { rows: constraintRows }] = await Promise.all([
      database.query<ColumnRow>(COLUMNS_SQL, [name]),
      database.query<ConstraintRow>(CONSTRAINTS_SQL, [name]),
    ])
    const constraints = constraintRows.map((row) => ({
      ...row,
      source_columns: columnList(row.source_columns),
      target_columns: columnList(row.target_columns),
    }))

    const primaryKey = new Set(
      constraints
        .filter((row) => row.kind === "p" && row.source_table === name)
        .flatMap((row) => row.source_columns),
    )
    const references = new Map<string, string>()
    for (const row of constraints) {
      if (row.kind !== "f" || row.source_table !== name || !row.target_table) continue
      if (!exposed.has(row.target_table)) continue
      row.source_columns.forEach((column, index) => {
        references.set(column, `${row.target_table}.${row.target_columns[index]}`)
      })
    }
    const referencedBy = [
      ...new Set(
        constraints
          .filter(
            (row) =>
              row.kind === "f" &&
              row.target_table === name &&
              exposed.has(row.source_table),
          )
          .map((row) => row.source_table),
      ),
    ].sort()

    return {
      ...summary,
      columns: columns
        .filter((column) => !isSecretColumnName(column.name))
        .map((column) => ({
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          primaryKey: primaryKey.has(column.name),
          references: references.get(column.name) ?? null,
          description: column.description,
        })),
      referencedBy,
    }
  }

  return { listTables, exposedTableNames, describeTable }
}

export type WaveCatalog = ReturnType<typeof createCatalog>
