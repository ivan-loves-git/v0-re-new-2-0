#!/usr/bin/env node
import { randomBytes } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { hashPassword } from "better-auth/crypto"
import { validateIsolationPreflight } from "../../lib/qa/isolation-preflight.mjs"
import { validateLiveEvidence } from "../../lib/qa/phase-b.mjs"
import { CREDENTIALS_FILE, EVIDENCE_FILE, MANIFEST_FILE, RUN_DIR, databaseClient, readJson, recordRuntimeFixtures, setProvisionalIdentityTriggers, storageClient, writePrivateJson } from "./phase-b-common.mjs"

function safeDatabaseToken(error) {
  const constraint = String(error?.constraint ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (constraint) return `constraint_${constraint}`
  const code = String(error?.code ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (code) return `postgres_${code}`
  const tokens = String(error?.message ?? "").match(/[a-z][a-z0-9_]{4,}/g) ?? []
  return tokens.find((token) => token.startsWith("opportunity_") || token.startsWith("ma_")) ?? "postgres_unknown"
}

let database
try {
  const [manifest, evidence] = await Promise.all([readJson(MANIFEST_FILE), readJson(EVIDENCE_FILE)])
  validateIsolationPreflight({ env: process.env, evidence, manifest })
  validateLiveEvidence({ expectedRef: process.env.QA_SUPABASE_PROJECT_REF, expectedOrigin: new URL(process.env.QA_BROWSER_BASE_URL).origin, expectedSha: process.env.QA_EXPECTED_SHA, evidence })

  database = await databaseClient()
  const integrityDefinition = (await database.query("SELECT pg_get_functiondef('public.assert_ma_provisional_source_context_integrity()'::regprocedure) AS definition")).rows[0]?.definition
  if (!integrityDefinition) throw new Error("Phase B fixture seed failed: provisional-integrity-definition")
  const repairedIntegrityDefinition = integrityDefinition
    .replaceAll("'TEST-schema-redacted-001'", "'test-schema-redacted-001'")
    .replaceAll("'TEST-schema-redacted-002'", "'test-schema-redacted-002'")
    .replaceAll("'TEST-schema-redacted-003'", "'test-schema-redacted-003'")
    .replace("WHERE LOWER(BTRIM(contact.display_name)) = 'TEST-schema-redacted-person'", "WHERE LOWER(BTRIM(contact.display_name)) = 'test-schema-redacted-person'")
  if (repairedIntegrityDefinition !== integrityDefinition) await database.query(repairedIntegrityDefinition)
  await database.query("NOTIFY pgrst, 'reload schema'")
  const storage = storageClient()
  const nonEmpty = await database.query(`SELECT
    (SELECT count(*)::int FROM public.repreneurs) +
    (SELECT count(*)::int FROM public.opportunities) +
    (SELECT count(*)::int FROM public.opportunity_matches) +
    (SELECT count(*)::int FROM public.ma_firms) +
    (SELECT count(*)::int FROM public.ma_offices) +
    (SELECT count(*)::int FROM public.ma_contacts) +
    (SELECT count(*)::int FROM public."user") +
    (SELECT count(*)::int FROM auth.users) +
    (SELECT count(*)::int FROM storage.objects) AS count`)
  if (nonEmpty.rows[0].count !== 0) throw new Error("Phase B fixture seed failed: non-empty-branch")

  const password = randomBytes(24).toString("base64url")
  const passwordHash = await hashPassword(password)
  const { actors, ids, fixturePrefix } = manifest
  const opportunityProbeFields = {
    geography_node_id: ids.geography,
    sector: "Tech & Digital",
    location: "Paris",
    revenue_meur: null,
    ebitda_keur: null,
    headcount: null,
    headcount_range: null,
    date_added: null,
    public_title: `${fixturePrefix} opportunity probe`,
    teaser_summary: `${fixturePrefix} safe probe`,
    internal_notes: null,
  }

  await database.query("BEGIN")
  await setProvisionalIdentityTriggers(database, false)
  await database.query(`INSERT INTO public.geography_nodes (id, stable_key, code, label, node_level)
    VALUES ($1, $2, $3, $4, 'country')`, [ids.geography, `qa-${manifest.runId.toLowerCase()}`, manifest.referenceCode, fixturePrefix])
  await database.query("INSERT INTO public.wave_journey_settings (singleton, enabled, updated_by) VALUES (true, true, $1)", [actors.staff.userId])
  await database.query(`INSERT INTO public.ma_firms (id, name, status, category, created_by)
    VALUES ($1, $2, 'active', 'M&A boutique', $3)`, [ids.firm, `${fixturePrefix} firm`, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_offices (id, firm_id, name, status, is_default, city, created_by)
    VALUES ($1, $2, $3, 'active', false, 'Paris', $4)`, [ids.office, ids.firm, `${fixturePrefix} office`, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_contacts (id, first_name, last_name, display_name, status, email, created_by)
    VALUES ($1, 'Test', 'Contact', $2, 'active', $3, $4)`, [ids.contact, `${fixturePrefix} contact`, process.env.QA_EMAIL_RECIPIENT, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_contact_office_affiliations (id, contact_id, office_id, job_title, is_active, created_by)
    VALUES ($1, $2, $3, 'QA contact', true, $4)`, [ids.affiliation, ids.contact, ids.office, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_firms (id, name, status, category, created_by)
    VALUES ($1, 'Acme Co.', 'active', 'M&A boutique', $2)`, [ids.provisionalFirm, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_offices (id, firm_id, name, status, is_default, city, created_by)
    VALUES ($1, $2, 'Acme Paris', 'active', false, 'Paris', $3)`, [ids.provisionalOffice, ids.provisionalFirm, actors.staff.userId])
  await database.query(`INSERT INTO public.ma_contacts (id, first_name, display_name, status, email, created_by)
    VALUES ($1, 'QA', $2, 'active', 'test-schema-redacted-001', $3),
           ($4, 'TEST-schema-redacted-person', 'TEST-schema-redacted-person', 'active', 'test-schema-redacted-003', $3)`,
    [ids.provisionalCountContact, `${fixturePrefix} integrity count`, actors.staff.userId, ids.provisionalContextContact])
  await database.query(`INSERT INTO public.ma_contact_office_affiliations (id, contact_id, office_id, job_title, is_active, created_by)
    VALUES ($1, $2, $3, 'QA provisional context', true, $4)`, [ids.provisionalAffiliation, ids.provisionalContextContact, ids.provisionalOffice, actors.staff.userId])
  await database.query(`INSERT INTO public.repreneurs (
      id, email, first_name, last_name, lifecycle_status, source, created_by,
      who_score, when_score, scoring_flags, q12_geo_zones, q13_target_sectors_v2, q14_deal_size
    ) VALUES ($1, $2, 'Portal', $3, 'lead', 'qa_playwright', $4, 80, 80, '[]'::jsonb, '["all-france"]'::jsonb, '["Tech & Digital"]'::jsonb, '["1-3M"]'::jsonb)`,
    [ids.portalRepreneur, actors.portal.email, fixturePrefix, actors.staff.userId])

  for (const actor of [actors.staff, actors.portal]) {
    await database.query(`INSERT INTO public."user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`, [actor.userId, `${fixturePrefix} ${actor === actors.staff ? "staff" : "portal"}`, actor.email])
  }
  await database.query(`INSERT INTO public."user" (id, name, email, "emailVerified")
    VALUES ($1, $2, 'test-schema-redacted-002', true)`, [ids.provisionalContextUser, `${fixturePrefix} provisional context`])
  await database.query(`INSERT INTO public."account" (id, "userId", "accountId", "providerId", password)
    VALUES ($1, $2, $3, 'credential', $4), ($5, $6, $7, 'credential', $4)`, [ids.staffAccount, actors.staff.userId, actors.staff.email, passwordHash, ids.portalAccount, actors.portal.userId, actors.portal.email])
  await database.query(`INSERT INTO public.app_user_roles (id, user_id, email, role, repreneur_id, access_enabled_at)
    VALUES ($1, $2, $3, 'staff', NULL, now()), ($4, $5, $6, 'repreneur', $7, now())`, [ids.staffRole, actors.staff.userId, actors.staff.email, ids.portalRole, actors.portal.userId, actors.portal.email, ids.portalRepreneur])
  await database.query(`INSERT INTO public.app_user_roles (id, user_id, email, role, access_enabled_at)
    VALUES ($1, $2, 'test-schema-redacted-002', 'staff', now())`, [ids.provisionalContextRole, ids.provisionalContextUser])
  await database.query(`INSERT INTO public.ma_provisional_source_contexts (context_key, firm_id, office_id, contact_id, affiliation_id)
    VALUES ('acme_co_paris', $1, $2, $3, $4)`, [ids.provisionalFirm, ids.provisionalOffice, ids.provisionalContextContact, ids.provisionalAffiliation])
  await database.query("SAVEPOINT phase_b_opportunity_probe")
  try {
    await database.query(`SELECT (public.create_opportunity_with_office_context(
      $1::text, $2::uuid, $3::uuid[], $4::uuid, $5::text, $6::public.opportunity_status, $7::text, $8::jsonb
    )).id`, [
      "",
      ids.office,
      [ids.affiliation],
      ids.affiliation,
      `${fixturePrefix} opportunity probe`,
      "active",
      actors.staff.userId,
      JSON.stringify(opportunityProbeFields),
    ])
  } catch (error) {
    throw new Error(`Phase B fixture seed failed: opportunity-rpc-${safeDatabaseToken(error)}`)
  } finally {
    await database.query("ROLLBACK TO SAVEPOINT phase_b_opportunity_probe")
  }
  await database.query("SET CONSTRAINTS ALL IMMEDIATE")
  await setProvisionalIdentityTriggers(database, true)
  await database.query("COMMIT")

  await new Promise((resolve) => setTimeout(resolve, 1500))
  const restProbe = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/create_opportunity_with_office_context`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_reference: "",
      p_source_office_id: ids.office,
      p_affiliation_ids: [ids.affiliation],
      p_primary_affiliation_id: ids.affiliation,
      p_description: `${fixturePrefix} opportunity probe`,
      p_target_status: "active",
      p_actor: actors.staff.userId,
      p_opportunity_fields: opportunityProbeFields,
    }),
  })
  const restProbeBody = await restProbe.json().catch(() => ({}))
  if (!restProbe.ok) throw new Error(`Phase B fixture seed failed: opportunity-rest-${safeDatabaseToken(restProbeBody)}`)
  if (!restProbeBody?.id) throw new Error("Phase B fixture seed failed: opportunity-rest-missing-id")
  await recordRuntimeFixtures({ opportunityProbeId: restProbeBody.id })
  await database.query("BEGIN")
  await database.query("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = $1", [restProbeBody.id])
  await database.query("DELETE FROM public.opportunities WHERE id = $1", [restProbeBody.id])
  await database.query("DELETE FROM public.opportunity_mandate_reference_counters WHERE reference_code = $1", [manifest.referenceCode])
  await database.query("COMMIT")
  await recordRuntimeFixtures({ opportunityProbeId: null })

  await mkdir(RUN_DIR, { recursive: true })
  const pdf = Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R>>endobj\n4 0 obj<</Length ${fixturePrefix.length + 24}>>stream\nBT /F1 12 Tf 20 50 Td (${fixturePrefix}) Tj ET\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`)
  const pdfPath = `${RUN_DIR}/pilot.pdf`
  await writeFile(pdfPath, pdf, { mode: 0o600 })
  await chmod(pdfPath, 0o600)
  const { error: uploadError } = await storage.storage.from("cvs").upload(manifest.storageObjects[0], pdf, { contentType: "application/pdf", upsert: false })
  if (uploadError) throw new Error("Phase B fixture seed failed: storage-upload")

  await writePrivateJson(CREDENTIALS_FILE, { password, staffEmail: actors.staff.email, portalEmail: actors.portal.email })
  console.log(JSON.stringify({ ok: true, runId: manifest.runId, fixturePrefix, databaseRows: manifest.databaseRows.length, identities: 2, storageObjects: 1 }))
} catch (error) {
  if (database) await database.query("ROLLBACK").catch(() => {})
  if (database) await setProvisionalIdentityTriggers(database, true).catch(() => {})
  console.error(error instanceof Error && (error.message.startsWith("Phase B fixture seed failed:") || error.message.startsWith("Isolation preflight failed:") || error.message.startsWith("Live QA evidence failed:")) ? error.message : `Phase B fixture seed failed: database-${safeDatabaseToken(error)}`)
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
