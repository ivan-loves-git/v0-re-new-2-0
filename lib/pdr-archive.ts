/** Offline historical archive format. This module has no WAVE route or database access. */
import { createHash, randomBytes } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { isAbsolute, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const PDR_ARCHIVE_TABLES = [
  "pdr_feedback", "pdr_goals", "pdr_milestones", "pdr_proposals", "pdr_requests", "pdr_work_cards",
  "wave_pdr_governance_capabilities", "wave_pdr_history_attachments", "wave_pdr_screening_records",
  "ai_generation_runs", "ai_generation_events",
  "wave_governance_snapshots", "wave_governance_projection_current", "storage_buckets", "storage_objects",
] as const
export const PDR_ARCHIVE_BUCKETS = ["pdr-attachments", "pdr-intake-attachments"] as const

type Table = typeof PDR_ARCHIVE_TABLES[number]
type Bucket = typeof PDR_ARCHIVE_BUCKETS[number]
type Row = Record<string, unknown>
export type ArchiveSource = {
  sourceReadAt: string
  tables: Record<Table, Row[]>
  objects: { bucket: Bucket; name: string; bytes: Buffer }[]
}
type ArchiveObject = { bucket: Bucket; name: string; file: string; size: number; sha256: string }
type ArchiveManifest = {
  schema: 1
  sourceReadAt: string
  datasets: Record<Table, { file: string; count: number; sha256: string }>
  objects: ArchiveObject[]
  index: { file: "index.json"; sha256: string }
}

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex")
const objectKey = (bucket: string, name: string) => `${bucket}\0${name}`
const objectFilename = (bucket: string, name: string) => `objects/${sha256(objectKey(bucket, name))}.bin`
const applicationRoot = fileURLToPath(new URL("..", import.meta.url))
const isWithin = (parent: string, child: string) => {
  const path = relative(parent, child)
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

async function assertPrivateDirectory(path: string) {
  if (!isAbsolute(path)) throw new Error("Archive directory must be absolute")
  const info = await lstat(path)
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Archive directory must be a real directory")
  if ((info.mode & 0o077) !== 0) throw new Error("Archive directory must be private (0700)")
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) throw new Error("Archive directory must belong to the operator")
  const actual = await realpath(path)
  const repo = await realpath(applicationRoot)
  if (isWithin(repo, actual)) throw new Error("Archive must be outside the application repository")
  return actual
}

export async function assertPrivatePdrArchiveRoot(path: string) {
  return assertPrivateDirectory(path)
}

async function assertPrivateFile(path: string) {
  const info = await lstat(path)
  if (info.isSymbolicLink() || !info.isFile() || (info.mode & 0o077) !== 0) throw new Error("Archive file is not private")
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) throw new Error("Archive file owner changed")
}

function requiredTables(tables: ArchiveSource["tables"]) {
  for (const table of PDR_ARCHIVE_TABLES) {
    if (!Array.isArray(tables[table])) throw new Error(`Missing archive dataset ${table}`)
  }
}

function indexFor(tables: ArchiveSource["tables"]) {
  const index: Record<string, { table: Table; id: string }> = {}
  const add = (reference: string, table: Table, id: string) => {
    if (index[reference]) throw new Error(`Duplicate archive reference ${reference}`)
    index[reference] = { table, id }
  }
  const specs: { table: Table; kind: string }[] = [
    { table: "pdr_goals", kind: "goal" }, { table: "pdr_milestones", kind: "milestone" },
    { table: "pdr_requests", kind: "request" }, { table: "pdr_proposals", kind: "proposal" },
    { table: "pdr_work_cards", kind: "work-card" },
  ]
  for (const { table, kind } of specs) {
    for (const row of tables[table]) {
      const id = String(row.id ?? "")
      if (!id) throw new Error(`${table} has no original ID`)
      add(`pdr:${kind}/${id}`, table, id)
      if ((table === "pdr_goals" || table === "pdr_milestones") && typeof row.slug === "string") {
        add(`pdr:${kind}/${row.slug}`, table, id)
      }
      if (table === "pdr_work_cards") {
        const number = Number(row.reference_number)
        if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Work Card reference_number is invalid")
        add(`W-${String(number).padStart(3, "0")}`, table, id)
      }
    }
  }
  return index
}

function validateRelationships(tables: ArchiveSource["tables"], objects: { bucket: Bucket; name: string; bytes: Buffer }[]) {
  requiredTables(tables)
  const ids = Object.fromEntries(PDR_ARCHIVE_TABLES.map((table) => [table, new Set(tables[table].map((row) => String(row.id ?? row.generation_id ?? "")))])) as Record<Table, Set<string>>
  for (const table of PDR_ARCHIVE_TABLES) {
    if (table === "storage_objects" || table === "storage_buckets" || table === "wave_governance_projection_current" || table === "wave_pdr_governance_capabilities") continue
    if (ids[table].size !== tables[table].length) throw new Error(`${table} contains duplicate or missing original IDs`)
  }
  const link = (table: Table, field: string, parent: Table) => {
    for (const row of tables[table]) {
      const value = row[field]
      if (value != null && value !== "" && !ids[parent].has(String(value))) throw new Error(`${table}.${field} has a missing ${parent} target`)
    }
  }
  const links: [Table, string, Table][] = [
    ["pdr_feedback", "work_card_id", "pdr_work_cards"],
    ["pdr_milestones", "goal_id", "pdr_goals"],
    ["pdr_proposals", "matched_proposal_id", "pdr_proposals"],
    ["pdr_proposals", "matched_work_card_id", "pdr_work_cards"],
    ["pdr_proposals", "suggested_bundle_id", "pdr_requests"],
    ["pdr_proposals", "suggested_goal_id", "pdr_goals"],
    ["pdr_proposals", "suggested_milestone_id", "pdr_milestones"],
    ["pdr_requests", "goal_id", "pdr_goals"], ["pdr_requests", "milestone_id", "pdr_milestones"],
    ["pdr_work_cards", "strategic_item_id", "pdr_requests"],
    ["pdr_work_cards", "source_proposal_id", "pdr_proposals"],
    ["pdr_work_cards", "replaces_card_id", "pdr_work_cards"],
    ["pdr_work_cards", "replaced_by_card_id", "pdr_work_cards"],
    ["wave_pdr_screening_records", "proposal_id", "pdr_proposals"],
    ["wave_pdr_screening_records", "generation_id", "ai_generation_runs"],
    ["wave_pdr_screening_records", "governance_snapshot_id", "wave_governance_snapshots"],
    ["ai_generation_events", "generation_id", "ai_generation_runs"],
    ["wave_governance_projection_current", "snapshot_id", "wave_governance_snapshots"],
  ]
  for (const [table, field, parent] of links) link(table, field, parent)
  const snapshots = new Map(tables.wave_governance_snapshots.map((row) => [String(row.id), String(row.snapshot_digest)]))
  for (const row of tables.wave_pdr_screening_records) {
    if (snapshots.get(String(row.governance_snapshot_id)) !== String(row.governance_snapshot_digest)) throw new Error("Saved screening snapshot digest mismatch")
  }
  for (const row of tables.wave_governance_projection_current) {
    if (snapshots.get(String(row.snapshot_id)) !== String(row.snapshot_digest)) throw new Error("Historical governance snapshot pointer digest mismatch")
  }

  const runIds = ids.ai_generation_runs
  for (const run of tables.ai_generation_runs) {
    if (run.feature !== "pdr_screening") throw new Error("Archive includes an unrelated AI run")
  }
  for (const event of tables.ai_generation_events) {
    if (!runIds.has(String(event.generation_id))) throw new Error("Archive includes an unrelated AI event")
  }

  const storageRows = new Set<string>()
  const buckets = new Set(tables.storage_buckets.map((row) => String(row.id)))
  if (buckets.size !== PDR_ARCHIVE_BUCKETS.length || PDR_ARCHIVE_BUCKETS.some((bucket) => !buckets.has(bucket))) throw new Error("Both PDR storage buckets must be inventoried")
  for (const row of tables.storage_objects) {
    const key = objectKey(String(row.bucket_id), String(row.name))
    if (!PDR_ARCHIVE_BUCKETS.includes(row.bucket_id as Bucket) || storageRows.has(key)) throw new Error("Storage inventory is invalid")
    storageRows.add(key)
  }
  const objectBytes = new Map<string, Buffer>()
  for (const object of objects) {
    const key = objectKey(object.bucket, object.name)
    if (!PDR_ARCHIVE_BUCKETS.includes(object.bucket) || objectBytes.has(key) || !Buffer.isBuffer(object.bytes)) throw new Error("Archive storage object is invalid")
    objectBytes.set(key, object.bytes)
  }
  if (objectBytes.size !== storageRows.size || [...storageRows].some((key) => !objectBytes.has(key))) throw new Error("Missing or extra storage object bytes")

  const attached = new Set<string>()
  for (const row of tables.wave_pdr_history_attachments) {
    const hasProposal = row.proposal_id != null
    const hasCard = row.work_card_id != null
    if (hasProposal === hasCard) throw new Error("Historical attachment must have exactly one parent")
    if (hasProposal && !ids.pdr_proposals.has(String(row.proposal_id))) throw new Error("Historical attachment proposal is missing")
    if (hasCard && !ids.pdr_work_cards.has(String(row.work_card_id))) throw new Error("Historical attachment Work Card is missing")
    const key = objectKey(String(row.storage_bucket), String(row.storage_path))
    const bytes = objectBytes.get(key)
    if (!bytes) throw new Error("Historical attachment has no storage object")
    if (Number(row.size_bytes) !== bytes.length) throw new Error("Historical attachment byte size mismatch")
    if (row.content_sha256 && row.content_sha256 !== sha256(bytes)) throw new Error("Historical attachment source digest mismatch")
    attached.add(key)
  }
  return { unlinkedStorageObjects: storageRows.size - attached.size }
}

async function readArchive(archivePath: string) {
  const archive = await assertPrivateDirectory(archivePath)
  const manifestPath = join(archive, "manifest.json")
  const digestPath = join(archive, "manifest.sha256")
  await assertPrivateFile(manifestPath)
  await assertPrivateFile(digestPath)
  const bytes = await readFile(manifestPath)
  if ((await readFile(digestPath, "utf8")).trim() !== sha256(bytes)) throw new Error("Archive manifest digest mismatch")
  const manifest = JSON.parse(bytes.toString()) as ArchiveManifest
  if (manifest.schema !== 1 || !manifest.datasets || !Array.isArray(manifest.objects)) throw new Error("Archive manifest schema is invalid")
  const tables = {} as ArchiveSource["tables"]
  for (const table of PDR_ARCHIVE_TABLES) {
    const entry = manifest.datasets[table]
    if (!entry || entry.file !== `tables/${table}.jsonl`) throw new Error(`Archive dataset ${table} is missing`)
    const path = join(archive, entry.file)
    await assertPrivateFile(path)
    const data = await readFile(path)
    if (sha256(data) !== entry.sha256) throw new Error(`${table} dataset digest mismatch`)
    const lines = data.toString("utf8").trimEnd()
    const rows = lines ? lines.split("\n").map((line) => JSON.parse(line) as Row) : []
    if (rows.length !== entry.count) throw new Error(`${table} row count mismatch`)
    tables[table] = rows
  }
  const objects: ArchiveSource["objects"] = []
  for (const entry of manifest.objects) {
    if (!PDR_ARCHIVE_BUCKETS.includes(entry.bucket) || entry.file !== objectFilename(entry.bucket, entry.name)) throw new Error("Archive object path is invalid")
    const path = join(archive, entry.file)
    await assertPrivateFile(path)
    const data = await readFile(path)
    if (data.length !== entry.size || sha256(data) !== entry.sha256) throw new Error("Archive object digest or size mismatch")
    objects.push({ bucket: entry.bucket, name: entry.name, bytes: data })
  }
  if (manifest.index?.file !== "index.json") throw new Error("Archive index is missing")
  const indexPath = join(archive, "index.json")
  await assertPrivateFile(indexPath)
  const indexBytes = await readFile(indexPath)
  if (sha256(indexBytes) !== manifest.index.sha256) throw new Error("Archive index digest mismatch")
  const index = JSON.parse(indexBytes.toString()) as ReturnType<typeof indexFor>
  if (JSON.stringify(index) !== JSON.stringify(indexFor(tables))) throw new Error("Archive reference index mismatch")
  const relationships = validateRelationships(tables, objects)
  return { manifest, tables, objects, index, relationships }
}

export async function createPdrArchive(destinationRoot: string, source: ArchiveSource) {
  const root = await assertPrivateDirectory(destinationRoot)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(source.sourceReadAt)) throw new Error("Archive source timestamp is invalid")
  validateRelationships(source.tables, source.objects)
  const index = indexFor(source.tables)
  const staging = await mkdtemp(join(root, ".staging-"))
  await chmod(staging, 0o700)
  try {
    const tablesDir = join(staging, "tables")
    const objectsDir = join(staging, "objects")
    await mkdir(tablesDir, { mode: 0o700 })
    await mkdir(objectsDir, { mode: 0o700 })
    const datasets = {} as ArchiveManifest["datasets"]
    for (const table of PDR_ARCHIVE_TABLES) {
      const file = `tables/${table}.jsonl`
      const data = Buffer.from(source.tables[table].map((row) => JSON.stringify(row)).join("\n") + (source.tables[table].length ? "\n" : ""))
      await writeFile(join(staging, file), data, { flag: "wx", mode: 0o600 })
      datasets[table] = { file, count: source.tables[table].length, sha256: sha256(data) }
    }
    const objects: ArchiveObject[] = []
    for (const object of source.objects) {
      const file = objectFilename(object.bucket, object.name)
      await writeFile(join(staging, file), object.bytes, { flag: "wx", mode: 0o600 })
      objects.push({ bucket: object.bucket, name: object.name, file, size: object.bytes.length, sha256: sha256(object.bytes) })
    }
    const indexBytes = Buffer.from(JSON.stringify(index, null, 2) + "\n")
    await writeFile(join(staging, "index.json"), indexBytes, { flag: "wx", mode: 0o600 })
    const manifest: ArchiveManifest = { schema: 1, sourceReadAt: source.sourceReadAt, datasets, objects, index: { file: "index.json", sha256: sha256(indexBytes) } }
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n")
    await writeFile(join(staging, "manifest.json"), manifestBytes, { flag: "wx", mode: 0o600 })
    await writeFile(join(staging, "manifest.sha256"), `${sha256(manifestBytes)}\n`, { flag: "wx", mode: 0o600 })
    await readArchive(staging)
    const finalPath = join(root, `archive-${source.sourceReadAt.replace(/[^0-9]/g, "")}-${randomBytes(4).toString("hex")}`)
    await rename(staging, finalPath)
    return finalPath
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

export async function verifyPdrArchive(archivePath: string) {
  const { tables, objects, relationships, manifest } = await readArchive(archivePath)
  const counts = Object.fromEntries(PDR_ARCHIVE_TABLES.map((table) => [table, tables[table].length])) as Record<Table, number>
  return { sourceReadAt: manifest.sourceReadAt, counts, objectCount: objects.length, unlinkedStorageObjects: relationships.unlinkedStorageObjects, manifestSha256: sha256(await readFile(join(archivePath, "manifest.json"))) }
}

export async function retrievePdrRecord(archivePath: string, reference: string) {
  const { tables, objects, index } = await readArchive(archivePath)
  const target = index[reference]
  if (!target) throw new Error("Historical reference not found")
  const record = tables[target.table].find((row) => String(row.id) === target.id)
  if (!record) throw new Error("Indexed historical record is missing")
  const attachments = tables.wave_pdr_history_attachments
    .filter((row) => (target.table === "pdr_proposals" && row.proposal_id === target.id) || (target.table === "pdr_work_cards" && row.work_card_id === target.id))
    .map((metadata) => {
      const object = objects.find((item) => item.bucket === metadata.storage_bucket && item.name === metadata.storage_path)
      if (!object) throw new Error("Indexed historical attachment is missing")
      return { metadata, bytes: object.bytes }
    })
  return { record, attachments }
}

/** Retrieve one inventoried object, including unlinked legacy bucket bytes. */
export async function retrievePdrObject(archivePath: string, bucket: string, name: string) {
  if (!PDR_ARCHIVE_BUCKETS.includes(bucket as Bucket) || !name) throw new Error("Historical storage reference is invalid")
  const { objects } = await readArchive(archivePath)
  const object = objects.find((item) => item.bucket === bucket && item.name === name)
  if (!object) throw new Error("Historical storage object not found")
  return object.bytes
}

/** Export one verified object and its original Storage reference privately. */
export async function extractPdrObject(archivePath: string, bucket: string, name: string, outputRoot: string) {
  const root = await assertPrivateDirectory(outputRoot)
  const bytes = await retrievePdrObject(archivePath, bucket, name)
  const destination = await mkdtemp(join(root, "pdr-object-"))
  await chmod(destination, 0o700)
  try {
    await writeFile(join(destination, "reference.json"), JSON.stringify({ bucket, name, size: bytes.length, sha256: sha256(bytes) }, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    const file = join(destination, "content.bin")
    await writeFile(file, bytes, { flag: "wx", mode: 0o600 })
    return file
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  }
}

/** Writes a requested historical record into another private local directory. */
export async function extractPdrRecord(archivePath: string, reference: string, outputRoot: string) {
  const root = await assertPrivateDirectory(outputRoot)
  const { record, attachments } = await retrievePdrRecord(archivePath, reference)
  const destination = await mkdtemp(join(root, "pdr-retrieval-"))
  await chmod(destination, 0o700)
  try {
    await writeFile(join(destination, "record.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 })
    for (const attachment of attachments) {
      const id = String(attachment.metadata.id)
      const basename = sha256(id)
      await writeFile(join(destination, `${basename}.metadata.json`), JSON.stringify(attachment.metadata, null, 2) + "\n", { flag: "wx", mode: 0o600 })
      await writeFile(join(destination, `${basename}.bin`), attachment.bytes, { flag: "wx", mode: 0o600 })
    }
    return destination
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  }
}
