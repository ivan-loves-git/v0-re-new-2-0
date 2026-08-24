#!/usr/bin/env node
// Gate 2 only: invokes the adoption inside one transaction and always rolls back.
import crypto from "node:crypto"
import fs from "node:fs"
import pg from "pg"
import { hardenedDatabaseConfig } from "./database-tls.mjs"

const [payloadFile, envFile = ".env.local"] = process.argv.slice(2)
if (!payloadFile) throw new Error("Usage: node scripts/rehearse-w039-geography-adoption.mjs <payload.json> [.env.local]")
const payload = JSON.parse(fs.readFileSync(payloadFile, "utf8"))
if (!Array.isArray(payload.rows) || payload.rows.length !== 148) throw new Error("Payload must contain exactly 148 rows")
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/).map(line => line.match(/^([^#=\s]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^['"]|['"]$/g, "")]))
const client = new pg.Client(hardenedDatabaseConfig(env.DIRECT_URL ?? env.DATABASE_URL))
const sourceHash = "a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5"
await client.connect()
try {
  await client.query("BEGIN")
  const before = await client.query("SELECT o.id, o.reference, o.geography_node_id, n.stable_key FROM public.opportunities o LEFT JOIN public.geography_nodes n ON n.id = o.geography_node_id ORDER BY o.id")
  const beforeByReference = new Map(before.rows.map(row => [row.reference.toLowerCase(), row]))
  const expectedOutcomes = new Map()
  for (const row of payload.rows) {
    const current = beforeByReference.get(row.reference.toLowerCase())
    if (!current) throw new Error("Payload reference is absent from the pre-state")
    const outcome = !row.geographyStableKey
      ? "review_outside_france"
      : !current.geography_node_id
        ? "applied"
        : current.stable_key === row.geographyStableKey
          ? "already_canonical"
          : "preserved_wave_edit"
    expectedOutcomes.set(outcome, (expectedOutcomes.get(outcome) ?? 0) + 1)
  }
  const applied = await client.query("SELECT public.apply_w039_geography_adoption($1,$2,$3) AS result", [sourceHash, "W-039 Gate 2 rehearsal", payload])
  const run = await client.query("SELECT COUNT(*)::int AS count FROM public.ma_w039_geography_adoption_runs WHERE source_hash = $1", [sourceHash])
  const evidence = await client.query("SELECT outcome, COUNT(*)::int AS count FROM public.ma_w039_geography_adoption_evidence GROUP BY outcome")
  const actualOutcomes = new Map(evidence.rows.map(row => [row.outcome, row.count]))
  const expectedApplied = expectedOutcomes.get("applied") ?? 0
  if (run.rows[0].count !== 1 || evidence.rows.reduce((n, row) => n + row.count, 0) !== 148 || Number(applied.rows[0].result.applied_rows) !== expectedApplied || JSON.stringify([...actualOutcomes.entries()].sort()) !== JSON.stringify([...expectedOutcomes.entries()].sort())) throw new Error("Adoption rehearsal exact outcome mismatch")
  const replay = await client.query("SELECT public.apply_w039_geography_adoption($1,$2,$3) AS result", [sourceHash, "W-039 Gate 2 identical replay", payload])
  if (replay.rows[0].result.idempotent_replay !== true) throw new Error("Adoption rehearsal identical replay was not a no-op")
  const afterReplay = await client.query("SELECT (SELECT COUNT(*) FROM public.ma_w039_geography_adoption_runs WHERE source_hash = $1)::int AS runs, (SELECT COUNT(*) FROM public.ma_w039_geography_adoption_evidence)::int AS evidence", [sourceHash])
  if (afterReplay.rows[0].runs !== 1 || afterReplay.rows[0].evidence !== 148) throw new Error("Adoption rehearsal replay duplicated evidence")
  await client.query("SAVEPOINT w039_changed_payload")
  try {
    await client.query("SELECT public.apply_w039_geography_adoption($1,$2,$3)", [sourceHash, "W-039 Gate 2 changed payload", { rows: [...payload.rows].reverse() }])
    throw new Error("Adoption rehearsal changed payload was accepted")
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT w039_changed_payload")
    if (!String(error?.message).includes("w039_geography_adoption_payload_mismatch")) throw error
  }
  await client.query("ROLLBACK")
  const after = await client.query("SELECT o.id, o.reference, o.geography_node_id, n.stable_key FROM public.opportunities o LEFT JOIN public.geography_nodes n ON n.id = o.geography_node_id ORDER BY o.id")
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) throw new Error("Rollback changed opportunity geography")
  const retained = await client.query("SELECT COUNT(*)::int AS count FROM public.ma_w039_geography_adoption_runs WHERE source_hash = $1", [sourceHash])
  if (retained.rows[0].count !== 0) throw new Error("Rollback retained adoption evidence")
  process.stdout.write(JSON.stringify({ rehearsal: "passed", outcomes: evidence.rows }))
} catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error } finally { await client.end() }
