/**
 * Explicit operator tool for #212/#214. `export` reads live PDR source only
 * after separate archive authority, source freeze and private-root provisioning.
 * Build tests use synthetic input through lib/pdr-archive.ts; do not run export
 * as part of verification, CI, deployment or normal delivery.
 */
import { assertPrivatePdrArchiveRoot, createPdrArchive, extractPdrObject, extractPdrRecord, PDR_ARCHIVE_BUCKETS, PDR_ARCHIVE_TABLES, retrievePdrRecord, verifyPdrArchive, type ArchiveSource } from "../lib/pdr-archive"
import { pdrArchiveSourceQuery } from "../lib/pdr-archive-source-query"

function flag(name: string) {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1] ?? null
}

async function readSource(): Promise<ArchiveSource> {
  const databaseUrl = process.env.PDR_ARCHIVE_DATABASE_URL
  const supabaseUrl = process.env.PDR_ARCHIVE_SUPABASE_URL
  const serviceRoleKey = process.env.PDR_ARCHIVE_SERVICE_ROLE_KEY
  if (!databaseUrl || !supabaseUrl || !serviceRoleKey) throw new Error("Approved archive credentials are unavailable")
  const [{ default: pg }, { createClient }] = await Promise.all([import("pg"), import("@supabase/supabase-js")])
  const database = new pg.Client({ connectionString: databaseUrl })
  const storage = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  await database.connect()
  try {
    const selectTable = async (name: (typeof PDR_ARCHIVE_TABLES)[number]) => {
      const result = await database.query(pdrArchiveSourceQuery(name))
      return result.rows.map((item: { row: Record<string, unknown> }) => item.row)
    }
    const snapshot = async () => {
      const tables = {} as ArchiveSource["tables"]
      for (const name of PDR_ARCHIVE_TABLES) tables[name] = await selectTable(name)
      return tables
    }
    const sourceReadAt = new Date().toISOString()
    await database.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const tables = await snapshot()
    await database.query("COMMIT")

    const objects: ArchiveSource["objects"] = []
    for (const row of tables.storage_objects) {
      const bucket = String(row.bucket_id) as (typeof PDR_ARCHIVE_BUCKETS)[number]
      const name = String(row.name)
      const { data, error } = await storage.storage.from(bucket).download(name)
      if (error || !data) throw new Error("A PDR storage object could not be retrieved")
      objects.push({ bucket, name, bytes: Buffer.from(await data.arrayBuffer()) })
    }

    // Detect source churn across the DB and Storage inventories. A separately
    // authorized cutover must freeze intake before this starts; this re-read is
    // a supplementary check, not a replacement for that boundary.
    await database.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const after = await snapshot()
    await database.query("COMMIT")
    for (const name of PDR_ARCHIVE_TABLES) {
      const canonical = (rows: Record<string, unknown>[]) => rows.map((row) => JSON.stringify(row)).sort().join("\n")
      if (canonical(tables[name]) !== canonical(after[name])) throw new Error("PDR source changed during archive export")
    }
    return { sourceReadAt, tables, objects }
  } finally {
    await database.end()
  }
}

async function main() {
  const command = process.argv[2]
  if (command === "verify") {
    const archive = flag("--archive")
    if (!archive) throw new Error("Archive path is required")
    const result = await verifyPdrArchive(archive)
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (command === "lookup") {
    const archive = flag("--archive")
    const reference = flag("--ref")
    if (!archive || !reference) throw new Error("Archive and reference are required")
    const result = await retrievePdrRecord(archive, reference)
    console.log(JSON.stringify({ reference, id: result.record.id, attachmentCount: result.attachments.length }))
    return
  }
  if (command === "extract") {
    const archive = flag("--archive")
    const reference = flag("--ref")
    const destination = flag("--dest")
    if (!archive || !reference || !destination) throw new Error("Archive, reference and private destination are required")
    console.log(await extractPdrRecord(archive, reference, destination))
    return
  }
  if (command === "extract-object") {
    const archive = flag("--archive")
    const bucket = flag("--bucket")
    const name = flag("--name")
    const destination = flag("--dest")
    if (!archive || !bucket || !name || !destination) throw new Error("Archive, bucket, object name and private destination are required")
    console.log(await extractPdrObject(archive, bucket, name, destination))
    return
  }
  if (command === "export") {
    const destination = flag("--dest")
    if (!destination || flag("--confirm-live-export") !== "issue-214-authorized" || flag("--source-frozen") !== "yes") {
      throw new Error("Live export requires a private destination, separate authority and source freeze")
    }
    await assertPrivatePdrArchiveRoot(destination)
    // The confirmation flags are operational guardrails, never a grant of
    // authority. The operator must first verify Ivan's separate live approval.
    const source = await readSource()
    const archive = await createPdrArchive(destination, source)
    console.log(JSON.stringify({ archive, verification: await verifyPdrArchive(archive) }, null, 2))
    return
  }
  throw new Error("Use verify, lookup, extract, extract-object or separately authorized export")
}

main().catch((error: unknown) => {
  // Never print raw SQL/provider errors or sensitive record contents.
  const message = error instanceof Error && /^(Archive|PDR |Missing |Historical |Both PDR |Work Card |Live export |A PDR |Approved archive |Use verify|An? archive)/.test(error.message)
    ? error.message : "PDR archive operation failed; inspect locally without sharing raw records"
  console.error(message)
  process.exitCode = 1
})
