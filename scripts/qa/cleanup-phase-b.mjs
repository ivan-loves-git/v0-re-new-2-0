#!/usr/bin/env node
import { MANIFEST_FILE, RUNTIME_FIXTURES_FILE, RUN_DIR, databaseClient, readJson, recordRuntimeFixtures, removeRunnerSecrets, setProvisionalIdentityTriggers, storageClient, writePrivateJson } from "./phase-b-common.mjs"

function safeDatabaseToken(error) {
  const constraint = String(error?.constraint ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (constraint) return `constraint_${constraint}`
  const code = String(error?.code ?? "").replace(/[^a-z0-9_]/gi, "_")
  if (code) return `postgres_${code}`
  return "postgres_unknown"
}

let database
try {
  const manifest = await readJson(MANIFEST_FILE)
  database = await databaseClient()
  const storage = storageClient()
  const runtime = await readJson(RUNTIME_FIXTURES_FILE).catch(() => ({}))
  const authIdentityIds = [...manifest.betterAuthIdentities, manifest.ids.provisionalContextUser]
  const recordedRepreneurIds = [runtime.p1RepreneurId, runtime.p2RepreneurId, manifest.ids.portalRepreneur].filter(Boolean)
  let scopedRepreneurs = await database.query("SELECT id, email, source, cv_url FROM public.repreneurs WHERE id = ANY($1::uuid[])", [recordedRepreneurIds])
  if (!runtime.p1RepreneurId || !runtime.p2RepreneurId) {
    const recovered = await database.query("SELECT id, email, source, cv_url FROM public.repreneurs WHERE lower(email) IN (lower($1), lower($2))", [manifest.actors.applicant.email, manifest.actors.staffCreated.email])
    scopedRepreneurs = { rows: [...scopedRepreneurs.rows, ...recovered.rows.filter((candidate) => !scopedRepreneurs.rows.some((row) => row.id === candidate.id))] }
  }
  if (runtime.p1RepreneurId && !scopedRepreneurs.rows.some((row) => row.id === runtime.p1RepreneurId)) throw new Error("Phase B cleanup failed: p1-ledger-mismatch")
  if (runtime.p2RepreneurId && !scopedRepreneurs.rows.some((row) => row.id === runtime.p2RepreneurId)) throw new Error("Phase B cleanup failed: p2-ledger-mismatch")
  for (const row of scopedRepreneurs.rows) {
    const expected = row.id === manifest.ids.portalRepreneur
      || (row.email === manifest.actors.applicant.email && row.source === "intake_v2")
      || (row.email === manifest.actors.staffCreated.email && row.source === "staff_manual")
    if (!expected) throw new Error("Phase B cleanup failed: repreneur-scope")
  }
  const scopedOpportunities = await database.query("SELECT id FROM public.opportunities WHERE public_title=$1 AND created_by=$2", [`${manifest.fixturePrefix} opportunity`, manifest.actors.staff.userId])
  if (runtime.p3OpportunityId && !scopedOpportunities.rows.some((row) => row.id === runtime.p3OpportunityId)) throw new Error("Phase B cleanup failed: opportunity-ledger-mismatch")
  if (scopedOpportunities.rows.length > 2) throw new Error("Phase B cleanup failed: opportunity-scope")
  const scopedOpportunityProbes = runtime.opportunityProbeId
    ? await database.query("SELECT id FROM public.opportunities WHERE id=$1 AND public_title=$2 AND created_by=$3", [runtime.opportunityProbeId, `${manifest.fixturePrefix} opportunity probe`, manifest.actors.staff.userId])
    : await database.query("SELECT id FROM public.opportunities WHERE public_title=$1 AND created_by=$2", [`${manifest.fixturePrefix} opportunity probe`, manifest.actors.staff.userId])
  if (scopedOpportunityProbes.rows.length > 1) throw new Error("Phase B cleanup failed: opportunity-probe-scope")
  const repreneurIds = [...new Set([manifest.ids.portalRepreneur, ...scopedRepreneurs.rows.map((row) => row.id)])]
  const opportunityIds = scopedOpportunities.rows.map((row) => row.id)
  const opportunityProbeIds = scopedOpportunityProbes.rows.map((row) => row.id)
  const allOpportunityIds = [...new Set([...opportunityIds, ...opportunityProbeIds])]
  const scopedMatches = opportunityIds.length > 0
    ? await database.query("SELECT id FROM public.opportunity_matches WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    : { rows: [] }
  const matchIds = scopedMatches.rows.map((row) => row.id)
  if (runtime.p3MatchId && !scopedMatches.rows.some((row) => row.id === runtime.p3MatchId)) throw new Error("Phase B cleanup failed: match-ledger-mismatch")
  const scopedEvidence = matchIds.length > 0
    ? await database.query("SELECT id FROM public.opportunity_pursuit_evidence WHERE match_id = ANY($1::uuid[])", [matchIds])
    : { rows: [] }
  const evidenceIds = scopedEvidence.rows.map((row) => row.id)
  if (runtime.p3EvidenceId && !scopedEvidence.rows.some((row) => row.id === runtime.p3EvidenceId)) throw new Error("Phase B cleanup failed: evidence-ledger-mismatch")
  const objectNames = [...new Set([...manifest.storageObjects, ...(runtime.storageObjects ?? []), ...scopedRepreneurs.rows.map((row) => row.cv_url).filter(Boolean)])]
  await recordRuntimeFixtures({
    ...runtime,
    repreneurIds,
    opportunityIds,
    opportunityProbeIds,
    matchIds,
    evidenceIds,
    storageObjects: objectNames,
  })
  if (objectNames.length > 0) {
    const { error } = await storage.storage.from("cvs").remove(objectNames)
    if (error) throw new Error("Phase B cleanup failed: storage-delete")
  }

  await database.query("BEGIN")
  await setProvisionalIdentityTriggers(database, false)
  if (opportunityProbeIds.length > 0) {
    await database.query("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($1::uuid[])", [opportunityProbeIds])
    await database.query("DELETE FROM public.opportunities WHERE id = ANY($1::uuid[])", [opportunityProbeIds])
  }
  if (opportunityIds.length > 0) {
    if (evidenceIds.length > 0) await database.query("DELETE FROM public.opportunity_pursuit_evidence WHERE id = ANY($1::uuid[])", [evidenceIds])
    await database.query("DELETE FROM public.opportunity_pursuit_events WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    await database.query("DELETE FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($1::uuid[])", [opportunityIds])
    if (matchIds.length > 0) await database.query("DELETE FROM public.opportunity_matches WHERE id = ANY($1::uuid[])", [matchIds])
    await database.query("DELETE FROM public.opportunities WHERE id = ANY($1::uuid[])", [opportunityIds])
  }
  await database.query("DELETE FROM public.repreneurs WHERE id = ANY($1::uuid[])", [repreneurIds])
  await database.query("DELETE FROM public.ma_provisional_source_contexts WHERE context_key=$1", [manifest.ids.provisionalContext])
  await database.query("DELETE FROM public.ma_contact_office_affiliations WHERE id=$1", [manifest.ids.provisionalAffiliation])
  await database.query("DELETE FROM public.ma_contacts WHERE id = ANY($1::uuid[])", [[manifest.ids.provisionalCountContact, manifest.ids.provisionalContextContact]])
  await database.query("DELETE FROM public.ma_offices WHERE id=$1", [manifest.ids.provisionalOffice])
  await database.query("DELETE FROM public.ma_firms WHERE id=$1", [manifest.ids.provisionalFirm])

  await database.query("DELETE FROM public.ma_contact_office_affiliations WHERE id=$1", [manifest.ids.affiliation])
  await database.query("DELETE FROM public.ma_contacts WHERE id=$1", [manifest.ids.contact])
  await database.query("DELETE FROM public.ma_offices WHERE id=$1", [manifest.ids.office])
  await database.query("DELETE FROM public.ma_firms WHERE id=$1", [manifest.ids.firm])
  await database.query("DELETE FROM public.opportunity_mandate_reference_counters WHERE reference_code=$1", [manifest.referenceCode])
  await database.query("DELETE FROM public.geography_nodes WHERE id=$1", [manifest.ids.geography])
  await database.query("DELETE FROM public.wave_journey_settings WHERE singleton=true AND updated_by=$1", [manifest.actors.staff.userId])
  await database.query("DELETE FROM public.app_user_roles WHERE user_id = ANY($1::text[])", [authIdentityIds])
  await database.query('DELETE FROM public."session" WHERE "userId" = ANY($1::text[])', [authIdentityIds])
  await database.query('DELETE FROM public."account" WHERE "userId" = ANY($1::text[])', [authIdentityIds])
  await database.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [authIdentityIds])
  await database.query("SET CONSTRAINTS ALL IMMEDIATE")
  await setProvisionalIdentityTriggers(database, true)
  await database.query("COMMIT")

  const residue = await database.query(`SELECT
    (SELECT count(*)::int FROM public.repreneurs WHERE id = ANY($1::uuid[])) AS repreneurs,
    (SELECT count(*)::int FROM public.opportunities WHERE id = ANY($2::uuid[])) + (SELECT count(*)::int FROM public.opportunity_ma_contacts WHERE opportunity_id = ANY($2::uuid[])) AS opportunities,
    (SELECT count(*)::int FROM public.opportunity_matches WHERE id = ANY($3::uuid[])) + (SELECT count(*)::int FROM public.opportunity_pursuit_evidence WHERE id = ANY($4::uuid[])) AS journey_rows,
    (SELECT count(*)::int FROM public.ma_firms WHERE id = ANY($5::uuid[])) + (SELECT count(*)::int FROM public.ma_offices WHERE id = ANY($6::uuid[])) + (SELECT count(*)::int FROM public.ma_contacts WHERE id = ANY($7::uuid[])) + (SELECT count(*)::int FROM public.ma_contact_office_affiliations WHERE id = ANY($8::uuid[])) + (SELECT count(*)::int FROM public.ma_provisional_source_contexts WHERE context_key=$9) + (SELECT count(*)::int FROM public.wave_journey_settings WHERE singleton=true AND updated_by=$10) AS ma_rows,
    (SELECT count(*)::int FROM public."user" WHERE id = ANY($11::text[])) + (SELECT count(*)::int FROM public."account" WHERE "userId" = ANY($11::text[])) + (SELECT count(*)::int FROM public."session" WHERE "userId" = ANY($11::text[])) + (SELECT count(*)::int FROM public.app_user_roles WHERE user_id = ANY($11::text[])) AS auth_rows,
    (SELECT count(*)::int FROM storage.objects WHERE bucket_id='cvs' AND name = ANY($12::text[])) AS storage_objects`, [repreneurIds, allOpportunityIds, matchIds, evidenceIds, [manifest.ids.firm, manifest.ids.provisionalFirm], [manifest.ids.office, manifest.ids.provisionalOffice], [manifest.ids.contact, manifest.ids.provisionalCountContact, manifest.ids.provisionalContextContact], [manifest.ids.affiliation, manifest.ids.provisionalAffiliation], manifest.ids.provisionalContext, manifest.actors.staff.userId, authIdentityIds, objectNames])
  const values = residue.rows[0]
  const total = Object.values(values).reduce((sum, value) => sum + Number(value), 0)
  if (total !== 0) throw new Error("Phase B cleanup failed: residue")
  await writePrivateJson(`${RUN_DIR}/cleanup-readback.json`, { runId: manifest.runId, databaseResidue: 0, authResidue: 0, storageResidue: 0, exactIdsChecked: manifest.databaseRows.length + repreneurIds.length + allOpportunityIds.length + matchIds.length + evidenceIds.length, dynamicObjectsChecked: objectNames.length, runtimeFixtureIds: { repreneurIds, opportunityIds, opportunityProbeIds, matchIds, evidenceIds } })
  await removeRunnerSecrets()
  console.log(JSON.stringify({ ok: true, runId: manifest.runId, databaseResidue: 0, authResidue: 0, storageResidue: 0 }))
} catch (error) {
  if (database) await database.query("ROLLBACK").catch(() => {})
  if (database) await setProvisionalIdentityTriggers(database, true).catch(() => {})
  await removeRunnerSecrets().catch(() => {})
  console.error(error instanceof Error && error.message.startsWith("Phase B cleanup failed:") ? error.message : `Phase B cleanup failed: database-${safeDatabaseToken(error)}`)
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
