#!/usr/bin/env node
import { readFile, realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { EVIDENCE_FILE, countPublicRows, databaseClient, refFromDatabaseUrl, refFromSupabaseUrl, storageClient, writePrivateJson } from "./phase-b-common.mjs"
import { validateLiveEvidence } from "../../lib/qa/phase-b.mjs"

const CUSTOMER_TABLES = ["repreneurs", "opportunities", "opportunity_matches", "ma_firms", "ma_offices", "ma_contacts", "ma_contact_office_affiliations"]

async function applicationProbe(origin, bypass, executionMode) {
  if (executionMode === "github-runner") {
    let authorized
    let nextUrl = `${origin}/intake-v2`
    let cookie = ""
    for (let redirect = 0; redirect < 4; redirect += 1) {
      if (new URL(nextUrl).origin !== origin) throw new Error("Live QA evidence failed: runner-redirect-origin")
      authorized = await fetch(nextUrl, {
        headers: cookie ? { Cookie: cookie } : {},
        redirect: "manual",
      })
      if (authorized.status < 300 || authorized.status >= 400) break
      const location = authorized.headers.get("location")
      if (!location) throw new Error("Live QA evidence failed: runner-redirect")
      nextUrl = new URL(location, nextUrl).href
      const setCookie = authorized.headers.get("set-cookie")
      if (setCookie) cookie = setCookie.split(";", 1)[0]
    }
    if (!authorized) throw new Error("Live QA evidence failed: runner-response")
    return {
      unauthenticatedBlocked: false,
      authorizedStatus: authorized.status,
      deploymentSha: authorized.headers.get("x-renew-deployment-sha") || "",
      qaRef: authorized.headers.get("x-renew-qa-ref") || "",
      qaApiRef: authorized.headers.get("x-renew-qa-api-ref") || "",
      qaDatabaseRef: authorized.headers.get("x-renew-qa-database-ref") || "",
      qaStorageRef: authorized.headers.get("x-renew-qa-storage-ref") || "",
      qaStructure: authorized.headers.get("x-renew-qa-structure") || "",
      qaProject: authorized.headers.get("x-renew-qa-project") || "",
      qaMailPolicy: authorized.headers.get("x-renew-qa-mail-policy") || "",
      qaMailTransport: authorized.headers.get("x-renew-qa-mail-transport") || "",
      authHealthy: authorized.status === 200 && /^[a-z0-9]{20}$/.test(authorized.headers.get("x-renew-qa-database-ref") || ""),
      finalOrigin: new URL(authorized.url).origin,
      alias: new URL(authorized.url).hostname,
    }
  }
  if (executionMode !== "vercel") throw new Error("Live QA evidence failed: execution-mode")
  const unauthenticated = await fetch(`${origin}/intake-v2`, { redirect: "manual" })
  let authorized
  let nextUrl = `${origin}/intake-v2`
  let cookie = ""
  for (let redirect = 0; redirect < 4; redirect += 1) {
    if (new URL(nextUrl).origin !== origin) throw new Error("Live QA evidence failed: protection-redirect-origin")
    authorized = await fetch(nextUrl, {
      headers: {
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      redirect: "manual",
    })
    if (authorized.status < 300 || authorized.status >= 400) break
    const location = authorized.headers.get("location")
    if (!location) throw new Error("Live QA evidence failed: protection-redirect")
    nextUrl = new URL(location, nextUrl).href
    const setCookie = authorized.headers.get("set-cookie")
    if (setCookie) cookie = setCookie.split(";", 1)[0]
  }
  if (!authorized) throw new Error("Live QA evidence failed: protection-response")
  const finalOrigin = new URL(authorized.url).origin
  const finalHostname = new URL(finalOrigin).hostname
  return {
    unauthenticatedBlocked: unauthenticated.status >= 300 && unauthenticated.status < 400 && (unauthenticated.headers.get("location") || "").startsWith("https://vercel.com/"),
    authorizedStatus: authorized.status,
    deploymentSha: authorized.headers.get("x-renew-deployment-sha") || "",
    qaRef: authorized.headers.get("x-renew-qa-ref") || "",
    qaApiRef: authorized.headers.get("x-renew-qa-api-ref") || "",
    qaDatabaseRef: authorized.headers.get("x-renew-qa-database-ref") || "",
    qaStorageRef: authorized.headers.get("x-renew-qa-storage-ref") || "",
    qaStructure: authorized.headers.get("x-renew-qa-structure") || "",
    qaProject: authorized.headers.get("x-renew-qa-project") || "",
    qaMailPolicy: authorized.headers.get("x-renew-qa-mail-policy") || "",
    qaMailTransport: authorized.headers.get("x-renew-qa-mail-transport") || "",
    authHealthy: authorized.status === 200 && /^[a-z0-9]{20}$/.test(authorized.headers.get("x-renew-qa-database-ref") || ""),
    finalOrigin,
    alias: finalHostname,
  }
}

async function providerEvidenceFromArtifact(expectedSha) {
  const evidencePath = process.env.QA_PROVIDER_EVIDENCE_FILE
  if (!evidencePath) return null
  if (process.env.QA_VERCEL_TOKEN) throw new Error("Live QA evidence failed: secret-coexistence")
  const { assertSanitizedProviderDeployEvidence } = await import("../../lib/qa/explicit-deploy.mjs")
  const evidence = JSON.parse(await readFile(resolve(process.cwd(), evidencePath), "utf8"))
  const verified = assertSanitizedProviderDeployEvidence(evidence, {
    deploymentId: process.env.QA_VERCEL_DEPLOYMENT_ID || evidence.deploymentId,
    candidateSha: expectedSha,
    candidateBranch: process.env.QA_CANDIDATE_BRANCH || evidence.gitRef,
  })
  return {
    projectName: verified.projectName,
    target: verified.target,
    productionEnvironmentAttached: false,
    vercelDeploymentId: verified.deploymentId,
    metaGithubCommitSha: verified.candidateSha,
    metaGithubCommitRef: verified.gitRef,
    providerCreator: "explicit-qa-controller",
    providerEnvironmentUrl: verified.providerUrl || "",
  }
}

async function providerEvidenceFromProtectedHeaders(expectedSha, protection) {
  if (protection.deploymentSha !== expectedSha) throw new Error("Live QA evidence failed: deployment-sha")
  if (protection.qaProject !== "renew-overnight-validation-20260820") throw new Error("Live QA evidence failed: vercel-project")
  return {
    projectName: "renew-overnight-validation-20260820",
    target: null,
    productionEnvironmentAttached: false,
    vercelDeploymentId: process.env.QA_VERCEL_DEPLOYMENT_ID || null,
    metaGithubCommitSha: protection.deploymentSha,
    metaGithubCommitRef: process.env.QA_CANDIDATE_BRANCH || "",
    providerCreator: "stable-alias-headers",
    providerEnvironmentUrl: protection.finalOrigin,
  }
}

async function deploymentEvidence(expectedSha, protection) {
  if (process.env.QA_VERCEL_TOKEN) throw new Error("Live QA evidence failed: secret-coexistence")
  const fromArtifact = await providerEvidenceFromArtifact(expectedSha)
  if (fromArtifact) return fromArtifact
  return providerEvidenceFromProtectedHeaders(expectedSha, protection)
}

let database
try {
  const origin = new URL(process.env.QA_BROWSER_BASE_URL).origin
  const executionMode = process.env.QA_EXECUTION_MODE || "vercel"
  const expectedRef = process.env.QA_SUPABASE_PROJECT_REF
  const expectedSha = process.env.QA_EXPECTED_SHA
  database = await databaseClient()
  const storage = storageClient()
  const candidateRoot = await realpath(resolve(process.cwd(), process.env.QA_CANDIDATE_ROOT || "."))
  const contract = JSON.parse(await readFile(resolve(candidateRoot, "supabase/qa-contract.json"), "utf8"))

  const customerUnion = CUSTOMER_TABLES.map((table) => `SELECT '${table}' AS table_name, count(*)::int AS row_count FROM public."${table}"`).join(" UNION ALL ")
  const [customerResult, betterAuthResult, supabaseAuthResult, storageResult, databaseHealth, restResponse, authResponse, buckets, applicationRows] = await Promise.all([
    database.query(customerUnion),
    database.query('SELECT count(*)::int AS count FROM public."user"'),
    database.query("SELECT count(*)::int AS count FROM auth.users"),
    database.query("SELECT count(*)::int AS count FROM storage.objects"),
    database.query("SELECT 1 AS healthy"),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/repreneurs?select=id&limit=1`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }),
    storage.storage.listBuckets(),
    countPublicRows(database),
  ])
  const protection = await applicationProbe(origin, process.env.VERCEL_AUTOMATION_BYPASS_SECRET, executionMode)
  const deployment = executionMode === "vercel" ? await deploymentEvidence(expectedSha, protection) : null
  const evidence = {
    collectedAt: new Date().toISOString(),
    supabase: {
      databaseRef: refFromDatabaseUrl(process.env.DATABASE_URL),
      apiRef: refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      storageRef: refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      databaseHealthy: databaseHealth.rows[0]?.healthy === 1,
      restHealthy: restResponse.ok,
      authHealthy: protection.authHealthy && authResponse.ok,
      storageHealthy: !buckets.error,
      storageBuckets: (buckets.data ?? []).map((bucket) => ({ id: bucket.id, public: bucket.public === true })),
      customerRows: customerResult.rows.reduce((sum, row) => sum + row.row_count, 0),
      applicationRows,
      betterAuthUsers: betterAuthResult.rows[0].count,
      supabaseAuthUsers: supabaseAuthResult.rows[0].count,
      storageObjects: storageResult.rows[0].count,
      customerTableCounts: Object.fromEntries(customerResult.rows.map((row) => [row.table_name, row.row_count])),
    },
    ...(executionMode === "github-runner"
      ? {
          runtime: {
            provider: "github-runner",
            origin: protection.finalOrigin,
            candidateSha: protection.deploymentSha,
            loopbackOnly: protection.finalOrigin === "https://127.0.0.1:3443",
            productionEnvironmentAttached: false,
            authorizedStatus: protection.authorizedStatus,
          },
        }
      : {
          vercel: {
            projectName: deployment.projectName,
            target: deployment.target,
            origin: protection.finalOrigin,
            deploymentSha: protection.deploymentSha,
            protection: { unauthenticatedBlocked: protection.unauthenticatedBlocked, authorizedStatus: protection.authorizedStatus },
            aliases: [protection.alias],
            productionEnvironmentAttached: deployment.productionEnvironmentAttached,
            githubDeploymentId: deployment.githubDeploymentId || null,
            vercelDeploymentId: deployment.vercelDeploymentId || null,
            metaGithubCommitSha: deployment.metaGithubCommitSha || protection.deploymentSha,
            metaGithubCommitRef: deployment.metaGithubCommitRef || "",
            providerCreator: deployment.providerCreator,
            providerEnvironmentUrl: deployment.providerEnvironmentUrl,
          },
        }),
    email: { allowedRecipients: [process.env.QA_EMAIL_RECIPIENT], applicationPolicy: protection.qaMailPolicy, applicationTransport: protection.qaMailTransport },
    candidateContract: { expectedStructureFingerprint: contract.structureFingerprint },
    deployedContract: {
      candidateSha: protection.deploymentSha,
      projectRef: protection.qaRef,
      apiRef: protection.qaApiRef,
      databaseRef: protection.qaDatabaseRef,
      storageRef: protection.qaStorageRef,
      structureFingerprint: protection.qaStructure,
      validationProject: protection.qaProject,
      mailPolicy: protection.qaMailPolicy,
      mailTransport: protection.qaMailTransport,
    },
    liveStructureFingerprint: null,
  }
  const failedHealth = ["database", "rest", "auth", "storage"].filter((name) => !evidence.supabase[`${name}Healthy`])
  if (failedHealth.length > 0) throw new Error(`Live QA evidence failed: provider-health-${failedHealth.join("-")}`)
  const allowStaleResidue = process.env.QA_EVIDENCE_MODE === "identity"
  validateLiveEvidence({ expectedRef, expectedOrigin: origin, expectedSha, evidence, allowStaleResidue, executionMode })
  await writePrivateJson(EVIDENCE_FILE, evidence)
  console.log(JSON.stringify({ ok: true, projectRef: expectedRef, origin, candidateSha: expectedSha, executionMode, evidenceMode: allowStaleResidue ? "identity" : "empty", customerRows: evidence.supabase.customerRows, authUsers: evidence.supabase.betterAuthUsers + evidence.supabase.supabaseAuthUsers, storageObjects: evidence.supabase.storageObjects, unauthenticatedBlocked: protection.unauthenticatedBlocked, authorizedStatus: protection.authorizedStatus }))
} catch (error) {
  console.error(error instanceof Error && (error.message.startsWith("Live QA evidence failed:") || error.message.startsWith("Isolation preflight failed:") || error.message.startsWith("QA explicit deploy failed:")) ? error.message : "Live QA evidence failed: collection")
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
