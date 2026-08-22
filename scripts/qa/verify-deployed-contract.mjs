#!/usr/bin/env node
import { readFile, realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { assertDeployedQaContract, buildQaContract, stableQaOrigin } from "../../lib/qa/permanent-contract.mjs"

function fail(code) {
  throw new Error(`QA deployed contract preflight failed: ${code}`)
}

function databaseRef(value) {
  try {
    const database = new URL(value)
    return database.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
      || decodeURIComponent(database.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
      || ""
  } catch {
    return ""
  }
}

async function authorizedResponse(origin, bypass) {
  let nextUrl = `${origin}/auth/login`
  let cookie = ""
  for (let redirect = 0; redirect < 4; redirect += 1) {
    if (new URL(nextUrl).origin !== origin) fail("redirect-origin")
    const response = await fetch(nextUrl, {
      headers: {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      redirect: "manual",
    })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get("location")
    if (!location) fail("redirect")
    nextUrl = new URL(location, nextUrl).href
    const setCookie = response.headers.get("set-cookie")
    if (setCookie) cookie = setCookie.split(";", 1)[0]
  }
  fail("redirect-limit")
}

try {
  const origin = stableQaOrigin()
  const expectedRef = process.env.QA_SUPABASE_PROJECT_REF
  const candidateSha = process.env.QA_EXPECTED_SHA
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (!bypass) fail("bypass")
  if (databaseRef(process.env.DATABASE_URL) !== expectedRef) fail("runner-database-ref")
  const candidateRoot = await realpath(resolve(process.cwd(), process.env.QA_CANDIDATE_ROOT || "."))
  const contract = JSON.parse(await readFile(resolve(candidateRoot, "supabase/qa-contract.json"), "utf8"))
  const expected = buildQaContract({ projectRef: expectedRef, candidateSha, structureFingerprint: contract.structureFingerprint })
  const [unauthenticated, authorized] = await Promise.all([
    fetch(`${origin}/auth/login`, { redirect: "manual" }),
    authorizedResponse(origin, bypass),
  ])
  const unauthenticatedBlocked = unauthenticated.status >= 300 && unauthenticated.status < 400 && (unauthenticated.headers.get("location") || "").startsWith("https://vercel.com/")
  if (!unauthenticatedBlocked || authorized.status !== 200) fail("protection")
  const actual = {
    origin,
    candidateSha: authorized.headers.get("x-renew-deployment-sha") || "",
    projectRef: authorized.headers.get("x-renew-qa-ref") || "",
    apiRef: authorized.headers.get("x-renew-qa-api-ref") || "",
    databaseRef: authorized.headers.get("x-renew-qa-database-ref") || "",
    storageRef: authorized.headers.get("x-renew-qa-storage-ref") || "",
    structureFingerprint: authorized.headers.get("x-renew-qa-structure") || "",
    validationProject: authorized.headers.get("x-renew-qa-project") || "",
    mailPolicy: authorized.headers.get("x-renew-qa-mail-policy") || "",
    mailTransport: authorized.headers.get("x-renew-qa-mail-transport") || "",
  }
  assertDeployedQaContract(expected, actual)
  console.log(JSON.stringify({ ok: true, candidateSha, projectRef: expectedRef, origin, unauthenticatedBlocked: true, authorizedStatus: 200 }))
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("QA deployed contract preflight failed:") ? error.message : error instanceof Error && error.message.startsWith("QA contract failed:") ? error.message : "QA deployed contract preflight failed: unknown")
  process.exit(1)
}
