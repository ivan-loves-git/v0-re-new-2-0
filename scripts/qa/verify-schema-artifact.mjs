#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import {
  inspectSchemaArtifact,
  schemaObjectCounts,
  schemaObjectInventory,
} from "../../lib/qa/schema-artifact.mjs"

const BUILD_771_COUNTS = {
  tables: 79,
  types: 21,
  functions: 165,
  views: 1,
  indexes: 162,
  triggers: 65,
  policies: 19,
  rlsTables: 79,
  constraints: 251,
}
const BUILD_771_INVENTORY_SHA256 =
  "091f2d7366fd6be452253d8f7e3463eda2c9b26d5886836637574ac5ea4b46a3"

const path = process.argv[2]
if (!path) {
  console.error("Schema artifact verification failed: path-required")
  process.exit(1)
}

try {
  const artifact = await readFile(path, "utf8")
  const result = inspectSchemaArtifact(artifact, BUILD_771_COUNTS)
  const inventory = schemaObjectInventory(artifact)
  const inventorySha256 = createHash("sha256").update(inventory.join("\n")).digest("hex")
  if (inventorySha256 !== BUILD_771_INVENTORY_SHA256) {
    result.ok = false
    result.findings.push("inventory-fingerprint")
  }
  if (!result.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        findings: result.findings,
      }),
    )
    process.exit(1)
  }
  console.log(
    JSON.stringify({
      ok: true,
      bytes: Buffer.byteLength(artifact),
      sha256: createHash("sha256").update(artifact).digest("hex"),
      structure: schemaObjectCounts(artifact),
      inventoryObjects: inventory.length,
      inventorySha256,
    }),
  )
} catch {
  console.error("Schema artifact verification failed: unreadable")
  process.exit(1)
}
