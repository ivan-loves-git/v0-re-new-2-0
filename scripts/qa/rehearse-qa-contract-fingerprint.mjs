#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import pg from "pg"
import { loadFingerprintRehearsalContract, assertPinnedFingerprint } from "../../lib/qa/contract-fingerprint-rehearsal.mjs"
import { STRUCTURE_FINGERPRINT_SQL, fingerprintStructureRows } from "../../lib/qa/structure-fingerprint.mjs"

const databaseUrl = process.env.QA_CONTRACT_REHEARSAL_DATABASE_URL

function fail(code) {
  throw new Error(`QA contract fingerprint rehearsal failed: ${code}`)
}

if (!databaseUrl) fail("database-url")

const { contract, files } = await loadFingerprintRehearsalContract()
const contractBytes = await readFile(new URL("../../supabase/qa-contract.json", import.meta.url))
const qaContractSha256 = createHash("sha256").update(contractBytes).digest("hex")
const candidateSha = process.env.QA_CANDIDATE_SHA ?? process.env.GITHUB_SHA ?? "local"
const client = new pg.Client({ connectionString: databaseUrl })
try {
  await client.connect()
  // This is the deliberately small, disposable Supabase-shaped prerequisite.
  // It is outside public/qa_control and therefore cannot contribute directly
  // to the structure fingerprint.
  await client.query(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE ROLE supabase_admin NOLOGIN;
    CREATE SCHEMA extensions;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false);
    CREATE TABLE storage.objects (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, bucket_id text NOT NULL, name text NOT NULL);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  `)
  for (const file of files) await client.query(file.content)
  const [structure, version] = await Promise.all([
    client.query(STRUCTURE_FINGERPRINT_SQL),
    client.query("SHOW server_version"),
  ])
  const actual = fingerprintStructureRows(structure.rows)
  console.log(`QA_CONTRACT_ACTUAL_STRUCTURE_FINGERPRINT=${actual}`)
  console.log(JSON.stringify({
    qaContractFingerprintEvidence: {
      version: contract.version,
      candidateSha,
      qaContractSha256,
      expectedStructureFingerprint: contract.structureFingerprint,
      actualStructureFingerprint: actual,
      postgresVersion: version.rows[0].server_version,
      files: files.map(({ path, sha256 }) => ({ path, sha256 })),
    },
  }))
  assertPinnedFingerprint(contract.structureFingerprint, actual)
} finally {
  await client.end()
}
