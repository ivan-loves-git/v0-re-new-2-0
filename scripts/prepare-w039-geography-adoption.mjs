#!/usr/bin/env node
/** Build (but never apply) the hash-bound W-039 adoption payload. */
import crypto from "node:crypto"
import fs from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { hardenedDatabaseConfig } from "./database-tls.mjs"

const root = path.dirname(fileURLToPath(import.meta.url))
const expectedHash = "a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5"
const map = { FR: "france", IDF: "fr-region-idf", NE: "fr-macro-north-east", GO: "fr-macro-great-west", SO: "fr-macro-south-west", SE: "fr-macro-south-east", OM: "fr-macro-overseas", AU: "fr-region-auvergne-rhone-alpes", NA: "fr-region-nouvelle-aquitaine", OC: "fr-region-occitanie", PA: "fr-region-provence-alpes-cote-d-azur", COR: "fr-region-corsica", BR: "fr-region-brittany", NO: "fr-region-normandy", PL: "fr-region-pays-de-la-loire", CVL: "fr-region-centre-val-de-loire", HDF: "fr-region-hauts-de-france", GE: "fr-region-grand-est", BFR: "fr-region-bourgogne-franche-comte", BFC: "fr-region-bourgogne-franche-comte", DOM: "fr-region-overseas" }
const [workbook, envFile = ".env.local"] = process.argv.slice(2)
if (!workbook) throw new Error("Usage: node scripts/prepare-w039-geography-adoption.mjs <approved.xlsx> [.env.local]")
if (crypto.createHash("sha256").update(fs.readFileSync(workbook)).digest("hex") !== expectedHash) throw new Error("Approved W-010 workbook hash mismatch")
const parsed = JSON.parse(execFileSync("python3", [path.join(root, "parse-w010-workbook.py"), workbook], { encoding: "utf8" }))
if (parsed.source.sha256 !== expectedHash || parsed.opportunities.length !== 148) throw new Error("Approved W-010 manifest mismatch")
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/).map(line => line.match(/^([^#=\s]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^['"]|['"]$/g, "")]))
const client = new pg.Client(hardenedDatabaseConfig(env.DIRECT_URL ?? env.DATABASE_URL))
await client.connect()
try {
  const refs = parsed.opportunities.map(row => row.reference)
  const result = await client.query("SELECT reference, encode(extensions.digest(convert_to(coalesce(location,''),'UTF8'),'sha256'),'hex') AS digest FROM public.opportunities WHERE reference = ANY($1::text[])", [refs])
  if (result.rowCount !== 148) throw new Error("Live W-010 reference set is not exactly 148 rows")
  const digestByReference = new Map(result.rows.map(row => [row.reference.toLowerCase(), row.digest]))
  const rows = parsed.opportunities.map(row => {
    const code = row.sourceGeographyCode
    // Blank and unknown codes are preserved as explicit review outcomes.  They
    // must never be guessed from location text, a source office, or a label.
    const locationDigest = digestByReference.get(row.reference.toLowerCase())
    if (!locationDigest) throw new Error(`Missing live W-010 reference for source row ${row.sourceRow}`)
    return { reference: row.reference, sourceGeographyCode: code ?? null, geographyStableKey: map[code] ?? null, locationDigest }
  })
  process.stdout.write(JSON.stringify({ rows }))
} finally { await client.end() }
