#!/usr/bin/env node
import { EVIDENCE_FILE, databaseClient, refFromDatabaseUrl, refFromSupabaseUrl, storageClient, writePrivateJson } from "./phase-b-common.mjs"
import { validateLiveEvidence } from "../../lib/qa/phase-b.mjs"

const CUSTOMER_TABLES = ["repreneurs", "opportunities", "opportunity_matches", "ma_firms", "ma_offices", "ma_contacts", "ma_contact_office_affiliations"]

async function protectedProbe(origin, bypass) {
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
    finalOrigin,
    alias: finalHostname,
  }
}

async function githubDeploymentEvidence(expectedSha) {
  const repository = process.env.GITHUB_REPOSITORY
  if (!/^ivan-loves-git\/v0-re-new-2-0$/.test(repository || "")) throw new Error("Live QA evidence failed: github-repository")
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const deploymentsResponse = await fetch(`https://api.github.com/repos/${repository}/deployments?sha=${expectedSha}&per_page=20`, { headers })
  if (!deploymentsResponse.ok) throw new Error("Live QA evidence failed: github-deployments")
  const deployments = await deploymentsResponse.json()
  const expectedEnvironment = "Preview – renew-overnight-validation-20260820"
  const deployment = deployments.find((candidate) => candidate.environment === expectedEnvironment && candidate.creator?.login === "vercel[bot]" && candidate.sha === expectedSha)
  if (!deployment || deployment.production_environment !== false) throw new Error("Live QA evidence failed: vercel-deployment")
  const statusesResponse = await fetch(deployment.statuses_url, { headers })
  if (!statusesResponse.ok) throw new Error("Live QA evidence failed: github-deployment-status")
  const statuses = await statusesResponse.json()
  const status = statuses.find((candidate) => candidate.state === "success" && candidate.creator?.login === "vercel[bot]")
  if (!status) throw new Error("Live QA evidence failed: vercel-deployment-status")
  return {
    projectName: expectedEnvironment.replace("Preview – ", ""),
    target: "preview",
    productionEnvironmentAttached: deployment.production_environment,
    githubDeploymentId: deployment.id,
    providerCreator: deployment.creator.login,
    providerEnvironmentUrl: status.environment_url,
  }
}

let database
try {
  const origin = new URL(process.env.QA_BROWSER_BASE_URL).origin
  const expectedRef = process.env.QA_SUPABASE_PROJECT_REF
  const expectedSha = process.env.QA_EXPECTED_SHA
  database = await databaseClient()
  const storage = storageClient()

  const customerUnion = CUSTOMER_TABLES.map((table) => `SELECT '${table}' AS table_name, count(*)::int AS row_count FROM public."${table}"`).join(" UNION ALL ")
  const [customerResult, betterAuthResult, supabaseAuthResult, storageResult, databaseHealth, restResponse, authResponse, buckets] = await Promise.all([
    database.query(customerUnion),
    database.query('SELECT count(*)::int AS count FROM public."user"'),
    database.query("SELECT count(*)::int AS count FROM auth.users"),
    database.query("SELECT count(*)::int AS count FROM storage.objects"),
    database.query("SELECT 1 AS healthy"),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } }),
    storage.storage.listBuckets(),
  ])
  const [protection, deployment] = await Promise.all([
    protectedProbe(origin, process.env.VERCEL_AUTOMATION_BYPASS_SECRET),
    githubDeploymentEvidence(expectedSha),
  ])
  const evidence = {
    collectedAt: new Date().toISOString(),
    supabase: {
      databaseRef: refFromDatabaseUrl(process.env.DATABASE_URL),
      apiRef: refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      storageRef: refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
      databaseHealthy: databaseHealth.rows[0]?.healthy === 1,
      restHealthy: restResponse.ok,
      authHealthy: authResponse.ok,
      storageHealthy: !buckets.error,
      customerRows: customerResult.rows.reduce((sum, row) => sum + row.row_count, 0),
      betterAuthUsers: betterAuthResult.rows[0].count,
      supabaseAuthUsers: supabaseAuthResult.rows[0].count,
      storageObjects: storageResult.rows[0].count,
      customerTableCounts: Object.fromEntries(customerResult.rows.map((row) => [row.table_name, row.row_count])),
    },
    vercel: {
      projectName: deployment.projectName,
      target: deployment.target,
      origin: protection.finalOrigin,
      deploymentSha: protection.deploymentSha,
      protection: { unauthenticatedBlocked: protection.unauthenticatedBlocked, authorizedStatus: protection.authorizedStatus },
      aliases: [protection.alias],
      productionEnvironmentAttached: deployment.productionEnvironmentAttached,
      githubDeploymentId: deployment.githubDeploymentId,
      providerCreator: deployment.providerCreator,
      providerEnvironmentUrl: deployment.providerEnvironmentUrl,
    },
    email: { allowedRecipients: [process.env.QA_EMAIL_RECIPIENT] },
  }
  validateLiveEvidence({ expectedRef, expectedOrigin: origin, expectedSha, evidence })
  await writePrivateJson(EVIDENCE_FILE, evidence)
  console.log(JSON.stringify({ ok: true, projectRef: expectedRef, origin, deploymentSha: expectedSha, customerRows: 0, authUsers: 0, storageObjects: 0, unauthenticatedBlocked: true, authorizedStatus: 200 }))
} catch (error) {
  console.error(error instanceof Error && (error.message.startsWith("Live QA evidence failed:") || error.message.startsWith("Isolation preflight failed:")) ? error.message : "Live QA evidence failed: collection")
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
