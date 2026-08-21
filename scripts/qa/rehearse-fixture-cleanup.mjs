#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import pg from "pg"
import { createClient } from "@supabase/supabase-js"
import { validateIsolationPreflight } from "../../lib/qa/isolation-preflight.mjs"

const { Client } = pg

async function readJson(path, code) {
  if (!path) throw new Error(`Fixture rehearsal failed: ${code}`)
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    throw new Error(`Fixture rehearsal failed: ${code}`)
  }
}

function manifestRow(manifest, table) {
  const matches = manifest.databaseRows.filter((row) => row.table === table)
  if (matches.length !== 1) throw new Error("Fixture rehearsal failed: manifest-row")
  return matches[0]
}

function storageLocation(manifest) {
  if (manifest.storageObjects.length !== 1) {
    throw new Error("Fixture rehearsal failed: manifest-storage")
  }
  return { bucket: "cvs", path: manifest.storageObjects[0] }
}

async function exactStorageObjectExists(storage, bucket, path) {
  const separator = path.lastIndexOf("/")
  const directory = separator >= 0 ? path.slice(0, separator) : ""
  const fileName = separator >= 0 ? path.slice(separator + 1) : path
  const { data, error } = await storage.from(bucket).list(directory, {
    limit: 10,
    search: fileName,
  })
  if (error) throw new Error("Fixture rehearsal failed: storage-read")
  return (data ?? []).some((object) => object.name === fileName)
}

let client
let storage
let userId
let repreneurId
let storageFixture
let createdUser = false
let createdRepreneur = false
let createdStorage = false

try {
  const [evidence, manifest] = await Promise.all([
    readJson(process.env.QA_PREFLIGHT_EVIDENCE_FILE, "evidence-file"),
    readJson(process.env.QA_FIXTURE_MANIFEST_FILE, "manifest-file"),
  ])
  const isolation = validateIsolationPreflight({ env: process.env, evidence, manifest })
  const userRow = manifestRow(manifest, "user")
  const repreneurRow = manifestRow(manifest, "repreneurs")
  userId = userRow.id
  repreneurId = repreneurRow.id
  storageFixture = storageLocation(manifest)

  const database = new URL(process.env.DATABASE_URL)
  client = new Client({
    host: database.hostname,
    port: Number(database.port || "5432"),
    user: decodeURIComponent(database.username),
    password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || "postgres",
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const before = await client.query(
    `SELECT
      (SELECT count(*)::int FROM public."user" WHERE id = $1) AS user_count,
      (SELECT count(*)::int FROM public.repreneurs WHERE id = $2) AS repreneur_count`,
    [userId, repreneurId],
  )
  if (before.rows[0].user_count !== 0 || before.rows[0].repreneur_count !== 0) {
    throw new Error("Fixture rehearsal failed: fixture-preexists")
  }
  if (await exactStorageObjectExists(storage.storage, storageFixture.bucket, storageFixture.path)) {
    throw new Error("Fixture rehearsal failed: storage-preexists")
  }

  await client.query(
    `INSERT INTO public."user" (id, name, email, "emailVerified")
     VALUES ($1, $2, 'delivered@resend.dev', true)`,
    [userId, manifest.fixturePrefix],
  )
  createdUser = true
  await client.query(
    `INSERT INTO public.repreneurs (id, email, first_name, last_name, source, created_by)
     VALUES ($1, 'delivered@resend.dev', $2, $2, 'qa_fixture_rehearsal', $3)`,
    [repreneurId, manifest.fixturePrefix, userId],
  )
  createdRepreneur = true

  const probePdf = Buffer.from("%PDF-1.4\n% TEST fixture cleanup probe\n%%EOF\n")
  const { error: uploadError } = await storage.storage
    .from(storageFixture.bucket)
    .upload(storageFixture.path, probePdf, {
      contentType: "application/pdf",
      upsert: false,
    })
  if (uploadError) throw new Error("Fixture rehearsal failed: storage-create")
  createdStorage = true
} catch (error) {
  process.exitCode = 1
  const message =
    error instanceof Error &&
    (error.message.startsWith("Fixture rehearsal failed:") ||
      error.message.startsWith("Isolation preflight failed:"))
      ? error.message
      : "Fixture rehearsal failed: unknown"
  console.error(message)
} finally {
  try {
    if (createdStorage && storage && storageFixture) {
      const { error } = await storage.storage
        .from(storageFixture.bucket)
        .remove([storageFixture.path])
      if (error) throw new Error("Fixture rehearsal failed: storage-cleanup")
    }
    if (client && createdRepreneur) {
      await client.query("DELETE FROM public.repreneurs WHERE id = $1", [repreneurId])
    }
    if (client && createdUser) {
      await client.query('DELETE FROM public."user" WHERE id = $1', [userId])
    }

    if (client && userId && repreneurId && storage && storageFixture) {
      const after = await client.query(
        `SELECT
          (SELECT count(*)::int FROM public."user" WHERE id = $1) AS user_count,
          (SELECT count(*)::int FROM public.repreneurs WHERE id = $2) AS repreneur_count`,
        [userId, repreneurId],
      )
      const databaseResidue =
        after.rows[0].user_count !== 0 || after.rows[0].repreneur_count !== 0
      const storageResidue = await exactStorageObjectExists(
        storage.storage,
        storageFixture.bucket,
        storageFixture.path,
      )
      if (databaseResidue || storageResidue) {
        throw new Error("Fixture rehearsal failed: fixture-cleanup-residue")
      }
      if (!process.exitCode) {
        console.log(
          JSON.stringify({
            ok: true,
            projectRef: process.env.QA_SUPABASE_PROJECT_REF,
            runId: process.env.QA_RUN_ID,
            databaseResidue: 0,
            storageResidue: 0,
          }),
        )
      }
    }
  } catch (cleanupError) {
    process.exitCode = 1
    console.error(
      cleanupError instanceof Error && cleanupError.message.startsWith("Fixture rehearsal failed:")
        ? cleanupError.message
        : "Fixture rehearsal failed: cleanup-unknown",
    )
  } finally {
    await client?.end().catch(() => {})
  }
}
