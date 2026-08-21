#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises"

const path = process.argv[2]
if (!path) {
  console.error("Schema sanitization failed: path-required")
  process.exit(1)
}

const allowedFunctions = new Set([
  'function:"public"."assert_ma_provisional_source_context_integrity"',
  'function:"public"."guard_ma_provisional_bertrand_contact_identity"',
])
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

try {
  const source = await readFile(path, "utf8")
  const lines = source.split("\n")
  let currentObject = "preamble"
  let replacementIndex = 0
  let identityReplacements = 0

  const sanitized = lines.map((line) => {
    const objectMatch = line.match(
      /^CREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|FUNCTION|VIEW|TYPE|SEQUENCE)\s+([^\s(]+)/i,
    )
    if (objectMatch) currentObject = `${objectMatch[1].toLowerCase()}:${objectMatch[2]}`

    return line.replace(emailPattern, () => {
      if (!allowedFunctions.has(currentObject)) {
        throw new Error("Schema sanitization failed: unexpected-email-location")
      }
      replacementIndex += 1
      return `TEST-schema-redacted-${String(replacementIndex).padStart(3, "0")}`
    })
  })

  if (replacementIndex !== 0 && replacementIndex !== 5) {
    throw new Error("Schema sanitization failed: unexpected-email-count")
  }

  const identitySafe = sanitized.join("\n").replace(/Bertrand Galas|Bertrand|Galas/gi, (value) => {
    identityReplacements += 1
    return value.includes(" ")
      ? "TEST-schema-redacted-person"
      : "qa_person"
  })

  const providerNeutral = identitySafe
    .replace(/^\\(?:restrict|unrestrict)\b.*\n?/gim, "")
    .replace(/^CREATE SCHEMA "public";$/m, 'CREATE SCHEMA IF NOT EXISTS "public";')
    .replace(/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin".*\n?/gim, "")
    .replace(/\n+$/g, "\n")

  const temporaryPath = `${path}.sanitized-tmp`
  await writeFile(temporaryPath, providerNeutral, { mode: 0o600, flag: "wx" })
  await rename(temporaryPath, path)
  console.log(
    JSON.stringify({
      ok: true,
      redactedEmailLiterals: replacementIndex,
      redactedIdentityFragments: identityReplacements,
    }),
  )
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith("Schema sanitization failed:")
      ? error.message
      : "Schema sanitization failed: unknown"
  console.error(message)
  process.exit(1)
}
